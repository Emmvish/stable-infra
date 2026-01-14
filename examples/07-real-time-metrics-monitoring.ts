/**
 * Example 7: Real-Time Metrics Monitoring & Performance Dashboard
 * 
 * This example demonstrates comprehensive metrics collection and analysis:
 * - Request-level metrics (attempts, execution time, success rates)
 * - Phase-level metrics (throughput, completion rates)
 * - Branch-level metrics (parallel execution performance)
 * - Workflow-level metrics (end-to-end performance)
 * - Infrastructure metrics (circuit breaker, cache, rate limiter, concurrency limiter)
 * - Real-time performance analysis and alerting
 * - Bottleneck identification and optimization recommendations
 */

import {
  stableWorkflow,
  MetricsAggregator,
  CircuitBreaker,
  CacheManager,
  RateLimiter,
  ConcurrencyLimiter,
  RETRY_STRATEGIES,
  REQUEST_METHODS,
  PHASE_DECISION_ACTIONS,
} from '../src/index.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SLA_THRESHOLDS = {
  maxPhaseExecutionTime: 5000,      // 5 seconds per phase
  maxWorkflowExecutionTime: 15000,  // 15 seconds total
  minSuccessRate: 95,                // 95% success rate
  maxAverageRequestTime: 1000,      // 1 second average
  maxThroughput: 50,                 // 50 requests/second target
};

const ALERT_LEVELS = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  INFO: 'INFO',
} as const;

// ============================================================================
// INFRASTRUCTURE SETUP
// ============================================================================

// Circuit breaker to prevent cascade failures
const circuitBreaker = new CircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 5,
  recoveryTimeoutMs: 10000,
  successThresholdPercentage: 60,
  halfOpenMaxRequests: 3,
});

// Cache manager for performance optimization
const cache = new CacheManager({
  enabled: true,
  ttl: 30000, // 30 seconds
  maxSize: 200,
  respectCacheControl: true,
});

// Rate limiter to prevent API throttling
const rateLimiter = new RateLimiter(50, 10000); // 50 req/10sec

// Concurrency limiter for resource management
const concurrencyLimiter = new ConcurrencyLimiter(10);

// ============================================================================
// METRICS ANALYSIS & ALERTING
// ============================================================================

interface Alert {
  level: keyof typeof ALERT_LEVELS;
  component: string;
  message: string;
  metric: string;
  value: number | string;
  threshold?: number;
  recommendation?: string;
}

class MetricsMonitor {
  private alerts: Alert[] = [];

  analyzeWorkflowMetrics(metrics: any): Alert[] {
    this.alerts = [];

    // Analyze overall workflow performance
    if (metrics.workflow) {
      const wf = metrics.workflow;

      // Check execution time
      if (wf.executionTime > SLA_THRESHOLDS.maxWorkflowExecutionTime) {
        this.addAlert({
          level: 'CRITICAL',
          component: 'Workflow',
          message: 'Workflow execution time exceeded SLA threshold',
          metric: 'executionTime',
          value: wf.executionTime,
          threshold: SLA_THRESHOLDS.maxWorkflowExecutionTime,
          recommendation: 'Consider enabling concurrent phase execution or optimizing slow phases',
        });
      }

      // Check success rate
      if (wf.requestSuccessRate < SLA_THRESHOLDS.minSuccessRate) {
        this.addAlert({
          level: 'CRITICAL',
          component: 'Workflow',
          message: 'Request success rate below acceptable threshold',
          metric: 'requestSuccessRate',
          value: wf.requestSuccessRate,
          threshold: SLA_THRESHOLDS.minSuccessRate,
          recommendation: 'Investigate failing requests and consider adjusting retry strategies',
        });
      }

      // Check throughput
      if (wf.throughput < SLA_THRESHOLDS.maxThroughput && wf.totalRequests > 20) {
        this.addAlert({
          level: 'WARNING',
          component: 'Workflow',
          message: 'Throughput below target',
          metric: 'throughput',
          value: wf.throughput.toFixed(2),
          threshold: SLA_THRESHOLDS.maxThroughput,
          recommendation: 'Consider increasing concurrency limits or enabling caching',
        });
      }

      // Check for early termination
      if (wf.terminatedEarly) {
        this.addAlert({
          level: 'CRITICAL',
          component: 'Workflow',
          message: `Workflow terminated early: ${wf.terminationReason}`,
          metric: 'terminatedEarly',
          value: wf.terminationReason || 'Unknown reason',
          recommendation: 'Review phase decision hooks and error handling logic',
        });
      }
    }

    // Analyze phase performance
    if (metrics.phases) {
      metrics.phases.forEach((phase: any, index: number) => {
        if (phase.executionTime > SLA_THRESHOLDS.maxPhaseExecutionTime) {
          this.addAlert({
            level: 'WARNING',
            component: `Phase ${index + 1}`,
            message: `Phase "${phase.phaseId}" execution time exceeded threshold`,
            metric: 'executionTime',
            value: phase.executionTime,
            threshold: SLA_THRESHOLDS.maxPhaseExecutionTime,
            recommendation: 'Consider enabling concurrent execution within the phase',
          });
        }

        if (phase.requestSuccessRate < SLA_THRESHOLDS.minSuccessRate) {
          this.addAlert({
            level: 'WARNING',
            component: `Phase ${index + 1}`,
            message: `Phase "${phase.phaseId}" has low success rate`,
            metric: 'requestSuccessRate',
            value: phase.requestSuccessRate,
            threshold: SLA_THRESHOLDS.minSuccessRate,
            recommendation: 'Review error logs and consider increasing retry attempts',
          });
        }
      });
    }

    // Analyze infrastructure health
    if (metrics.circuitBreaker) {
      const cb = metrics.circuitBreaker;

      if (cb.state === 'OPEN') {
        this.addAlert({
          level: 'CRITICAL',
          component: 'Circuit Breaker',
          message: 'Circuit breaker is OPEN - requests are being blocked',
          metric: 'state',
          value: 'OPEN',
          recommendation: `Wait ${cb.timeUntilRecovery}ms for automatic recovery or investigate underlying service issues`,
        });
      } else if (cb.state === 'HALF_OPEN') {
        this.addAlert({
          level: 'WARNING',
          component: 'Circuit Breaker',
          message: 'Circuit breaker in HALF_OPEN state - testing recovery',
          metric: 'state',
          value: 'HALF_OPEN',
          recommendation: 'Monitor next few requests to ensure service recovery',
        });
      }

      if (cb.failurePercentage > 40 && cb.totalRequests >= cb.config.minimumRequests) {
        this.addAlert({
          level: 'WARNING',
          component: 'Circuit Breaker',
          message: 'High failure rate detected',
          metric: 'failurePercentage',
          value: cb.failurePercentage,
          threshold: 40,
          recommendation: 'Service may be degraded - circuit breaker may trip soon',
        });
      }
    }

    // Analyze cache performance
    if (metrics.cache) {
      const cache = metrics.cache;

      if (cache.hitRate < 30 && cache.totalRequests > 10) {
        this.addAlert({
          level: 'INFO',
          component: 'Cache',
          message: 'Low cache hit rate',
          metric: 'hitRate',
          value: cache.hitRate,
          threshold: 30,
          recommendation: 'Consider increasing TTL or reviewing caching strategy',
        });
      }

      if (cache.utilizationPercentage > 90) {
        this.addAlert({
          level: 'WARNING',
          component: 'Cache',
          message: 'Cache near capacity',
          metric: 'utilizationPercentage',
          value: cache.utilizationPercentage,
          threshold: 90,
          recommendation: 'Consider increasing maxSize or implementing LRU eviction',
        });
      }

      if (cache.hitRate > 70) {
        this.addAlert({
          level: 'INFO',
          component: 'Cache',
          message: `Excellent cache performance - saved ${cache.networkRequestsSaved} network requests`,
          metric: 'networkRequestsSaved',
          value: cache.networkRequestsSaved,
          recommendation: 'Current caching strategy is effective',
        });
      }
    }

    // Analyze rate limiter
    if (metrics.rateLimiter) {
      const rl = metrics.rateLimiter;

      if (rl.throttleRate > 20) {
        this.addAlert({
          level: 'WARNING',
          component: 'Rate Limiter',
          message: 'High throttling rate detected',
          metric: 'throttleRate',
          value: rl.throttleRate,
          threshold: 20,
          recommendation: 'Consider increasing rate limit or optimizing request patterns',
        });
      }

      if (rl.peakQueueLength > 50) {
        this.addAlert({
          level: 'WARNING',
          component: 'Rate Limiter',
          message: 'Large request queue detected',
          metric: 'peakQueueLength',
          value: rl.peakQueueLength,
          threshold: 50,
          recommendation: 'Queue buildup may indicate rate limit too restrictive',
        });
      }
    }

    // Analyze concurrency limiter
    if (metrics.concurrencyLimiter) {
      const cl = metrics.concurrencyLimiter;

      if (cl.utilizationPercentage > 90) {
        this.addAlert({
          level: 'INFO',
          component: 'Concurrency Limiter',
          message: 'High concurrency utilization',
          metric: 'utilizationPercentage',
          value: cl.utilizationPercentage,
          threshold: 90,
          recommendation: 'Consider increasing concurrency limit for better throughput',
        });
      }

      if (cl.averageQueueWaitTime > 1000) {
        this.addAlert({
          level: 'WARNING',
          component: 'Concurrency Limiter',
          message: 'High average queue wait time',
          metric: 'averageQueueWaitTime',
          value: cl.averageQueueWaitTime,
          threshold: 1000,
          recommendation: 'Queue wait times suggest concurrency bottleneck',
        });
      }
    }

    return this.alerts;
  }

  private addAlert(alert: Alert): void {
    this.alerts.push(alert);
  }

  printAlerts(): void {
    if (this.alerts.length === 0) {
      console.log('\n✅ No alerts - all metrics within acceptable thresholds\n');
      return;
    }

    console.log('\n🚨 ALERTS & RECOMMENDATIONS\n');
    console.log('='.repeat(80));

    const critical = this.alerts.filter(a => a.level === 'CRITICAL');
    const warnings = this.alerts.filter(a => a.level === 'WARNING');
    const info = this.alerts.filter(a => a.level === 'INFO');

    if (critical.length > 0) {
      console.log('\n🔴 CRITICAL ALERTS:');
      critical.forEach(alert => this.printAlert(alert));
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  WARNING ALERTS:');
      warnings.forEach(alert => this.printAlert(alert));
    }

    if (info.length > 0) {
      console.log('\n ℹ️  INFO ALERTS:');
      info.forEach(alert => this.printAlert(alert));
    }

    console.log('\n' + '='.repeat(80));
  }

  private printAlert(alert: Alert): void {
    console.log(`\n  Component: ${alert.component}`);
    console.log(`  Message: ${alert.message}`);
    console.log(`  Metric: ${alert.metric} = ${alert.value}${alert.threshold ? ` (threshold: ${alert.threshold})` : ''}`);
    if (alert.recommendation) {
      console.log(`  💡 Recommendation: ${alert.recommendation}`);
    }
  }

  generateHealthScore(): number {
    const criticalCount = this.alerts.filter(a => a.level === 'CRITICAL').length;
    const warningCount = this.alerts.filter(a => a.level === 'WARNING').length;

    // Start with 100, deduct points for issues
    let score = 100;
    score -= criticalCount * 25; // -25 points per critical
    score -= warningCount * 10;  // -10 points per warning

    return Math.max(0, Math.min(100, score));
  }
}

// ============================================================================
// DASHBOARD DISPLAY
// ============================================================================

function printMetricsDashboard(systemMetrics: any): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 REAL-TIME METRICS DASHBOARD');
  console.log('='.repeat(80));

  // Workflow Summary
  if (systemMetrics.workflow) {
    const wf = systemMetrics.workflow;
    console.log('\n📈 WORKFLOW METRICS:');
    console.log(`  Workflow ID: ${wf.workflowId}`);
    console.log(`  Status: ${wf.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`  Total Execution Time: ${wf.executionTime}ms`);
    console.log(`  Timestamp: ${new Date(wf.timestamp).toLocaleString()}`);
    console.log(`\n  Phase Statistics:`);
    console.log(`    Total: ${wf.totalPhases} | Completed: ${wf.completedPhases} | Failed: ${wf.failedPhases} | Skipped: ${wf.skippedPhases}`);
    console.log(`    Completion Rate: ${wf.phaseCompletionRate.toFixed(2)}%`);
    console.log(`    Avg Execution Time: ${wf.averagePhaseExecutionTime.toFixed(2)}ms`);
    console.log(`\n  Request Statistics:`);
    console.log(`    Total: ${wf.totalRequests} | Successful: ${wf.successfulRequests} | Failed: ${wf.failedRequests}`);
    console.log(`    Success Rate: ${wf.requestSuccessRate.toFixed(2)}%`);
    console.log(`    Throughput: ${wf.throughput.toFixed(2)} req/sec`);
    
    if (wf.totalBranches) {
      console.log(`\n  Branch Statistics:`);
      console.log(`    Total: ${wf.totalBranches} | Completed: ${wf.completedBranches} | Failed: ${wf.failedBranches}`);
      console.log(`    Success Rate: ${wf.branchSuccessRate?.toFixed(2)}%`);
    }

    if (wf.terminatedEarly) {
      console.log(`\n  ⚠️  Early Termination: ${wf.terminationReason}`);
    }
  }

  // Phase-Level Metrics
  if (systemMetrics.phases && systemMetrics.phases.length > 0) {
    console.log('\n\n🔄 PHASE-LEVEL METRICS:');
    systemMetrics.phases.forEach((phase: any, index: number) => {
      const status = phase.skipped ? '⏭️  SKIPPED' : (phase.success ? '✅' : '❌');
      console.log(`\n  Phase ${index + 1}: ${phase.phaseId} ${status}`);
      console.log(`    Execution Time: ${phase.executionTime}ms`);
      console.log(`    Requests: ${phase.totalRequests} (${phase.successfulRequests} success, ${phase.failedRequests} failed)`);
      console.log(`    Success Rate: ${phase.requestSuccessRate.toFixed(2)}%`);
      
      if (phase.hasDecision && phase.decisionAction !== 'CONTINUE') {
        console.log(`    Decision: ${phase.decisionAction}${phase.targetPhaseId ? ` → ${phase.targetPhaseId}` : ''}`);
      }
    });
  }

  // Branch-Level Metrics
  if (systemMetrics.branches && systemMetrics.branches.length > 0) {
    console.log('\n\n🌿 BRANCH-LEVEL METRICS:');
    systemMetrics.branches.forEach((branch: any, index: number) => {
      const status = branch.skipped ? '⏭️  SKIPPED' : (branch.success ? '✅' : '❌');
      console.log(`\n  Branch ${index + 1}: ${branch.branchId} ${status}`);
      console.log(`    Execution Time: ${branch.executionTime}ms`);
      console.log(`    Phases: ${branch.totalPhases} (${branch.completedPhases} completed, ${branch.failedPhases} failed)`);
      console.log(`    Completion Rate: ${branch.phaseCompletionRate.toFixed(2)}%`);
      console.log(`    Requests: ${branch.totalRequests} (${branch.successfulRequests} success, ${branch.failedRequests} failed)`);
      console.log(`    Success Rate: ${branch.requestSuccessRate.toFixed(2)}%`);
    });
  }

  // Infrastructure Metrics
  console.log('\n\n⚙️  INFRASTRUCTURE METRICS:');

  if (systemMetrics.circuitBreaker) {
    const cb = systemMetrics.circuitBreaker;
    const stateEmoji = cb.state === 'CLOSED' ? '✅' : cb.state === 'OPEN' ? '🔴' : '⚠️';
    console.log(`\n  🔌 Circuit Breaker: ${stateEmoji} ${cb.state}`);
    console.log(`    Health: ${cb.isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`    Requests: ${cb.totalRequests} (${cb.successfulRequests} success, ${cb.failedRequests} failed)`);
    console.log(`    Failure Rate: ${cb.failurePercentage.toFixed(2)}%`);
    console.log(`    State Transitions: ${cb.stateTransitions}`);
    console.log(`    Time Since Last Change: ${cb.timeSinceLastStateChange}ms`);
    
    if (cb.isCurrentlyOpen && cb.timeUntilRecovery) {
      console.log(`    Recovery In: ${cb.timeUntilRecovery}ms`);
    }

    console.log(`    Recovery Stats: ${cb.successfulRecoveries} successful, ${cb.failedRecoveries} failed (${cb.recoverySuccessRate.toFixed(2)}% success)`);
  }

  if (systemMetrics.cache) {
    const cache = systemMetrics.cache;
    console.log(`\n  💾 Cache:`);
    console.log(`    Status: ${cache.isEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`    Size: ${cache.currentSize}/${cache.maxSize} (${cache.utilizationPercentage.toFixed(2)}% utilized)`);
    console.log(`    Entries: ${cache.validEntries} valid, ${cache.expiredEntries} expired`);
    console.log(`    Requests: ${cache.totalRequests} (${cache.hits} hits, ${cache.misses} misses)`);
    console.log(`    Hit Rate: ${cache.hitRate.toFixed(2)}%`);
    console.log(`    Network Requests Saved: ${cache.networkRequestsSaved}`);
    console.log(`    Cache Efficiency: ${cache.cacheEfficiency.toFixed(2)}%`);
    console.log(`    Avg Get Time: ${cache.averageGetTime.toFixed(2)}ms`);
    console.log(`    Avg Cache Age: ${cache.averageCacheAge.toFixed(2)}ms`);
  }

  if (systemMetrics.rateLimiter) {
    const rl = systemMetrics.rateLimiter;
    console.log(`\n  🚦 Rate Limiter:`);
    console.log(`    Limit: ${rl.maxRequests} requests per ${rl.windowMs}ms`);
    console.log(`    Available Tokens: ${rl.availableTokens}`);
    console.log(`    Queue Length: ${rl.queueLength}`);
    console.log(`    Status: ${rl.isThrottling ? '⚠️  Throttling' : '✅ Normal'}`);
    console.log(`    Requests: ${rl.totalRequests} (${rl.completedRequests} completed, ${rl.throttledRequests} throttled)`);
    console.log(`    Throttle Rate: ${rl.throttleRate.toFixed(2)}%`);
    console.log(`    Current Rate: ${rl.currentRequestRate.toFixed(2)} req/sec`);
    console.log(`    Peak Rate: ${rl.peakRequestRate.toFixed(2)} req/sec`);
    console.log(`    Utilization: ${rl.utilizationPercentage.toFixed(2)}%`);
  }

  if (systemMetrics.concurrencyLimiter) {
    const cl = systemMetrics.concurrencyLimiter;
    console.log(`\n  🔢 Concurrency Limiter:`);
    console.log(`    Limit: ${cl.limit}`);
    console.log(`    Running: ${cl.running} (${cl.utilizationPercentage.toFixed(2)}% utilized)`);
    console.log(`    Queue Length: ${cl.queueLength}`);
    console.log(`    Status: ${cl.isAtCapacity ? '⚠️  At Capacity' : '✅ Available'}`);
    console.log(`    Requests: ${cl.totalRequests} (${cl.completedRequests} completed, ${cl.failedRequests} failed)`);
    console.log(`    Success Rate: ${cl.successRate.toFixed(2)}%`);
    console.log(`    Peak Concurrency: ${cl.peakConcurrency}`);
    console.log(`    Avg Queue Wait: ${cl.averageQueueWaitTime.toFixed(2)}ms`);
    console.log(`    Avg Execution: ${cl.averageExecutionTime.toFixed(2)}ms`);
  }

  console.log('\n' + '='.repeat(80));
}

// ============================================================================
// EXAMPLE WORKFLOW WITH COMPREHENSIVE METRICS
// ============================================================================

async function runMetricsMonitoringExample() {
  console.log('🚀 Starting Real-Time Metrics Monitoring Example...\n');

  const workflowStartTime = Date.now();

  try {
    const result = await stableWorkflow(
      // Define multi-branch workflow for comprehensive metrics
      [],
      {
        workflowId: 'metrics-monitoring-demo',
        enableBranchExecution: true,
        branches: [
          {
            id: 'data-collection',
            markConcurrentBranch: false,
            phases: [
              {
                id: 'fetch-users',
                requests: [
                  {
                    id: 'users-list',
                    requestOptions: {
                      reqData: {
                        hostname: 'jsonplaceholder.typicode.com',
                        path: '/users',
                        method: REQUEST_METHODS.GET,
                      },
                      resReq: true,
                      attempts: 3,
                      wait: 500,
                      retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
                    },
                  },
                  {
                    id: 'users-detail-1',
                    requestOptions: {
                      reqData: {
                        hostname: 'jsonplaceholder.typicode.com',
                        path: '/users/1',
                        method: REQUEST_METHODS.GET,
                      },
                      resReq: true,
                    },
                  },
                  {
                    id: 'users-detail-2',
                    requestOptions: {
                      reqData: {
                        hostname: 'jsonplaceholder.typicode.com',
                        path: '/users/2',
                        method: REQUEST_METHODS.GET,
                      },
                      resReq: true,
                    },
                  },
                ],
                concurrentExecution: true,
                maxConcurrentRequests: 5,
              },
              {
                id: 'fetch-posts',
                requests: Array.from({ length: 15 }, (_, i) => ({
                  id: `post-${i + 1}`,
                  groupId: i < 5 ? 'high-priority' : 'normal-priority',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: `/posts/${i + 1}`,
                      method: REQUEST_METHODS.GET,
                    },
                    resReq: true,
                    attempts: 2,
                  },
                })),
                concurrentExecution: true,
                maxConcurrentRequests: 5,
              },
            ],
          },
          {
            id: 'data-processing',
            markConcurrentBranch: true,
            phases: [
              {
                id: 'fetch-comments',
                requests: Array.from({ length: 10 }, (_, i) => ({
                  id: `comment-${i + 1}`,
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: `/comments?postId=${i + 1}`,
                      method: REQUEST_METHODS.GET,
                    },
                    resReq: true,
                  },
                })),
                concurrentExecution: true,
              },
            ],
          },
          {
            id: 'data-enrichment',
            markConcurrentBranch: true,
            phases: [
              {
                id: 'fetch-albums',
                requests: Array.from({ length: 8 }, (_, i) => ({
                  id: `album-${i + 1}`,
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: `/albums/${i + 1}`,
                      method: REQUEST_METHODS.GET,
                    },
                    resReq: true,
                  },
                })),
                concurrentExecution: true,
              },
              {
                id: 'fetch-photos',
                requests: Array.from({ length: 5 }, (_, i) => ({
                  id: `photo-${i + 1}`,
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: `/photos?albumId=${i + 1}`,
                      method: REQUEST_METHODS.GET,
                    },
                    resReq: true,
                  },
                })),
                concurrentExecution: true,
              },
            ],
          },
        ],

        // Common configuration with all infrastructure components
        commonAttempts: 2,
        commonWait: 300,
        commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
        commonMaxAllowedWait: 5000,
        commonResReq: true,
        commonCache: {
          enabled: true,
          ttl: 30000,
          maxSize: 100,
        },

        // Request grouping for different priorities
        requestGroups: [
          {
            id: 'high-priority',
            commonConfig: {
              commonAttempts: 3,
              commonWait: 200,
              commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
            },
          },
          {
            id: 'normal-priority',
            commonConfig: {
              commonAttempts: 2,
              commonWait: 500,
              commonRetryStrategy: RETRY_STRATEGIES.LINEAR,
            },
          },
        ],

        // Infrastructure components
        circuitBreaker: {
          failureThresholdPercentage: 50,
          minimumRequests: 5,
          recoveryTimeoutMs: 10000,
          successThresholdPercentage: 60,
          halfOpenMaxRequests: 3,
        },
        rateLimit: {
          maxRequests: 50,
          windowMs: 10000,
        },
        maxConcurrentRequests: 10,

        // Workflow hooks for real-time monitoring
        handlePhaseCompletion: ({ phaseResult }) => {
          console.log(`\n✅ Phase completed: ${phaseResult.phaseId}`);
          console.log(`   Requests: ${phaseResult.successfulRequests}/${phaseResult.totalRequests} successful`);
          console.log(`   Execution time: ${phaseResult.executionTime}ms`);
        },

        handlePhaseError: ({ phaseResult, error }) => {
          console.log(`\n❌ Phase failed: ${phaseResult.phaseId}`);
          console.log(`   Error: ${error}`);
        },

        handleBranchCompletion: ({ branchId, success, branchResults }) => {
          const totalTime = branchResults.reduce((sum, p) => sum + p.executionTime, 0);
          console.log(`\n🌿 Branch completed: ${branchId} - ${success ? '✅ Success' : '❌ Failed'}`);
          console.log(`   Total execution time: ${totalTime}ms`);
        },

        sharedBuffer: {},
        logPhaseResults: false,
      }
    );

    const workflowEndTime = Date.now();

    // ========================================================================
    // EXTRACT AND ANALYZE ALL METRICS
    // ========================================================================

    console.log('\n\n' + '='.repeat(80));
    console.log('🔍 EXTRACTING COMPREHENSIVE METRICS...');
    console.log('='.repeat(80));

    // Aggregate all system metrics
    const systemMetrics = MetricsAggregator.aggregateSystemMetrics(
      result,
      circuitBreaker,
      cache,
      rateLimiter,
      concurrencyLimiter
    );

    // Display the dashboard
    printMetricsDashboard(systemMetrics);

    // ========================================================================
    // ANALYZE METRICS AND GENERATE ALERTS
    // ========================================================================

    const monitor = new MetricsMonitor();
    const alerts = monitor.analyzeWorkflowMetrics(systemMetrics);
    monitor.printAlerts();

    // ========================================================================
    // GENERATE HEALTH SCORE
    // ========================================================================

    const healthScore = monitor.generateHealthScore();
    console.log('\n' + '='.repeat(80));
    console.log('🏥 SYSTEM HEALTH SCORE');
    console.log('='.repeat(80));
    
    const scoreEmoji = healthScore >= 90 ? '🟢' : healthScore >= 70 ? '🟡' : '🔴';
    const scoreStatus = healthScore >= 90 ? 'EXCELLENT' : healthScore >= 70 ? 'GOOD' : healthScore >= 50 ? 'FAIR' : 'POOR';
    
    console.log(`\n  ${scoreEmoji} Overall Health Score: ${healthScore}/100 (${scoreStatus})`);
    console.log(`\n  Interpretation:`);
    console.log(`    90-100: Excellent - System performing optimally`);
    console.log(`    70-89:  Good - Minor issues detected`);
    console.log(`    50-69:  Fair - Multiple issues requiring attention`);
    console.log(`    0-49:   Poor - Critical issues affecting performance`);

    // ========================================================================
    // PERFORMANCE SUMMARY
    // ========================================================================

    console.log('\n\n' + '='.repeat(80));
    console.log('📊 PERFORMANCE SUMMARY');
    console.log('='.repeat(80));

    if (result.metrics) {
      console.log(`\n  ⏱️  Timing:`);
      console.log(`    Total Workflow Time: ${result.executionTime}ms`);
      console.log(`    Average Phase Time: ${result.metrics.averagePhaseExecutionTime.toFixed(2)}ms`);
      console.log(`    Throughput: ${result.metrics.throughput.toFixed(2)} requests/second`);

      console.log(`\n  📈 Success Rates:`);
      console.log(`    Phase Completion Rate: ${result.metrics.phaseCompletionRate.toFixed(2)}%`);
      console.log(`    Request Success Rate: ${result.metrics.requestSuccessRate.toFixed(2)}%`);

      console.log(`\n  🔢 Volume:`);
      console.log(`    Total Phases: ${result.totalPhases}`);
      console.log(`    Total Requests: ${result.totalRequests}`);
      console.log(`    Successful Requests: ${result.successfulRequests}`);
      console.log(`    Failed Requests: ${result.failedRequests}`);

      if (result.branches) {
        console.log(`\n  🌿 Branches:`);
        console.log(`    Total Branches: ${result.branches.length}`);
        console.log(`    Concurrent Branches: ${result.branches.filter(b => !b.skipped).length}`);
      }

      if (systemMetrics.cache && systemMetrics.cache.isEnabled) {
        console.log(`\n  💾 Cache Impact:`);
        console.log(`    Network Requests Saved: ${systemMetrics.cache.networkRequestsSaved}`);
        console.log(`    Hit Rate: ${systemMetrics.cache.hitRate.toFixed(2)}%`);
        console.log(`    Efficiency: ${systemMetrics.cache.cacheEfficiency.toFixed(2)}%`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Metrics monitoring example completed in ${workflowEndTime - workflowStartTime}ms\n`);

  } catch (error) {
    console.error('\n❌ Workflow failed:', error);
    throw error;
  }
}

// ============================================================================
// RUN EXAMPLE
// ============================================================================

runMetricsMonitoringExample().catch(console.error);
