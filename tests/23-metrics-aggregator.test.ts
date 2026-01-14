import { describe, it, expect } from '@jest/globals';
import {
    MetricsAggregator,
    CircuitBreaker,
    CacheManager,
    RateLimiter,
    ConcurrencyLimiter
} from '../src/utilities/index.js';
import type {
    STABLE_WORKFLOW_RESULT,
    STABLE_WORKFLOW_PHASE_RESULT,
    API_GATEWAY_RESPONSE,
    API_GATEWAY_RESULT,
    BranchExecutionResult,
    STABLE_REQUEST_RESULT,
} from '../src/types/index.js';
import { CircuitBreakerState, PHASE_DECISION_ACTIONS, RESPONSE_ERRORS } from '../src/enums/index.js';

describe('Metrics Aggregator - Complete Dashboard Metrics', () => {
    describe('1. Workflow-Level Metrics', () => {
        it('should extract all workflow metrics correctly', () => {
            const workflowResult: STABLE_WORKFLOW_RESULT = {
                workflowId: 'wf-123',
                success: true,
                executionTime: 2300,
                timestamp: new Date().toISOString(),
                totalPhases: 5,
                completedPhases: 5,
                totalRequests: 23,
                successfulRequests: 22,
                failedRequests: 1,
                phases: [
                    {
                        workflowId: 'wf-123',
                        phaseId: 'phase-1',
                        phaseIndex: 0,
                        success: true,
                        executionTime: 450,
                        timestamp: new Date().toISOString(),
                        totalRequests: 5,
                        successfulRequests: 5,
                        failedRequests: 0,
                        responses: []
                    },
                    {
                        workflowId: 'wf-123',
                        phaseId: 'phase-2',
                        phaseIndex: 1,
                        success: true,
                        executionTime: 500,
                        timestamp: new Date().toISOString(),
                        totalRequests: 6,
                        successfulRequests: 6,
                        failedRequests: 0,
                        responses: [],
                        skipped: false
                    },
                    {
                        workflowId: 'wf-123',
                        phaseId: 'phase-3',
                        phaseIndex: 2,
                        success: true,
                        executionTime: 400,
                        timestamp: new Date().toISOString(),
                        totalRequests: 4,
                        successfulRequests: 4,
                        failedRequests: 0,
                        responses: [],
                        skipped: true
                    },
                    {
                        workflowId: 'wf-123',
                        phaseId: 'phase-4',
                        phaseIndex: 3,
                        success: false,
                        executionTime: 300,
                        timestamp: new Date().toISOString(),
                        totalRequests: 3,
                        successfulRequests: 2,
                        failedRequests: 1,
                        responses: []
                    },
                    {
                        workflowId: 'wf-123',
                        phaseId: 'phase-5',
                        phaseIndex: 4,
                        success: true,
                        executionTime: 650,
                        timestamp: new Date().toISOString(),
                        totalRequests: 5,
                        successfulRequests: 5,
                        failedRequests: 0,
                        responses: []
                    }
                ],
                executionHistory: [
                    {
                        phaseId: 'phase-1',
                        phaseIndex: 0,
                        executionNumber: 0,
                        timestamp: new Date().toISOString(),
                        success: true,
                        executionTime: 450
                    },
                    {
                        phaseId: 'phase-2',
                        phaseIndex: 1,
                        executionNumber: 0,
                        timestamp: new Date().toISOString(),
                        success: true,
                        executionTime: 500
                    },
                    {
                        phaseId: 'phase-1',
                        phaseIndex: 0,
                        executionNumber: 1,
                        timestamp: new Date().toISOString(),
                        success: true,
                        executionTime: 430
                    }
                ],
                terminatedEarly: false
            };

            const metrics = MetricsAggregator.extractWorkflowMetrics(workflowResult);

            expect(metrics.workflowId).toBe('wf-123');
            expect(metrics.success).toBe(true);
            expect(metrics.executionTime).toBe(2300);
            expect(metrics.totalPhases).toBe(5);
            expect(metrics.completedPhases).toBe(5);
            expect(metrics.skippedPhases).toBe(1);
            expect(metrics.failedPhases).toBe(1);
            expect(metrics.phaseCompletionRate).toBe(100);
            expect(metrics.totalRequests).toBe(23);
            expect(metrics.successfulRequests).toBe(22);
            expect(metrics.failedRequests).toBe(1);
            expect(metrics.requestSuccessRate).toBeCloseTo(95.65, 1);
            expect(metrics.requestFailureRate).toBeCloseTo(4.35, 1);
            expect(metrics.terminatedEarly).toBe(false);
            expect(metrics.totalPhaseReplays).toBeGreaterThan(0);
            expect(metrics.throughput).toBeGreaterThan(0);
            expect(metrics.averagePhaseExecutionTime).toBeGreaterThan(0);
        });

        it('should handle workflow with branches', () => {
            const workflowResult: STABLE_WORKFLOW_RESULT = {
                workflowId: 'wf-456',
                success: true,
                executionTime: 1500,
                timestamp: new Date().toISOString(),
                totalPhases: 6,
                completedPhases: 6,
                totalRequests: 18,
                successfulRequests: 17,
                failedRequests: 1,
                phases: [],
                executionHistory: [],
                branches: [
                    {
                        workflowId: 'wf-456',
                        branchId: 'branch-1',
                        branchIndex: 0,
                        success: true,
                        executionTime: 800,
                        completedPhases: 3,
                        phaseResults: [],
                        executionNumber: 0
                    },
                    {
                        workflowId: 'wf-456',
                        branchId: 'branch-2',
                        branchIndex: 1,
                        success: false,
                        executionTime: 700,
                        completedPhases: 2,
                        phaseResults: [],
                        executionNumber: 0
                    },
                    {
                        workflowId: 'wf-456',
                        branchId: 'branch-3',
                        branchIndex: 2,
                        success: true,
                        executionTime: 900,
                        completedPhases: 1,
                        phaseResults: [],
                        executionNumber: 0,
                        skipped: true
                    }
                ]
            };

            const metrics = MetricsAggregator.extractWorkflowMetrics(workflowResult);

            expect(metrics.totalBranches).toBe(3);
            expect(metrics.completedBranches).toBe(1); // Only non-skipped successful branches
            expect(metrics.failedBranches).toBe(1);
            expect(metrics.branchSuccessRate).toBeCloseTo(33.33, 1);
        });
    });

    describe('2. Branch-Level Metrics', () => {
        it('should extract all branch metrics correctly', () => {
            const branch: BranchExecutionResult = {
                workflowId: 'wf-789',
                branchId: 'branch-1',
                branchIndex: 0,
                success: true,
                executionTime: 1200,
                completedPhases: 3,
                executionNumber: 0,
                phaseResults: [
                    {
                        workflowId: 'wf-789',
                        branchId: 'branch-1',
                        phaseId: 'phase-1',
                        phaseIndex: 0,
                        success: true,
                        executionTime: 400,
                        timestamp: new Date().toISOString(),
                        totalRequests: 5,
                        successfulRequests: 5,
                        failedRequests: 0,
                        responses: []
                    },
                    {
                        workflowId: 'wf-789',
                        branchId: 'branch-1',
                        phaseId: 'phase-2',
                        phaseIndex: 1,
                        success: true,
                        executionTime: 500,
                        timestamp: new Date().toISOString(),
                        totalRequests: 8,
                        successfulRequests: 7,
                        failedRequests: 1,
                        responses: []
                    },
                    {
                        workflowId: 'wf-789',
                        branchId: 'branch-1',
                        phaseId: 'phase-3',
                        phaseIndex: 2,
                        success: false,
                        executionTime: 300,
                        timestamp: new Date().toISOString(),
                        totalRequests: 4,
                        successfulRequests: 2,
                        failedRequests: 2,
                        responses: [],
                        skipped: true
                    }
                ],
                decision: {
                    action: PHASE_DECISION_ACTIONS.CONTINUE 
                }
            };

            const metrics = MetricsAggregator.extractBranchMetrics(branch);

            expect(metrics.branchId).toBe('branch-1');
            expect(metrics.branchIndex).toBe(0);
            expect(metrics.executionNumber).toBe(0);
            expect(metrics.success).toBe(true);
            expect(metrics.executionTime).toBe(1200);
            expect(metrics.skipped).toBe(false);
            expect(metrics.totalPhases).toBe(3);
            expect(metrics.completedPhases).toBe(3);
            expect(metrics.failedPhases).toBe(0);
            expect(metrics.phaseCompletionRate).toBe(100);
            expect(metrics.totalRequests).toBe(17);
            expect(metrics.successfulRequests).toBe(14);
            expect(metrics.failedRequests).toBe(3);
            expect(metrics.requestSuccessRate).toBeCloseTo(82.35, 1);
            expect(metrics.hasDecision).toBe(true);
            expect(metrics.decisionAction).toBe(PHASE_DECISION_ACTIONS.CONTINUE);
        });
    });

    describe('3. Phase-Level Metrics', () => {
        it('should extract all phase metrics correctly', () => {
            const phase: STABLE_WORKFLOW_PHASE_RESULT = {
                workflowId: 'wf-001',
                phaseId: 'authentication',
                phaseIndex: 0,
                branchId: 'branch-1',
                success: true,
                executionTime: 450,
                timestamp: new Date().toISOString(),
                totalRequests: 3,
                successfulRequests: 3,
                failedRequests: 0,
                responses: [],
                executionNumber: 1,
                skipped: false,
                decision: {
                    action: PHASE_DECISION_ACTIONS.CONTINUE ,
                    replayCount: 1
                }
            };

            const metrics = MetricsAggregator.extractPhaseMetrics(phase);

            expect(metrics.phaseId).toBe('authentication');
            expect(metrics.phaseIndex).toBe(0);
            expect(metrics.workflowId).toBe('wf-001');
            expect(metrics.branchId).toBe('branch-1');
            expect(metrics.executionNumber).toBe(1);
            expect(metrics.success).toBe(true);
            expect(metrics.skipped).toBe(false);
            expect(metrics.executionTime).toBe(450);
            expect(metrics.totalRequests).toBe(3);
            expect(metrics.successfulRequests).toBe(3);
            expect(metrics.failedRequests).toBe(0);
            expect(metrics.requestSuccessRate).toBe(100);
            expect(metrics.requestFailureRate).toBe(0);
            expect(metrics.hasDecision).toBe(true);
            expect(metrics.decisionAction).toBe(PHASE_DECISION_ACTIONS.CONTINUE);
            expect(metrics.replayCount).toBe(1);
        });
    });

    describe('4. Request Group Metrics', () => {
        it('should extract metrics for all request groups', () => {
            const responses: API_GATEWAY_RESPONSE[] = [
                { requestId: 'req-1', groupId: 'critical', success: true },
                { requestId: 'req-2', groupId: 'critical', success: true },
                { requestId: 'req-3', groupId: 'critical', success: false, error: 'Timeout' },
                { requestId: 'req-4', groupId: 'normal', success: true },
                { requestId: 'req-5', groupId: 'normal', success: true },
                { requestId: 'req-6', success: true },
                { requestId: 'req-7', success: false, error: 'Network error' }
            ];

            const groupMetrics = MetricsAggregator.extractRequestGroupMetrics(responses);

            const criticalGroup = groupMetrics.find(g => g.groupId === 'critical');
            expect(criticalGroup).toBeDefined();
            expect(criticalGroup!.totalRequests).toBe(3);
            expect(criticalGroup!.successfulRequests).toBe(2);
            expect(criticalGroup!.failedRequests).toBe(1);
            expect(criticalGroup!.successRate).toBeCloseTo(66.67, 1);
            expect(criticalGroup!.failureRate).toBeCloseTo(33.33, 1);

            const normalGroup = groupMetrics.find(g => g.groupId === 'normal');
            expect(normalGroup).toBeDefined();
            expect(normalGroup!.totalRequests).toBe(2);
            expect(normalGroup!.successfulRequests).toBe(2);
            expect(normalGroup!.successRate).toBe(100);

            const defaultGroup = groupMetrics.find(g => g.groupId === 'default');
            expect(defaultGroup).toBeDefined();
            expect(defaultGroup!.totalRequests).toBe(2);
        });
    });

    describe('5. Individual Request Metrics', () => {
        it('should extract metrics for individual requests', () => {
            const responses: API_GATEWAY_RESPONSE[] = [
                { requestId: 'req-1', groupId: 'critical', success: true },
                { requestId: 'req-2', groupId: 'critical', success: false, error: 'Timeout' },
                { requestId: 'req-3', success: true }
            ];

            const requestMetrics = MetricsAggregator.extractRequestMetrics(responses);

            expect(requestMetrics).toHaveLength(3);
            expect(requestMetrics[0].requestId).toBe('req-1');
            expect(requestMetrics[0].groupId).toBe('critical');
            expect(requestMetrics[0].success).toBe(true);
            expect(requestMetrics[0].hasError).toBe(false);

            expect(requestMetrics[1].requestId).toBe('req-2');
            expect(requestMetrics[1].success).toBe(false);
            expect(requestMetrics[1].hasError).toBe(true);
            expect(requestMetrics[1].errorMessage).toBe('Timeout');
        });
    });

    describe('6. Circuit Breaker Metrics', () => {
        it('should extract comprehensive circuit breaker metrics', async () => {
            const circuitBreaker = new CircuitBreaker({
                failureThresholdPercentage: 50,
                minimumRequests: 5,
                recoveryTimeoutMs: 1000,
                successThresholdPercentage: 50,
                halfOpenMaxRequests: 3
            });

            // Simulate some requests
            circuitBreaker.recordSuccess();
            circuitBreaker.recordSuccess();
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();

            const metrics = MetricsAggregator.extractCircuitBreakerMetrics(circuitBreaker);

            expect(metrics.state).toBe(CircuitBreakerState.OPEN);
            expect(metrics.isHealthy).toBe(false);
            expect(metrics.totalRequests).toBe(6);
            expect(metrics.successfulRequests).toBe(2);
            expect(metrics.failedRequests).toBe(4);
            expect(metrics.failurePercentage).toBeCloseTo(66.67, 1);
            expect(metrics.stateTransitions).toBeGreaterThan(0);
            expect(metrics.isCurrentlyOpen).toBe(true);
            expect(metrics.openCount).toBe(1);
            expect(metrics.openUntil).toBeGreaterThan(Date.now());
            expect(metrics.timeUntilRecovery).toBeGreaterThan(0);
            expect(metrics.config).toBeDefined();
            expect(metrics.config.failureThresholdPercentage).toBe(50);
        });

        it('should track recovery metrics', async () => {
            const circuitBreaker = new CircuitBreaker({
                failureThresholdPercentage: 50,
                minimumRequests: 3,
                recoveryTimeoutMs: 100,
                successThresholdPercentage: 50,
                halfOpenMaxRequests: 2
            });

            // Open the circuit
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();

            expect(circuitBreaker.getState().state).toBe(CircuitBreakerState.OPEN);

            // Wait for recovery timeout
            await new Promise(resolve => setTimeout(resolve, 150));

            // Transition to half-open
            await circuitBreaker.canExecute();
            
            // Successful recovery
            circuitBreaker.recordSuccess();
            circuitBreaker.recordSuccess();

            const metrics = MetricsAggregator.extractCircuitBreakerMetrics(circuitBreaker);

            expect(metrics.recoveryAttempts).toBeGreaterThan(0);
            expect(metrics.successfulRecoveries).toBeGreaterThan(0);
            expect(metrics.averageOpenDuration).toBeGreaterThan(0);
        });
    });

    describe('7. Cache Metrics', () => {
        it('should extract comprehensive cache metrics', () => {
            const cache = new CacheManager({
                enabled: true,
                ttl: 60000,
                maxSize: 10
            });

            // Simulate cache operations
            const mockConfig1 = { url: 'https://api.example.com/users', method: 'GET' };
            const mockConfig2 = { url: 'https://api.example.com/posts', method: 'GET' };
            const mockConfig3 = { url: 'https://api.example.com/comments', method: 'GET' };

            cache.set(mockConfig1, { data: 'user' }, 200, 'OK', {});
            cache.set(mockConfig2, { data: 'post' }, 200, 'OK', {});
            cache.set(mockConfig3, { data: 'comment' }, 200, 'OK', {});

            cache.get(mockConfig1); // hit
            cache.get(mockConfig1); // hit
            cache.get(mockConfig2); // hit
            cache.get({ url: 'https://api.example.com/unknown', method: 'GET' }); // miss

            const metrics = MetricsAggregator.extractCacheMetrics(cache);

            expect(metrics.isEnabled).toBe(true);
            expect(metrics.currentSize).toBe(3);
            expect(metrics.maxSize).toBe(10);
            expect(metrics.utilizationPercentage).toBe(30);
            expect(metrics.totalRequests).toBe(4);
            expect(metrics.hits).toBe(3);
            expect(metrics.misses).toBe(1);
            expect(metrics.hitRate).toBe(75);
            expect(metrics.missRate).toBe(25);
            expect(metrics.sets).toBe(3);
            expect(metrics.networkRequestsSaved).toBe(3);
            expect(metrics.cacheEfficiency).toBe(75);
            expect(metrics.averageGetTime).toBeGreaterThanOrEqual(0);
            expect(metrics.averageSetTime).toBeGreaterThanOrEqual(0);
        });

        it('should track evictions and expirations', async () => {
            const cache = new CacheManager({
                enabled: true,
                ttl: 100,
                maxSize: 2
            });

            const mockConfig1 = { url: 'https://api.example.com/1', method: 'GET' };
            const mockConfig2 = { url: 'https://api.example.com/2', method: 'GET' };
            const mockConfig3 = { url: 'https://api.example.com/3', method: 'GET' };

            cache.set(mockConfig1, { data: '1' }, 200, 'OK', {});
            cache.set(mockConfig2, { data: '2' }, 200, 'OK', {});
            cache.set(mockConfig3, { data: '3' }, 200, 'OK', {}); // Should evict mockConfig1

            const metrics1 = MetricsAggregator.extractCacheMetrics(cache);
            expect(metrics1.evictions).toBe(1);

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 150));
            
            cache.get(mockConfig2); // Should expire

            const metrics2 = MetricsAggregator.extractCacheMetrics(cache);
            expect(metrics2.expirations).toBe(1);
        });
    });

    describe('8. Rate Limiter Metrics', () => {
        it('should extract comprehensive rate limiter metrics', async () => {
            const rateLimiter = new RateLimiter(3, 1000);

            // Execute some requests
            const requests = [
                () => Promise.resolve('result-1'),
                () => Promise.resolve('result-2'),
                () => Promise.resolve('result-3'),
                () => Promise.resolve('result-4')
            ];

            const promise = Promise.all(requests.map(fn => rateLimiter.execute(fn)));

            // Give some time for requests to queue
            await new Promise(resolve => setTimeout(resolve, 50));

            const metrics = MetricsAggregator.extractRateLimiterMetrics(rateLimiter);

            expect(metrics.maxRequests).toBe(3);
            expect(metrics.windowMs).toBe(1000);
            expect(metrics.totalRequests).toBeGreaterThan(0);
            expect(metrics.requestsInCurrentWindow).toBeGreaterThan(0);

            await promise;

            const finalMetrics = MetricsAggregator.extractRateLimiterMetrics(rateLimiter);
            expect(finalMetrics.completedRequests).toBe(4);
            expect(finalMetrics.throttledRequests).toBeGreaterThanOrEqual(1);
            expect(finalMetrics.throttleRate).toBeGreaterThan(0);
        });

        it('should track peak metrics', async () => {
            const rateLimiter = new RateLimiter(2, 1000);

            const requests = Array.from({ length: 10 }, (_, i) => 
                () => Promise.resolve(`result-${i}`)
            );

            await Promise.all(requests.map(fn => rateLimiter.execute(fn)));

            const metrics = MetricsAggregator.extractRateLimiterMetrics(rateLimiter);

            expect(metrics.peakQueueLength).toBeGreaterThan(0);
            expect(metrics.peakRequestRate).toBeGreaterThan(0);
            expect(metrics.averageQueueWaitTime).toBeGreaterThanOrEqual(0);
        });
    });

    describe('9. Concurrency Limiter Metrics', () => {
        it('should extract comprehensive concurrency limiter metrics', async () => {
            const concurrencyLimiter = new ConcurrencyLimiter(2);

            // Execute some concurrent requests
            const requests = [
                () => new Promise(resolve => setTimeout(() => resolve('result-1'), 100)),
                () => new Promise(resolve => setTimeout(() => resolve('result-2'), 100)),
                () => new Promise(resolve => setTimeout(() => resolve('result-3'), 100)),
                () => new Promise(resolve => setTimeout(() => resolve('result-4'), 100))
            ];

            const promise = Promise.all(requests.map(fn => concurrencyLimiter.execute(fn)));

            // Check metrics while running
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const runningMetrics = MetricsAggregator.extractConcurrencyLimiterMetrics(concurrencyLimiter);
            expect(runningMetrics.limit).toBe(2);
            expect(runningMetrics.running).toBeLessThanOrEqual(2);
            expect(runningMetrics.totalRequests).toBe(4);

            await promise;

            const finalMetrics = MetricsAggregator.extractConcurrencyLimiterMetrics(concurrencyLimiter);
            expect(finalMetrics.completedRequests).toBe(4);
            expect(finalMetrics.peakConcurrency).toBeLessThanOrEqual(2);
            expect(finalMetrics.successRate).toBe(100);
            expect(finalMetrics.averageExecutionTime).toBeGreaterThan(0);
        });

        it('should track queue metrics', async () => {
            const concurrencyLimiter = new ConcurrencyLimiter(1);

            const requests = Array.from({ length: 5 }, (_, i) => 
                () => new Promise(resolve => setTimeout(() => resolve(`result-${i}`), 50))
            );

            await Promise.all(requests.map(fn => concurrencyLimiter.execute(fn)));

            const metrics = MetricsAggregator.extractConcurrencyLimiterMetrics(concurrencyLimiter);

            expect(metrics.queuedRequests).toBeGreaterThan(0);
            expect(metrics.peakQueueLength).toBeGreaterThan(0);
            expect(metrics.averageQueueWaitTime).toBeGreaterThan(0);
            expect(metrics.isAtCapacity).toBe(false);
            expect(metrics.hasQueuedRequests).toBe(false);
        });

        it('should handle failed requests', async () => {
            const concurrencyLimiter = new ConcurrencyLimiter(2);

            const requests = [
                () => Promise.resolve('success'),
                () => Promise.reject(new Error('Failed')),
                () => Promise.resolve('success')
            ];

            await Promise.allSettled(requests.map(fn => concurrencyLimiter.execute(fn)));

            const metrics = MetricsAggregator.extractConcurrencyLimiterMetrics(concurrencyLimiter);

            expect(metrics.completedRequests).toBe(2); // Only successful completions
            expect(metrics.failedRequests).toBe(1);
            expect(metrics.successRate).toBeCloseTo(33.33, 1); // 1 success out of 3 total
        });
    });

    describe('10. System-Wide Metrics Aggregation', () => {
        it('should aggregate all system metrics together', () => {
            const workflowResult: STABLE_WORKFLOW_RESULT = {
                workflowId: 'system-wf-001',
                success: true,
                executionTime: 3000,
                timestamp: new Date().toISOString(),
                totalPhases: 3,
                completedPhases: 3,
                totalRequests: 15,
                successfulRequests: 14,
                failedRequests: 1,
                phases: [
                    {
                        workflowId: 'system-wf-001',
                        phaseId: 'phase-1',
                        phaseIndex: 0,
                        success: true,
                        executionTime: 1000,
                        timestamp: new Date().toISOString(),
                        totalRequests: 5,
                        successfulRequests: 5,
                        failedRequests: 0,
                        responses: [
                            { requestId: 'req-1', groupId: 'critical', success: true },
                            { requestId: 'req-2', groupId: 'critical', success: true },
                            { requestId: 'req-3', groupId: 'normal', success: true },
                            { requestId: 'req-4', groupId: 'normal', success: true },
                            { requestId: 'req-5', success: true }
                        ]
                    },
                    {
                        workflowId: 'system-wf-001',
                        phaseId: 'phase-2',
                        phaseIndex: 1,
                        success: true,
                        executionTime: 1000,
                        timestamp: new Date().toISOString(),
                        totalRequests: 5,
                        successfulRequests: 5,
                        failedRequests: 0,
                        responses: [
                            { requestId: 'req-6', groupId: 'critical', success: true },
                            { requestId: 'req-7', groupId: 'normal', success: true },
                            { requestId: 'req-8', groupId: 'normal', success: true },
                            { requestId: 'req-9', success: true },
                            { requestId: 'req-10', success: true }
                        ]
                    },
                    {
                        workflowId: 'system-wf-001',
                        phaseId: 'phase-3',
                        phaseIndex: 2,
                        success: false,
                        executionTime: 1000,
                        timestamp: new Date().toISOString(),
                        totalRequests: 5,
                        successfulRequests: 4,
                        failedRequests: 1,
                        responses: [
                            { requestId: 'req-11', groupId: 'critical', success: true },
                            { requestId: 'req-12', groupId: 'critical', success: false, error: 'Timeout' },
                            { requestId: 'req-13', groupId: 'normal', success: true },
                            { requestId: 'req-14', success: true },
                            { requestId: 'req-15', success: true }
                        ]
                    }
                ],
                executionHistory: []
            };

            const circuitBreaker = new CircuitBreaker({
                failureThresholdPercentage: 50,
                minimumRequests: 5,
                recoveryTimeoutMs: 1000
            });

            const cache = new CacheManager({
                enabled: true,
                ttl: 60000,
                maxSize: 100
            });

            const rateLimiter = new RateLimiter(10, 1000);
            const concurrencyLimiter = new ConcurrencyLimiter(5);

            const systemMetrics = MetricsAggregator.aggregateSystemMetrics(
                workflowResult,
                circuitBreaker,
                cache,
                rateLimiter,
                concurrencyLimiter
            );

            // Workflow metrics
            expect(systemMetrics.workflow).toBeDefined();
            expect(systemMetrics.workflow!.workflowId).toBe('system-wf-001');
            expect(systemMetrics.workflow!.totalRequests).toBe(15);

            // Phase metrics
            expect(systemMetrics.phases).toHaveLength(3);
            expect(systemMetrics.phases[0].phaseId).toBe('phase-1');

            // Request group metrics
            expect(systemMetrics.requestGroups.length).toBeGreaterThan(0);
            const criticalGroup = systemMetrics.requestGroups.find(g => g.groupId === 'critical');
            expect(criticalGroup).toBeDefined();
            expect(criticalGroup!.totalRequests).toBe(5); // req-1, req-2 from phase-1, req-6 from phase-2, req-11, req-12 from phase-3

            // Individual request metrics
            expect(systemMetrics.requests).toHaveLength(15);
            const failedRequest = systemMetrics.requests.find(r => !r.success);
            expect(failedRequest).toBeDefined();
            expect(failedRequest!.hasError).toBe(true);

            // Utility metrics
            expect(systemMetrics.circuitBreaker).toBeDefined();
            expect(systemMetrics.cache).toBeDefined();
            expect(systemMetrics.rateLimiter).toBeDefined();
            expect(systemMetrics.concurrencyLimiter).toBeDefined();
        });

        it('should work without optional utility components', () => {
            const workflowResult: STABLE_WORKFLOW_RESULT = {
                workflowId: 'minimal-wf',
                success: true,
                executionTime: 1000,
                timestamp: new Date().toISOString(),
                totalPhases: 1,
                completedPhases: 1,
                totalRequests: 5,
                successfulRequests: 5,
                failedRequests: 0,
                phases: [{
                    workflowId: 'minimal-wf',
                    phaseId: 'phase-1',
                    phaseIndex: 0,
                    success: true,
                    executionTime: 1000,
                    timestamp: new Date().toISOString(),
                    totalRequests: 5,
                    successfulRequests: 5,
                    failedRequests: 0,
                    responses: []
                }],
                executionHistory: []
            };

            const systemMetrics = MetricsAggregator.aggregateSystemMetrics(workflowResult);

            expect(systemMetrics.workflow).toBeDefined();
            expect(systemMetrics.phases).toHaveLength(1);
            expect(systemMetrics.circuitBreaker).toBeUndefined();
            expect(systemMetrics.cache).toBeUndefined();
            expect(systemMetrics.rateLimiter).toBeUndefined();
            expect(systemMetrics.concurrencyLimiter).toBeUndefined();
        });
    });

    describe('11. State Persistence Metrics', () => {
        it('should track state operations through workflow execution', () => {
            // This would be tracked through the workflow execution itself
            // The metrics would show number of phases, replays, etc.
            const workflowResult: STABLE_WORKFLOW_RESULT = {
                workflowId: 'persistence-wf',
                success: true,
                executionTime: 2000,
                timestamp: new Date().toISOString(),
                totalPhases: 5,
                completedPhases: 3,
                totalRequests: 10,
                successfulRequests: 10,
                failedRequests: 0,
                phases: [],
                executionHistory: [
                    {
                        phaseId: 'phase-1',
                        phaseIndex: 0,
                        executionNumber: 0,
                        timestamp: new Date().toISOString(),
                        success: true,
                        executionTime: 400
                    },
                    {
                        phaseId: 'phase-2',
                        phaseIndex: 1,
                        executionNumber: 0,
                        timestamp: new Date().toISOString(),
                        success: true,
                        executionTime: 500
                    },
                    {
                        phaseId: 'phase-3',
                        phaseIndex: 2,
                        executionNumber: 0,
                        timestamp: new Date().toISOString(),
                        success: true,
                        executionTime: 600
                    }
                ],
                terminatedEarly: true,
                terminationReason: 'Manual stop for state persistence'
            };

            const metrics = MetricsAggregator.extractWorkflowMetrics(workflowResult);

            expect(metrics.terminatedEarly).toBe(true);
            expect(metrics.terminationReason).toBeDefined();
            expect(metrics.completedPhases).toBe(3);
            expect(metrics.totalPhases).toBe(5);
            // The difference indicates phases that could be resumed
            expect(metrics.totalPhases - metrics.completedPhases).toBe(2);
        });
    });

    describe('12. Performance Trend Metrics', () => {
        it('should calculate throughput and latency percentiles', () => {
            const workflowResult: STABLE_WORKFLOW_RESULT = {
                workflowId: 'perf-wf',
                success: true,
                executionTime: 5000, // 5 seconds
                timestamp: new Date().toISOString(),
                totalPhases: 4,
                completedPhases: 4,
                totalRequests: 100,
                successfulRequests: 95,
                failedRequests: 5,
                phases: [
                    {
                        workflowId: 'perf-wf',
                        phaseId: 'phase-1',
                        phaseIndex: 0,
                        success: true,
                        executionTime: 1000,
                        timestamp: new Date().toISOString(),
                        totalRequests: 25,
                        successfulRequests: 25,
                        failedRequests: 0,
                        responses: []
                    },
                    {
                        workflowId: 'perf-wf',
                        phaseId: 'phase-2',
                        phaseIndex: 1,
                        success: true,
                        executionTime: 1500,
                        timestamp: new Date().toISOString(),
                        totalRequests: 25,
                        successfulRequests: 25,
                        failedRequests: 0,
                        responses: []
                    },
                    {
                        workflowId: 'perf-wf',
                        phaseId: 'phase-3',
                        phaseIndex: 2,
                        success: true,
                        executionTime: 1200,
                        timestamp: new Date().toISOString(),
                        totalRequests: 25,
                        successfulRequests: 23,
                        failedRequests: 2,
                        responses: []
                    },
                    {
                        workflowId: 'perf-wf',
                        phaseId: 'phase-4',
                        phaseIndex: 3,
                        success: true,
                        executionTime: 1300,
                        timestamp: new Date().toISOString(),
                        totalRequests: 25,
                        successfulRequests: 22,
                        failedRequests: 3,
                        responses: []
                    }
                ],
                executionHistory: []
            };

            const metrics = MetricsAggregator.extractWorkflowMetrics(workflowResult);

            // Throughput: 100 requests / 5 seconds = 20 requests/second
            expect(metrics.throughput).toBeCloseTo(20, 0);
            
            // Average phase execution time
            expect(metrics.averagePhaseExecutionTime).toBeCloseTo(1250, 0);
            
            // Success rate
            expect(metrics.requestSuccessRate).toBe(95);
        });
    });
});

describe('Metrics Hierarchy - Complete Metrics Flow Across All Levels', () => {
    describe('13. Request-Level Metrics (STABLE_REQUEST_RESULT)', () => {
        it('should capture comprehensive metrics for a single request with multiple attempts', () => {
            // Simulating what stableRequest returns
            const requestResult: STABLE_REQUEST_RESULT<any> = {
                success: true,
                data: { userId: 123, name: 'John Doe' },
                errorLogs: [
                    {
                        attempt: '1/3',
                        timestamp: '2026-01-14T10:00:00.000Z',
                        error: 'Network timeout',
                        statusCode: 0,
                        type: RESPONSE_ERRORS.HTTP_ERROR,
                        isRetryable: true,
                        executionTime: 5000
                    },
                    {
                        attempt: '2/3',
                        timestamp: '2026-01-14T10:00:06.000Z',
                        error: 'Connection refused',
                        statusCode: 0,
                        type: RESPONSE_ERRORS.HTTP_ERROR,
                        isRetryable: true,
                        executionTime: 5000
                    }
                ],
                successfulAttempts: [
                    {
                        attempt: '3/3',
                        timestamp: '2026-01-14T10:00:13.000Z',
                        executionTime: 1200,
                        data: { userId: 123, name: 'John Doe' },
                        statusCode: 200
                    }
                ],
                metrics: {
                    totalAttempts: 3,
                    successfulAttempts: 1,
                    failedAttempts: 2,
                    totalExecutionTime: 11200,
                    averageAttemptTime: 3733.33,
                    infrastructureMetrics: {
                        circuitBreaker: {
                            state: CircuitBreakerState.CLOSED,
                            isHealthy: true,
                            totalRequests: 3,
                            successfulRequests: 1,
                            failedRequests: 2,
                            failurePercentage: 66.67,
                            stateTransitions: 0,
                            lastStateChangeTime: Date.parse('2026-01-14T10:00:00.000Z'),
                            timeSinceLastStateChange: 0,
                            isCurrentlyOpen: false,
                            openCount: 0,
                            totalOpenDuration: 0,
                            openUntil: null,
                            timeUntilRecovery: null,
                            recoveryAttempts: 0,
                            successfulRecoveries: 0,
                            failedRecoveries: 0,
                            recoverySuccessRate: 0,
                            averageOpenDuration: 0,
                            config: {
                                failureThresholdPercentage: 50,
                                minimumRequests: 5,
                                recoveryTimeoutMs: 5000,
                                successThresholdPercentage: 50,
                                halfOpenMaxRequests: 3
                            }
                        }
                    }
                }
            };

            // Validate request-level metrics
            expect(requestResult.success).toBe(true);
            expect(requestResult.data).toEqual({ userId: 123, name: 'John Doe' });
            expect(requestResult.errorLogs).toHaveLength(2);
            expect(requestResult.successfulAttempts).toHaveLength(1);
            
            // Validate metrics object
            expect(requestResult.metrics!.totalAttempts).toBe(3);
            expect(requestResult.metrics!.successfulAttempts).toBe(1);
            expect(requestResult.metrics!.failedAttempts).toBe(2);
            expect(requestResult.metrics!.totalExecutionTime).toBe(11200);
            expect(requestResult.metrics!.averageAttemptTime).toBeCloseTo(3733.33, 0);
            
            // Validate infrastructure metrics
            expect(requestResult.metrics!.infrastructureMetrics?.circuitBreaker).toBeDefined();
            expect(requestResult.metrics!.infrastructureMetrics!.circuitBreaker!.state).toBe(CircuitBreakerState.CLOSED);
            expect(requestResult.metrics!.infrastructureMetrics!.circuitBreaker!.totalRequests).toBe(3);
        });

        it('should capture metrics for a failed request with cache', () => {
            const requestResult: STABLE_REQUEST_RESULT<any> = {
                success: false,
                error: 'Maximum attempts reached',
                errorLogs: [
                    {
                        attempt: '1/5',
                        timestamp: '2026-01-14T10:00:00.000Z',
                        error: '500 Internal Server Error',
                        statusCode: 500,
                        type: RESPONSE_ERRORS.HTTP_ERROR,
                        isRetryable: true,
                        executionTime: 800
                    },
                    {
                        attempt: '2/5',
                        timestamp: '2026-01-14T10:00:02.000Z',
                        error: '503 Service Unavailable',
                        statusCode: 503,
                        type: RESPONSE_ERRORS.HTTP_ERROR,
                        isRetryable: true,
                        executionTime: 1000
                    },
                    {
                        attempt: '3/5',
                        timestamp: '2026-01-14T10:00:05.000Z',
                        error: '504 Gateway Timeout',
                        statusCode: 504,
                        type: RESPONSE_ERRORS.HTTP_ERROR,
                        isRetryable: true,
                        executionTime: 5000
                    },
                    {
                        attempt: '4/5',
                        timestamp: '2026-01-14T10:00:12.000Z',
                        error: '502 Bad Gateway',
                        statusCode: 502,
                        type: RESPONSE_ERRORS.HTTP_ERROR,
                        isRetryable: true,
                        executionTime: 2000
                    },
                    {
                        attempt: '5/5',
                        timestamp: '2026-01-14T10:00:18.000Z',
                        error: '500 Internal Server Error',
                        statusCode: 500,
                        type: RESPONSE_ERRORS.HTTP_ERROR,
                        isRetryable: true,
                        executionTime: 1500
                    }
                ],
                metrics: {
                    totalAttempts: 5,
                    successfulAttempts: 0,
                    failedAttempts: 5,
                    totalExecutionTime: 10300,
                    averageAttemptTime: 2060,
                    infrastructureMetrics: {
                        cache: {
                            isEnabled: true,
                            currentSize: 50,
                            maxSize: 100,
                            validEntries: 45,
                            expiredEntries: 5,
                            utilizationPercentage: 50,
                            totalRequests: 100,
                            hits: 75,
                            misses: 25,
                            hitRate: 75,
                            missRate: 25,
                            sets: 25,
                            evictions: 5,
                            expirations: 10,
                            networkRequestsSaved: 75,
                            cacheEfficiency: 75,
                            averageGetTime: 0.5,
                            averageSetTime: 1.2,
                            averageCacheAge: 3000,
                            oldestEntryAge: 5000,
                            newestEntryAge: 100
                        }
                    }
                }
            };

            // Validate failed request
            expect(requestResult.success).toBe(false);
            expect(requestResult.error).toBe('Maximum attempts reached');
            expect(requestResult.data).toBeUndefined();
            expect(requestResult.errorLogs).toHaveLength(5);
            expect(requestResult.successfulAttempts).toBeUndefined();
            
            // Validate all attempts failed
            expect(requestResult.metrics!.totalAttempts).toBe(5);
            expect(requestResult.metrics!.successfulAttempts).toBe(0);
            expect(requestResult.metrics!.failedAttempts).toBe(5);
            
            // Validate cache metrics
            expect(requestResult.metrics!.infrastructureMetrics?.cache).toBeDefined();
            expect(requestResult.metrics!.infrastructureMetrics!.cache!.hitRate).toBe(75);
            expect(requestResult.metrics!.infrastructureMetrics!.cache!.networkRequestsSaved).toBe(75);
        });
    });

    describe('14. API Gateway-Level Metrics (API_GATEWAY_RESPONSE)', () => {
        it('should capture metrics for multiple requests in an API gateway call', () => {
            const gatewayResponses: API_GATEWAY_RESPONSE[] = [
                {
                    requestId: 'user-fetch-1',
                    groupId: 'critical',
                    success: true,
                    data: { userId: 1, name: 'Alice' }
                },
                {
                    requestId: 'user-fetch-2',
                    groupId: 'critical',
                    success: true,
                    data: { userId: 2, name: 'Bob' }
                },
                {
                    requestId: 'user-fetch-3',
                    groupId: 'critical',
                    success: false,
                    error: 'User not found'
                },
                {
                    requestId: 'profile-fetch-1',
                    groupId: 'normal',
                    success: true,
                    data: { profileId: 101, bio: 'Developer' }
                },
                {
                    requestId: 'profile-fetch-2',
                    groupId: 'normal',
                    success: true,
                    data: { profileId: 102, bio: 'Designer' }
                },
                {
                    requestId: 'settings-fetch-1',
                    success: true,
                    data: { theme: 'dark', language: 'en' }
                },
                {
                    requestId: 'analytics-fetch-1',
                    groupId: 'low-priority',
                    success: false,
                    error: 'Analytics service unavailable'
                }
            ];

            // Extract individual request metrics
            const requestMetrics = MetricsAggregator.extractRequestMetrics(gatewayResponses);
            
            expect(requestMetrics).toHaveLength(7);
            
            // Validate critical group requests
            const criticalRequests = requestMetrics.filter(r => r.groupId === 'critical');
            expect(criticalRequests).toHaveLength(3);
            expect(criticalRequests.filter(r => r.success).length).toBe(2);
            expect(criticalRequests.filter(r => r.hasError).length).toBe(1);
            
            // Validate normal group requests
            const normalRequests = requestMetrics.filter(r => r.groupId === 'normal');
            expect(normalRequests).toHaveLength(2);
            expect(normalRequests.every(r => r.success)).toBe(true);
            
            // Validate ungrouped request (requests without groupId)
            const ungroupedRequests = requestMetrics.filter(r => !r.groupId || r.groupId === 'default');
            expect(ungroupedRequests.length).toBeGreaterThanOrEqual(1);
            const settingsRequest = requestMetrics.find(r => r.requestId === 'settings-fetch-1');
            expect(settingsRequest).toBeDefined();
            expect(settingsRequest!.success).toBe(true);
            
            // Extract request group metrics
            const groupMetrics = MetricsAggregator.extractRequestGroupMetrics(gatewayResponses);
            
            const criticalGroupMetrics = groupMetrics.find(g => g.groupId === 'critical');
            expect(criticalGroupMetrics).toBeDefined();
            expect(criticalGroupMetrics!.totalRequests).toBe(3);
            expect(criticalGroupMetrics!.successfulRequests).toBe(2);
            expect(criticalGroupMetrics!.failedRequests).toBe(1);
            expect(criticalGroupMetrics!.successRate).toBeCloseTo(66.67, 1);
            
            const normalGroupMetrics = groupMetrics.find(g => g.groupId === 'normal');
            expect(normalGroupMetrics).toBeDefined();
            expect(normalGroupMetrics!.totalRequests).toBe(2);
            expect(normalGroupMetrics!.successRate).toBe(100);
            
            const lowPriorityGroupMetrics = groupMetrics.find(g => g.groupId === 'low-priority');
            expect(lowPriorityGroupMetrics).toBeDefined();
            expect(lowPriorityGroupMetrics!.totalRequests).toBe(1);
            expect(lowPriorityGroupMetrics!.failedRequests).toBe(1);
            expect(lowPriorityGroupMetrics!.successRate).toBe(0);
        });

        it('should aggregate gateway-level infrastructure metrics', () => {
            const gatewayResult: API_GATEWAY_RESULT = Object.assign(
                [
                    { requestId: 'req-1', success: true, data: 'data1' },
                    { requestId: 'req-2', success: true, data: 'data2' },
                    { requestId: 'req-3', success: false, error: 'Error' }
                ],
                {
                    metrics: {
                        totalRequests: 3,
                        successfulRequests: 2,
                        failedRequests: 1,
                        successRate: 66.67,
                        failureRate: 33.33,
                        requestGroups: [
                            {
                                groupId: 'default',
                                totalRequests: 3,
                                successfulRequests: 2,
                                failedRequests: 1,
                                successRate: 66.67,
                                failureRate: 33.33,
                                requestIds: ['req-1', 'req-2', 'req-3']
                            }
                        ],
                        infrastructureMetrics: {
                            circuitBreaker: {
                                state: CircuitBreakerState.CLOSED,
                                isHealthy: true,
                                totalRequests: 3,
                                successfulRequests: 2,
                                failedRequests: 1,
                                failurePercentage: 33.33,
                                stateTransitions: 0,
                                lastStateChangeTime: Date.parse('2026-01-14T10:00:00.000Z'),
                                timeSinceLastStateChange: 0,
                                isCurrentlyOpen: false,
                                openCount: 0,
                                totalOpenDuration: 0,
                                openUntil: null,
                                timeUntilRecovery: null,
                                recoveryAttempts: 0,
                                successfulRecoveries: 0,
                                failedRecoveries: 0,
                                recoverySuccessRate: 0,
                                averageOpenDuration: 0,
                                config: {
                                    failureThresholdPercentage: 50,
                                    minimumRequests: 5,
                                    recoveryTimeoutMs: 5000,
                                    successThresholdPercentage: 50,
                                    halfOpenMaxRequests: 3
                                }
                            },
                            rateLimiter: {
                                maxRequests: 10,
                                windowMs: 1000,
                                availableTokens: 7,
                                queueLength: 0,
                                requestsInCurrentWindow: 3,
                                totalRequests: 3,
                                completedRequests: 3,
                                throttledRequests: 0,
                                throttleRate: 0,
                                currentRequestRate: 3,
                                peakRequestRate: 3,
                                averageRequestRate: 3,
                                peakQueueLength: 0,
                                averageQueueWaitTime: 0,
                                isThrottling: false,
                                utilizationPercentage: 30
                            },
                            concurrencyLimiter: {
                                limit: 5,
                                running: 0,
                                queueLength: 0,
                                utilizationPercentage: 0,
                                totalRequests: 3,
                                completedRequests: 3,
                                failedRequests: 0,
                                queuedRequests: 0,
                                successRate: 100,
                                peakConcurrency: 3,
                                averageConcurrency: 1.5,
                                concurrencyUtilization: 60,
                                peakQueueLength: 0,
                                averageQueueWaitTime: 0,
                                averageExecutionTime: 150,
                                isAtCapacity: false,
                                hasQueuedRequests: false
                            }
                        }
                    }
                }
            );

            // Validate gateway-level metrics
            expect(gatewayResult.metrics).toBeDefined();
            expect(gatewayResult.metrics!.totalRequests).toBe(3);
            expect(gatewayResult.metrics!.successfulRequests).toBe(2);
            expect(gatewayResult.metrics!.failedRequests).toBe(1);
            
            // Validate infrastructure metrics at gateway level
            expect(gatewayResult.metrics!.infrastructureMetrics).toBeDefined();
            expect(gatewayResult.metrics!.infrastructureMetrics!.circuitBreaker).toBeDefined();
            expect(gatewayResult.metrics!.infrastructureMetrics!.rateLimiter).toBeDefined();
            expect(gatewayResult.metrics!.infrastructureMetrics!.concurrencyLimiter).toBeDefined();
            
            // Validate request group metrics
            expect(gatewayResult.metrics!.requestGroups).toHaveLength(1);
            expect(gatewayResult.metrics!.requestGroups![0].groupId).toBe('default');
        });
    });

    describe('15. Phase-Level Metrics Integration', () => {
        it('should aggregate metrics from multiple API gateway calls within a phase', () => {
            const phase: STABLE_WORKFLOW_PHASE_RESULT = {
                workflowId: 'data-pipeline-001',
                phaseId: 'data-collection',
                phaseIndex: 0,
                success: true,
                executionTime: 2500,
                timestamp: '2026-01-14T10:00:00.000Z',
                totalRequests: 12,
                successfulRequests: 11,
                failedRequests: 1,
                responses: [
                    // First API gateway call - user data
                    { requestId: 'user-1', groupId: 'users', success: true, data: { id: 1 } },
                    { requestId: 'user-2', groupId: 'users', success: true, data: { id: 2 } },
                    { requestId: 'user-3', groupId: 'users', success: true, data: { id: 3 } },
                    { requestId: 'user-4', groupId: 'users', success: true, data: { id: 4 } },
                    // Second API gateway call - orders
                    { requestId: 'order-1', groupId: 'orders', success: true, data: { orderId: 101 } },
                    { requestId: 'order-2', groupId: 'orders', success: true, data: { orderId: 102 } },
                    { requestId: 'order-3', groupId: 'orders', success: false, error: 'Order not found' },
                    { requestId: 'order-4', groupId: 'orders', success: true, data: { orderId: 104 } },
                    // Third API gateway call - products
                    { requestId: 'product-1', groupId: 'products', success: true, data: { productId: 201 } },
                    { requestId: 'product-2', groupId: 'products', success: true, data: { productId: 202 } },
                    { requestId: 'product-3', groupId: 'products', success: true, data: { productId: 203 } },
                    { requestId: 'product-4', groupId: 'products', success: true, data: { productId: 204 } }
                ],
                infrastructureMetrics: {
                    circuitBreaker: {
                        state: CircuitBreakerState.CLOSED,
                        isHealthy: true,
                        totalRequests: 12,
                        successfulRequests: 11,
                        failedRequests: 1,
                        failurePercentage: 8.33,
                        stateTransitions: 0,
                        lastStateChangeTime: Date.parse('2026-01-14T10:00:00.000Z'),
                        timeSinceLastStateChange: 0,
                        isCurrentlyOpen: false,
                        openCount: 0,
                        totalOpenDuration: 0,
                        openUntil: null,
                        timeUntilRecovery: null,
                        recoveryAttempts: 0,
                        successfulRecoveries: 0,
                        failedRecoveries: 0,
                        recoverySuccessRate: 0,
                        averageOpenDuration: 0,
                        config: {
                            failureThresholdPercentage: 50,
                            minimumRequests: 5,
                            recoveryTimeoutMs: 5000,
                            successThresholdPercentage: 50,
                            halfOpenMaxRequests: 3
                        }
                    },
                    cache: {
                        isEnabled: true,
                        currentSize: 11,
                        maxSize: 100,
                        validEntries: 11,
                        expiredEntries: 0,
                        utilizationPercentage: 11,
                        totalRequests: 12,
                        hits: 0,
                        misses: 12,
                        hitRate: 0,
                        missRate: 100,
                        sets: 11,
                        evictions: 0,
                        expirations: 0,
                        networkRequestsSaved: 0,
                        cacheEfficiency: 0,
                        averageGetTime: 0.3,
                        averageSetTime: 1.5,
                        averageCacheAge: 0,
                        oldestEntryAge: 0,
                        newestEntryAge: 0
                    }
                }
            };

            // Extract phase metrics
            const phaseMetrics = MetricsAggregator.extractPhaseMetrics(phase);
            
            expect(phaseMetrics.phaseId).toBe('data-collection');
            expect(phaseMetrics.success).toBe(true);
            expect(phaseMetrics.executionTime).toBe(2500);
            expect(phaseMetrics.totalRequests).toBe(12);
            expect(phaseMetrics.successfulRequests).toBe(11);
            expect(phaseMetrics.failedRequests).toBe(1);
            expect(phaseMetrics.requestSuccessRate).toBeCloseTo(91.67, 1);
            
            // Extract request group metrics from phase
            const requestGroupMetrics = MetricsAggregator.extractRequestGroupMetrics(phase.responses);
            
            expect(requestGroupMetrics).toHaveLength(3);
            
            const usersGroup = requestGroupMetrics.find(g => g.groupId === 'users');
            expect(usersGroup).toBeDefined();
            expect(usersGroup!.totalRequests).toBe(4);
            expect(usersGroup!.successRate).toBe(100);
            
            const ordersGroup = requestGroupMetrics.find(g => g.groupId === 'orders');
            expect(ordersGroup).toBeDefined();
            expect(ordersGroup!.totalRequests).toBe(4);
            expect(ordersGroup!.successfulRequests).toBe(3);
            expect(ordersGroup!.failedRequests).toBe(1);
            expect(ordersGroup!.successRate).toBe(75);
            
            const productsGroup = requestGroupMetrics.find(g => g.groupId === 'products');
            expect(productsGroup).toBeDefined();
            expect(productsGroup!.totalRequests).toBe(4);
            expect(productsGroup!.successRate).toBe(100);
            
            // Validate infrastructure metrics
            expect(phase.infrastructureMetrics).toBeDefined();
            expect(phase.infrastructureMetrics!.circuitBreaker?.state).toBe(CircuitBreakerState.CLOSED);
            expect(phase.infrastructureMetrics!.cache?.isEnabled).toBe(true);
            expect(phase.infrastructureMetrics!.cache?.hitRate).toBe(0);
        });
    });

    describe('16. Branch-Level Metrics Aggregation', () => {
        it('should aggregate metrics from multiple phases within a branch', () => {
            const branch: BranchExecutionResult = {
                workflowId: 'payment-workflow',
                branchId: 'payment-processing',
                branchIndex: 0,
                success: true,
                executionTime: 5000,
                completedPhases: 3,
                executionNumber: 0,
                phaseResults: [
                    {
                        workflowId: 'payment-workflow',
                        branchId: 'payment-processing',
                        phaseId: 'validate-payment',
                        phaseIndex: 0,
                        success: true,
                        executionTime: 1000,
                        timestamp: '2026-01-14T10:00:00.000Z',
                        totalRequests: 5,
                        successfulRequests: 5,
                        failedRequests: 0,
                        responses: [
                            { requestId: 'val-1', groupId: 'validation', success: true },
                            { requestId: 'val-2', groupId: 'validation', success: true },
                            { requestId: 'val-3', groupId: 'validation', success: true },
                            { requestId: 'val-4', groupId: 'validation', success: true },
                            { requestId: 'val-5', groupId: 'validation', success: true }
                        ]
                    },
                    {
                        workflowId: 'payment-workflow',
                        branchId: 'payment-processing',
                        phaseId: 'process-payment',
                        phaseIndex: 1,
                        success: true,
                        executionTime: 2500,
                        timestamp: '2026-01-14T10:00:01.000Z',
                        totalRequests: 8,
                        successfulRequests: 7,
                        failedRequests: 1,
                        responses: [
                            { requestId: 'pay-1', groupId: 'payment', success: true },
                            { requestId: 'pay-2', groupId: 'payment', success: true },
                            { requestId: 'pay-3', groupId: 'payment', success: false, error: 'Payment declined' },
                            { requestId: 'pay-4', groupId: 'payment', success: true },
                            { requestId: 'notif-1', groupId: 'notification', success: true },
                            { requestId: 'notif-2', groupId: 'notification', success: true },
                            { requestId: 'notif-3', groupId: 'notification', success: true },
                            { requestId: 'notif-4', groupId: 'notification', success: true }
                        ]
                    },
                    {
                        workflowId: 'payment-workflow',
                        branchId: 'payment-processing',
                        phaseId: 'finalize-payment',
                        phaseIndex: 2,
                        success: true,
                        executionTime: 1500,
                        timestamp: '2026-01-14T10:00:03.500Z',
                        totalRequests: 4,
                        successfulRequests: 4,
                        failedRequests: 0,
                        responses: [
                            { requestId: 'fin-1', groupId: 'finalization', success: true },
                            { requestId: 'fin-2', groupId: 'finalization', success: true },
                            { requestId: 'fin-3', groupId: 'finalization', success: true },
                            { requestId: 'fin-4', groupId: 'finalization', success: true }
                        ]
                    }
                ]
            };

            // Extract branch metrics
            const branchMetrics = MetricsAggregator.extractBranchMetrics(branch);
            
            expect(branchMetrics.branchId).toBe('payment-processing');
            expect(branchMetrics.success).toBe(true);
            expect(branchMetrics.executionTime).toBe(5000);
            expect(branchMetrics.totalPhases).toBe(3);
            expect(branchMetrics.completedPhases).toBe(3);
            expect(branchMetrics.totalRequests).toBe(17);
            expect(branchMetrics.successfulRequests).toBe(16);
            expect(branchMetrics.failedRequests).toBe(1);
            expect(branchMetrics.requestSuccessRate).toBeCloseTo(94.12, 1);
            
            // Aggregate request groups across all phases in the branch
            const allResponses = branch.phaseResults.flatMap(phase => phase.responses);
            const requestGroupMetrics = MetricsAggregator.extractRequestGroupMetrics(allResponses);
            
            expect(requestGroupMetrics).toHaveLength(4);
            
            const validationGroup = requestGroupMetrics.find(g => g.groupId === 'validation');
            expect(validationGroup).toBeDefined();
            expect(validationGroup!.totalRequests).toBe(5);
            expect(validationGroup!.successRate).toBe(100);
            
            const paymentGroup = requestGroupMetrics.find(g => g.groupId === 'payment');
            expect(paymentGroup).toBeDefined();
            expect(paymentGroup!.totalRequests).toBe(4);
            expect(paymentGroup!.successfulRequests).toBe(3);
            expect(paymentGroup!.failedRequests).toBe(1);
            expect(paymentGroup!.successRate).toBe(75);
            
            const notificationGroup = requestGroupMetrics.find(g => g.groupId === 'notification');
            expect(notificationGroup).toBeDefined();
            expect(notificationGroup!.totalRequests).toBe(4);
            expect(notificationGroup!.successRate).toBe(100);
            
            const finalizationGroup = requestGroupMetrics.find(g => g.groupId === 'finalization');
            expect(finalizationGroup).toBeDefined();
            expect(finalizationGroup!.totalRequests).toBe(4);
            expect(finalizationGroup!.successRate).toBe(100);
        });
    });

    describe('17. Workflow-Level Complete Metrics Hierarchy', () => {
        it('should aggregate metrics from all phases with complete hierarchy visibility', () => {
            const workflow: STABLE_WORKFLOW_RESULT = {
                workflowId: 'e2e-data-pipeline',
                success: true,
                executionTime: 15000,
                timestamp: '2026-01-14T10:00:00.000Z',
                totalPhases: 4,
                completedPhases: 4,
                totalRequests: 40,
                successfulRequests: 37,
                failedRequests: 3,
                phases: [
                    {
                        workflowId: 'e2e-data-pipeline',
                        phaseId: 'ingestion',
                        phaseIndex: 0,
                        success: true,
                        executionTime: 3000,
                        timestamp: '2026-01-14T10:00:00.000Z',
                        totalRequests: 10,
                        successfulRequests: 10,
                        failedRequests: 0,
                        responses: Array.from({ length: 10 }, (_, i) => ({
                            requestId: `ingest-${i + 1}`,
                            groupId: 'ingestion',
                            success: true,
                            data: { recordId: i + 1 }
                        }))
                    },
                    {
                        workflowId: 'e2e-data-pipeline',
                        phaseId: 'transformation',
                        phaseIndex: 1,
                        success: true,
                        executionTime: 5000,
                        timestamp: '2026-01-14T10:00:03.000Z',
                        totalRequests: 15,
                        successfulRequests: 14,
                        failedRequests: 1,
                        responses: [
                            ...Array.from({ length: 14 }, (_, i) => ({
                                requestId: `transform-${i + 1}`,
                                groupId: 'transformation',
                                success: true,
                                data: { transformedId: i + 1 }
                            })),
                            {
                                requestId: 'transform-15',
                                groupId: 'transformation',
                                success: false,
                                error: 'Invalid data format'
                            }
                        ]
                    },
                    {
                        workflowId: 'e2e-data-pipeline',
                        phaseId: 'validation',
                        phaseIndex: 2,
                        success: true,
                        executionTime: 4000,
                        timestamp: '2026-01-14T10:00:08.000Z',
                        totalRequests: 10,
                        successfulRequests: 9,
                        failedRequests: 1,
                        responses: [
                            ...Array.from({ length: 9 }, (_, i) => ({
                                requestId: `validate-${i + 1}`,
                                groupId: 'validation',
                                success: true,
                                data: { validatedId: i + 1 }
                            })),
                            {
                                requestId: 'validate-10',
                                groupId: 'validation',
                                success: false,
                                error: 'Validation failed'
                            }
                        ]
                    },
                    {
                        workflowId: 'e2e-data-pipeline',
                        phaseId: 'storage',
                        phaseIndex: 3,
                        success: true,
                        executionTime: 3000,
                        timestamp: '2026-01-14T10:00:12.000Z',
                        totalRequests: 5,
                        successfulRequests: 4,
                        failedRequests: 1,
                        responses: [
                            ...Array.from({ length: 4 }, (_, i) => ({
                                requestId: `store-${i + 1}`,
                                groupId: 'storage',
                                success: true,
                                data: { storedId: i + 1 }
                            })),
                            {
                                requestId: 'store-5',
                                groupId: 'storage',
                                success: false,
                                error: 'Storage quota exceeded'
                            }
                        ]
                    }
                ],
                executionHistory: [],
                requestGroupMetrics: [
                    {
                        groupId: 'ingestion',
                        totalRequests: 10,
                        successfulRequests: 10,
                        failedRequests: 0,
                        successRate: 100,
                        failureRate: 0,
                        requestIds: Array.from({ length: 10 }, (_, i) => `ingest-${i + 1}`)
                    },
                    {
                        groupId: 'transformation',
                        totalRequests: 15,
                        successfulRequests: 14,
                        failedRequests: 1,
                        successRate: 93.33,
                        failureRate: 6.67,
                        requestIds: Array.from({ length: 15 }, (_, i) => `transform-${i + 1}`)
                    },
                    {
                        groupId: 'validation',
                        totalRequests: 10,
                        successfulRequests: 9,
                        failedRequests: 1,
                        successRate: 90,
                        failureRate: 10,
                        requestIds: Array.from({ length: 10 }, (_, i) => `validate-${i + 1}`)
                    },
                    {
                        groupId: 'storage',
                        totalRequests: 5,
                        successfulRequests: 4,
                        failedRequests: 1,
                        successRate: 80,
                        failureRate: 20,
                        requestIds: Array.from({ length: 5 }, (_, i) => `store-${i + 1}`)
                    }
                ]
            };

            // Extract workflow metrics
            const workflowMetrics = MetricsAggregator.extractWorkflowMetrics(workflow);
            
            expect(workflowMetrics.workflowId).toBe('e2e-data-pipeline');
            expect(workflowMetrics.success).toBe(true);
            expect(workflowMetrics.executionTime).toBe(15000);
            expect(workflowMetrics.totalPhases).toBe(4);
            expect(workflowMetrics.completedPhases).toBe(4);
            expect(workflowMetrics.totalRequests).toBe(40);
            expect(workflowMetrics.successfulRequests).toBe(37);
            expect(workflowMetrics.failedRequests).toBe(3);
            expect(workflowMetrics.requestSuccessRate).toBe(92.5);
            expect(workflowMetrics.throughput).toBeCloseTo(2.67, 1); // 40 requests / 15 seconds
            
            // Verify request group metrics are at workflow level
            expect(workflow.requestGroupMetrics).toBeDefined();
            expect(workflow.requestGroupMetrics).toHaveLength(4);
            
            // Validate each request group
            const ingestionGroup = workflow.requestGroupMetrics!.find(g => g.groupId === 'ingestion');
            expect(ingestionGroup).toBeDefined();
            expect(ingestionGroup!.successRate).toBe(100);
            
            const transformationGroup = workflow.requestGroupMetrics!.find(g => g.groupId === 'transformation');
            expect(transformationGroup).toBeDefined();
            expect(transformationGroup!.successRate).toBeCloseTo(93.33, 1);
            
            const validationGroup = workflow.requestGroupMetrics!.find(g => g.groupId === 'validation');
            expect(validationGroup).toBeDefined();
            expect(validationGroup!.successRate).toBe(90);
            
            const storageGroup = workflow.requestGroupMetrics!.find(g => g.groupId === 'storage');
            expect(storageGroup).toBeDefined();
            expect(storageGroup!.successRate).toBe(80);
            
            // Extract phase metrics for detailed analysis
            const phaseMetrics = workflow.phases.map(phase => 
                MetricsAggregator.extractPhaseMetrics(phase)
            );
            
            expect(phaseMetrics).toHaveLength(4);
            expect(phaseMetrics[0].phaseId).toBe('ingestion');
            expect(phaseMetrics[0].requestSuccessRate).toBe(100);
            expect(phaseMetrics[1].phaseId).toBe('transformation');
            expect(phaseMetrics[1].requestSuccessRate).toBeCloseTo(93.33, 1);
            expect(phaseMetrics[2].phaseId).toBe('validation');
            expect(phaseMetrics[2].requestSuccessRate).toBe(90);
            expect(phaseMetrics[3].phaseId).toBe('storage');
            expect(phaseMetrics[3].requestSuccessRate).toBe(80);
        });

        it('should demonstrate complete metrics flow: request → gateway → phase → workflow', () => {
            // This test demonstrates the complete hierarchy of metrics
            
            // Level 1: Individual Request Metrics (STABLE_REQUEST_RESULT)
            const individualRequestMetrics: STABLE_REQUEST_RESULT = {
                success: true,
                data: { userId: 123 },
                errorLogs: [
                    {
                        attempt: '1/2',
                        timestamp: '2026-01-14T10:00:00.000Z',
                        error: 'Timeout',
                        statusCode: 0,
                        type: RESPONSE_ERRORS.HTTP_ERROR,
                        isRetryable: true,
                        executionTime: 5000
                    }
                ],
                successfulAttempts: [
                    {
                        attempt: '2/2',
                        timestamp: '2026-01-14T10:00:06.000Z',
                        executionTime: 1000,
                        data: { userId: 123 },
                        statusCode: 200
                    }
                ],
                metrics: {
                    totalAttempts: 2,
                    successfulAttempts: 1,
                    failedAttempts: 1,
                    totalExecutionTime: 6000,
                    averageAttemptTime: 3000
                }
            };

            // Level 2: API Gateway Response (aggregates individual requests)
            const gatewayResponses: API_GATEWAY_RESPONSE[] = [
                { requestId: 'req-1', groupId: 'users', success: true, data: { userId: 123 } },
                { requestId: 'req-2', groupId: 'users', success: true, data: { userId: 456 } },
                { requestId: 'req-3', groupId: 'users', success: false, error: 'Not found' }
            ];

            // Level 3: Request Group Metrics (aggregates by group)
            const requestGroupMetrics = MetricsAggregator.extractRequestGroupMetrics(gatewayResponses);
            
            // Level 4: Phase Result (aggregates gateway calls)
            const phaseResult: STABLE_WORKFLOW_PHASE_RESULT = {
                workflowId: 'test-wf',
                phaseId: 'phase-1',
                phaseIndex: 0,
                success: true,
                executionTime: 2000,
                timestamp: '2026-01-14T10:00:00.000Z',
                totalRequests: 3,
                successfulRequests: 2,
                failedRequests: 1,
                responses: gatewayResponses
            };

            // Level 5: Workflow Result (aggregates phases)
            const workflowResult: STABLE_WORKFLOW_RESULT = {
                workflowId: 'test-wf',
                success: true,
                executionTime: 2000,
                timestamp: '2026-01-14T10:00:00.000Z',
                totalPhases: 1,
                completedPhases: 1,
                totalRequests: 3,
                successfulRequests: 2,
                failedRequests: 1,
                phases: [phaseResult],
                executionHistory: [],
                requestGroupMetrics: requestGroupMetrics
            };

            // Validate the complete hierarchy
            
            // Request level
            expect(individualRequestMetrics.success).toBe(true);
            expect(individualRequestMetrics.metrics!.totalAttempts).toBe(2);
            
            // Gateway level
            expect(gatewayResponses).toHaveLength(3);
            expect(gatewayResponses.filter(r => r.success).length).toBe(2);
            
            // Request group level
            expect(requestGroupMetrics).toHaveLength(1);
            expect(requestGroupMetrics[0].groupId).toBe('users');
            expect(requestGroupMetrics[0].successRate).toBeCloseTo(66.67, 1);
            
            // Phase level
            expect(phaseResult.totalRequests).toBe(3);
            expect(phaseResult.successfulRequests).toBe(2);
            
            // Workflow level
            expect(workflowResult.totalRequests).toBe(3);
            expect(workflowResult.successfulRequests).toBe(2);
            expect(workflowResult.requestGroupMetrics).toBeDefined();
            expect(workflowResult.requestGroupMetrics).toHaveLength(1);
            
            // Verify metrics consistency across levels
            const phaseMetrics = MetricsAggregator.extractPhaseMetrics(phaseResult);
            const workflowMetrics = MetricsAggregator.extractWorkflowMetrics(workflowResult);
            
            expect(phaseMetrics.totalRequests).toBe(workflowMetrics.totalRequests);
            expect(phaseMetrics.successfulRequests).toBe(workflowMetrics.successfulRequests);
            expect(phaseMetrics.requestSuccessRate).toBeCloseTo(workflowMetrics.requestSuccessRate, 1);
        });
    });
});
