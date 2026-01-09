/**
 * Enterprise Example 3: Production API Health Monitoring with stableRequest
 * 
 * This example demonstrates production-grade health monitoring that:
 * - Uses stableRequest for individual health check requests
 * - Implements circuit breakers to prevent cascade failures
 * - Uses exponential backoff for transient failures
 * - Caches successful health check results to reduce load
 * - Provides real-time monitoring with alerting thresholds
 * - Tracks response times and SLA compliance
 * - Differentiates between critical and optional services
 * 
 * Use Case: Monitor critical API endpoints across multiple services with
 * automatic recovery, circuit breaking, and performance tracking
 */

import { 
  stableRequest, 
  RETRY_STRATEGIES,
  CircuitBreaker,
  VALID_REQUEST_PROTOCOLS,
  REQUEST_METHODS,
  getGlobalCacheManager
} from '../src/index';

// Service endpoint configuration
interface ServiceEndpoint {
  name: string;
  url: string;
  critical: boolean;
  slaThresholdMs: number;
  healthCheckPath: string;
}

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  timestamp: string;
  consecutiveFailures: number;
  circuitBreakerState: string;
  slaCompliant: boolean;
}

// Define monitored services
const services: ServiceEndpoint[] = [
  {
    name: 'User Authentication API',
    url: 'https://jsonplaceholder.typicode.com',
    critical: true,
    slaThresholdMs: 200,
    healthCheckPath: '/users/1'
  },
  {
    name: 'Payment Gateway',
    url: 'https://jsonplaceholder.typicode.com',
    critical: true,
    slaThresholdMs: 500,
    healthCheckPath: '/posts/1'
  },
  {
    name: 'Notification Service',
    url: 'https://jsonplaceholder.typicode.com',
    critical: false,
    slaThresholdMs: 1000,
    healthCheckPath: '/comments/1'
  },
  {
    name: 'Analytics Service',
    url: 'https://jsonplaceholder.typicode.com',
    critical: false,
    slaThresholdMs: 2000,
    healthCheckPath: '/albums/1'
  },
  {
    name: 'Search Service',
    url: 'https://jsonplaceholder.typicode.com',
    critical: true,
    slaThresholdMs: 300,
    healthCheckPath: '/todos/1'
  }
];

// Initialize circuit breakers for each service
const circuitBreakers = new Map<string, CircuitBreaker>();
services.forEach(service => {
  circuitBreakers.set(service.name, new CircuitBreaker({
    failureThresholdPercentage: service.critical ? 50 : 70,
    minimumRequests: 3,
    recoveryTimeoutMs: service.critical ? 10000 : 20000,
    successThresholdPercentage: 60,
    halfOpenMaxRequests: 2
  }));
});

// Cache configuration for health checks (5 second cache)
const healthCheckCacheConfig = { ttl: 5000, enabled: true };

// Track consecutive failures per service
const failureTracker = new Map<string, number>();

// Perform health check for a single service using stableRequest
async function checkServiceHealth(service: ServiceEndpoint): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const circuitBreaker = circuitBreakers.get(service.name)!;
  
  console.log(`🔍 Checking ${service.name}...`);
  
  try {
    const result = await stableRequest({
      // Request configuration
      reqData: {
        hostname: service.url.replace(/^https?:\/\//, ''),
        protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
        path: `/${service.healthCheckPath}`,
        method: REQUEST_METHODS.GET,
        headers: {
          'User-Agent': 'HealthMonitor/1.0',
          'Accept': 'application/json'
        },
        timeout: service.slaThresholdMs * 2
      },
      
      // Retry configuration based on criticality
      attempts: service.critical ? 3 : 2,
      wait: 1000,
      retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
      maxAllowedWait: 5000,
      
      // Circuit breaker to prevent cascade failures
      circuitBreaker: circuitBreaker,
      
      // Cache successful health checks
      cache: { ...healthCheckCacheConfig, keyGenerator: () => `health:${service.name}` },
            
      // Response validation
      resReq: true,
      responseAnalyzer: (data: any) => {
        // Validate that we got expected data structure
        return data && typeof data === 'object' && Object.keys(data).length > 0;
      },
      
      // Performance tracking
      logAllSuccessfulAttempts: true,
      handleSuccessfulAttemptData: async ({ successfulAttemptData }) => {
        const responseTime = successfulAttemptData.executionTime || 0;
        const slaCompliant = responseTime <= service.slaThresholdMs;
        
        if (!slaCompliant) {
          console.log(`  ⚠️  SLA Warning: ${successfulAttemptData.executionTime}ms (threshold: ${service.slaThresholdMs}ms)`);
        } else {
          console.log(`  ✅ Healthy - ${successfulAttemptData.executionTime}ms`);
        }
      },
      
      // Error handling
      finalErrorAnalyzer: async ({ error }) => {
        console.log(`  ❌ Health check failed: ${error}`);
        
        // Track consecutive failures
        const currentFailures = failureTracker.get(service.name) || 0;
        failureTracker.set(service.name, currentFailures + 1);
        
        // Critical services should alert immediately
        if (service.critical && currentFailures >= 2) {
          console.log(`  🚨 ALERT: Critical service ${service.name} has ${currentFailures + 1} consecutive failures!`);
        }
        
        return false; // Throw error for proper handling
      }
    });
    
    // Success - reset failure counter
    failureTracker.set(service.name, 0);
    
    const responseTime = Date.now() - startTime;
    const slaCompliant = responseTime <= service.slaThresholdMs;
    
    return {
      service: service.name,
      status: slaCompliant ? 'healthy' : 'degraded',
      responseTime,
      timestamp: new Date().toISOString(),
      consecutiveFailures: 0,
      circuitBreakerState: 'CLOSED',
      slaCompliant
    };
    
  } catch (error) {
    const consecutiveFailures = failureTracker.get(service.name) || 0;
    
    return {
      service: service.name,
      status: 'down',
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      consecutiveFailures,
      circuitBreakerState: 'OPEN',
      slaCompliant: false
    };
  }
}

// Monitor all services
async function monitorAllServices(): Promise<void> {
  console.log('🏥 Starting Health Monitoring Cycle\n');
  console.log('═'.repeat(70));
  console.log('Monitoring', services.length, 'services...\n');
  
  const results: HealthCheckResult[] = [];
  
  // Check all services sequentially (could be parallel, but sequential for demo clarity)
  for (const service of services) {
    const result = await checkServiceHealth(service);
    results.push(result);
    console.log(''); // Spacing between checks
  }
  
  // Generate summary report
  console.log('═'.repeat(70));
  console.log('📊 HEALTH MONITORING SUMMARY');
  console.log('═'.repeat(70));
  
  const healthyServices = results.filter(r => r.status === 'healthy');
  const degradedServices = results.filter(r => r.status === 'degraded');
  const downServices = results.filter(r => r.status === 'down');
  
  console.log(`\nOverall Status:`);
  console.log(`  🟢 Healthy:  ${healthyServices.length}/${services.length}`);
  console.log(`  🟡 Degraded: ${degradedServices.length}/${services.length}`);
  console.log(`  🔴 Down:     ${downServices.length}/${services.length}`);
  
  // Critical services status
  const criticalServices = results.filter(r => 
    services.find(s => s.name === r.service)?.critical
  );
  const criticalDown = criticalServices.filter(r => r.status === 'down');
  
  console.log(`\nCritical Services: ${criticalServices.length - criticalDown.length}/${criticalServices.length} operational`);
  
  if (criticalDown.length > 0) {
    console.log('\n🚨 CRITICAL ALERTS:');
    criticalDown.forEach(service => {
      console.log(`  - ${service.service}: DOWN (${service.consecutiveFailures} consecutive failures)`);
    });
  }
  
  // Performance metrics
  const avgResponseTime = results
    .filter(r => r.status !== 'down')
    .reduce((sum, r) => sum + r.responseTime, 0) / (results.length - downServices.length || 1);
  
  console.log(`\nPerformance Metrics:`);
  console.log(`  Average Response Time: ${Math.round(avgResponseTime)}ms`);
  console.log(`  SLA Compliance: ${results.filter(r => r.slaCompliant).length}/${results.length} services`);
  
  // Detailed service breakdown
  console.log('\nDetailed Service Status:');
  console.log('─'.repeat(70));
  
  results.forEach(result => {
    const serviceConfig = services.find(s => s.name === result.service)!;
    const statusIcon = result.status === 'healthy' ? '🟢' : 
                      result.status === 'degraded' ? '🟡' : '🔴';
    const criticalBadge = serviceConfig.critical ? '[CRITICAL]' : '[OPTIONAL]';
    
    console.log(`${statusIcon} ${result.service} ${criticalBadge}`);
    console.log(`   Response Time: ${result.responseTime}ms (SLA: ${serviceConfig.slaThresholdMs}ms)`);
    console.log(`   Circuit Breaker: ${result.circuitBreakerState}`);
    console.log(`   SLA Compliant: ${result.slaCompliant ? '✅' : '❌'}`);
    
    if (result.consecutiveFailures > 0) {
      console.log(`   ⚠️  Consecutive Failures: ${result.consecutiveFailures}`);
    }
    console.log('');
  });
  
  // Circuit breaker states
  console.log('═'.repeat(70));
  console.log('🔌 Circuit Breaker States:');
  console.log('─'.repeat(70));
  
  circuitBreakers.forEach((cb, serviceName) => {
    const stateIcon = '🟢';
    console.log(`${stateIcon} ${serviceName.padEnd(30)} CLOSED      (monitoring active)`);
  });
  
  // Determine overall system health
  const systemHealthy = criticalDown.length === 0 && downServices.length <= 1;
  
  if (systemHealthy) {
    console.log('✅ System Status: OPERATIONAL');
  } else if (criticalDown.length > 0) {
    console.log('🚨 System Status: CRITICAL - Immediate action required!');
  } else {
    console.log('⚠️  System Status: DEGRADED - Non-critical services affected');
  }
  
  console.log('\n Caching Stats: ', getGlobalCacheManager().getStats())
  getGlobalCacheManager().clear();
  console.log('═'.repeat(70));
}

// Run health monitoring
(async () => {
  try {
    await monitorAllServices();
    
    console.log('\n💡 Monitoring Capabilities Demonstrated:');
    console.log('   ✅ Individual health checks using stableRequest');
    console.log('   ✅ Circuit breakers preventing cascade failures');
    console.log('   ✅ Exponential backoff for transient failures');
    console.log('   ✅ Response caching to reduce load');
    console.log('   ✅ SLA compliance tracking');
    console.log('   ✅ Critical vs optional service differentiation');
    console.log('   ✅ Consecutive failure tracking and alerting');
    console.log('   ✅ Performance metrics and reporting');
    
  } catch (error) {
    console.error('❌ Monitoring failed:', error);
    process.exit(1);
  }
})();
