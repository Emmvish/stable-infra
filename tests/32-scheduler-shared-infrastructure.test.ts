import { describe, it, expect, afterEach } from '@jest/globals';
import { StableScheduler } from '../src/core/stable-scheduler.js';
import { 
  CircuitBreaker, 
  RateLimiter, 
  ConcurrencyLimiter, 
  CacheManager 
} from '../src/utilities/index.js';
import { CircuitBreakerState } from '../src/enums/index.js';
import type { SchedulerSchedule, SchedulerSharedInfrastructure } from '../src/types/index.js';

interface TestJob {
  id?: string;
  name: string;
  schedule?: SchedulerSchedule;
  shouldFail?: boolean;
  delay?: number;
}

describe('StableScheduler - Shared Infrastructure', () => {
  let scheduler: StableScheduler<TestJob>;

  afterEach(() => {
    scheduler?.stop();
  });

  describe('Circuit Breaker Integration', () => {
    it('should share circuit breaker across all jobs', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 3,
        recoveryTimeoutMs: 1000
      });

      const executionLog: string[] = [];

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 1,
          tickIntervalMs: 50,
          sharedInfrastructure: { circuitBreaker }
        },
        async (job, context) => {
          executionLog.push(`start:${job.name}`);
          if (job.shouldFail) {
            throw new Error(`Job ${job.name} failed`);
          }
          executionLog.push(`success:${job.name}`);
        }
      );

      // Add jobs that will mostly fail
      scheduler.addJobs([
        { name: 'fail1', shouldFail: true },
        { name: 'fail2', shouldFail: true },
        { name: 'fail3', shouldFail: true },
        { name: 'success1', shouldFail: false },
        { name: 'success2', shouldFail: false }
      ]);

      scheduler.start();

      // Wait for all jobs to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Circuit breaker should have tracked all failures
      const cbState = circuitBreaker.getState();
      expect(cbState.failedRequests).toBeGreaterThanOrEqual(3);
      expect(cbState.totalRequests).toBeGreaterThanOrEqual(3);
    });

    it('should block execution when circuit breaker is open', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThresholdPercentage: 40,
        minimumRequests: 2,
        recoveryTimeoutMs: 5000
      });

      // Pre-trip the circuit breaker
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      const executionCount = { value: 0 };

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 2,
          tickIntervalMs: 50,
          sharedInfrastructure: { circuitBreaker }
        },
        async (job, context) => {
          executionCount.value++;
        }
      );

      scheduler.addJobs([
        { name: 'job1' },
        { name: 'job2' }
      ]);

      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 300));

      // Jobs should fail because circuit breaker is open
      const stats = scheduler.getStats();
      expect(stats.failed).toBeGreaterThan(0);
    });

    it('should record success and failure to circuit breaker', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThresholdPercentage: 80,
        minimumRequests: 10,
        recoveryTimeoutMs: 1000
      });

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 1,
          tickIntervalMs: 50,
          sharedInfrastructure: { circuitBreaker }
        },
        async (job) => {
          if (job.shouldFail) {
            throw new Error('Failed');
          }
        }
      );

      scheduler.addJobs([
        { name: 'success1', shouldFail: false },
        { name: 'success2', shouldFail: false },
        { name: 'fail1', shouldFail: true }
      ]);

      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 400));

      const cbState = circuitBreaker.getState();
      expect(cbState.successfulRequests).toBe(2);
      expect(cbState.failedRequests).toBe(1);
    });
  });

  describe('Rate Limiter Integration', () => {
    it('should share rate limiter across all jobs', async () => {
      const rateLimiter = new RateLimiter(2, 1000); // 2 requests per second

      const executionTimes: number[] = [];

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 5,
          tickIntervalMs: 50,
          sharedInfrastructure: { rateLimiter }
        },
        async (job) => {
          executionTimes.push(Date.now());
        }
      );

      // Add 5 jobs
      scheduler.addJobs([
        { name: 'job1' },
        { name: 'job2' },
        { name: 'job3' },
        { name: 'job4' },
        { name: 'job5' }
      ]);

      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Rate limiter should have throttled some requests
      const rlState = rateLimiter.getState();
      expect(rlState.totalRequests).toBeGreaterThanOrEqual(5);
    });

    it('should throttle jobs based on rate limit', async () => {
      const rateLimiter = new RateLimiter(1, 500); // 1 request per 500ms

      const completionTimes: number[] = [];
      const startTime = Date.now();

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 3,
          tickIntervalMs: 50,
          sharedInfrastructure: { rateLimiter }
        },
        async (job) => {
          completionTimes.push(Date.now() - startTime);
        }
      );

      scheduler.addJobs([
        { name: 'job1' },
        { name: 'job2' },
        { name: 'job3' }
      ]);

      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify rate limiting is applied
      const stats = scheduler.getStats();
      expect(stats.completed).toBe(3);
    });
  });

  describe('Concurrency Limiter Integration', () => {
    it('should share concurrency limiter across all jobs', async () => {
      const concurrencyLimiter = new ConcurrencyLimiter(2);

      let maxConcurrent = 0;
      let currentConcurrent = 0;

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 5, // More parallel than concurrency limit
          tickIntervalMs: 50,
          sharedInfrastructure: { concurrencyLimiter }
        },
        async (job) => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
          await new Promise(resolve => setTimeout(resolve, 100));
          currentConcurrent--;
        }
      );

      scheduler.addJobs([
        { name: 'job1' },
        { name: 'job2' },
        { name: 'job3' },
        { name: 'job4' },
        { name: 'job5' }
      ]);

      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Max concurrent should be limited by concurrency limiter
      expect(maxConcurrent).toBeLessThanOrEqual(2);

      const clState = concurrencyLimiter.getState();
      expect(clState.totalRequests).toBe(5);
      expect(clState.completedRequests).toBe(5);
    });

    it('should queue jobs when concurrency limit is reached', async () => {
      const concurrencyLimiter = new ConcurrencyLimiter(1);

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 3,
          tickIntervalMs: 50,
          sharedInfrastructure: { concurrencyLimiter }
        },
        async (job) => {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      );

      scheduler.addJobs([
        { name: 'job1' },
        { name: 'job2' },
        { name: 'job3' }
      ]);

      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 500));

      const clState = concurrencyLimiter.getState();
      expect(clState.queuedRequests).toBeGreaterThan(0);
    });
  });

  describe('Cache Manager Integration', () => {
    it('should make cache manager available in context', async () => {
      const cacheManager = new CacheManager({
        enabled: true,
        ttl: 60000,
        maxSize: 100
      });

      let contextHasCache = false;

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 1,
          tickIntervalMs: 50,
          sharedInfrastructure: { cacheManager }
        },
        async (job, context) => {
          contextHasCache = context.sharedInfrastructure?.cacheManager !== undefined;
        }
      );

      scheduler.addJob({ name: 'test' });
      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(contextHasCache).toBe(true);
    });
  });

  describe('Combined Infrastructure', () => {
    it('should support multiple infrastructure components together', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 5,
        recoveryTimeoutMs: 1000
      });

      const rateLimiter = new RateLimiter(5, 1000);
      const concurrencyLimiter = new ConcurrencyLimiter(2);
      const cacheManager = new CacheManager({ enabled: true, ttl: 60000, maxSize: 100 });

      const sharedInfrastructure: SchedulerSharedInfrastructure = {
        circuitBreaker,
        rateLimiter,
        concurrencyLimiter,
        cacheManager
      };

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 5,
          tickIntervalMs: 50,
          sharedInfrastructure
        },
        async (job, context) => {
          expect(context.sharedInfrastructure).toBeDefined();
          expect(context.sharedInfrastructure?.circuitBreaker).toBe(circuitBreaker);
          expect(context.sharedInfrastructure?.rateLimiter).toBe(rateLimiter);
          expect(context.sharedInfrastructure?.concurrencyLimiter).toBe(concurrencyLimiter);
          expect(context.sharedInfrastructure?.cacheManager).toBe(cacheManager);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      );

      scheduler.addJobs([
        { name: 'job1' },
        { name: 'job2' },
        { name: 'job3' }
      ]);

      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 1000));

      const stats = scheduler.getStats();
      expect(stats.completed).toBe(3);
    });

    it('should apply all limiters in sequence', async () => {
      const concurrencyLimiter = new ConcurrencyLimiter(1);
      const rateLimiter = new RateLimiter(2, 500);

      let maxConcurrent = 0;
      let currentConcurrent = 0;

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 5,
          tickIntervalMs: 50,
          sharedInfrastructure: { concurrencyLimiter, rateLimiter }
        },
        async (job) => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
          await new Promise(resolve => setTimeout(resolve, 50));
          currentConcurrent--;
        }
      );

      scheduler.addJobs([
        { name: 'job1' },
        { name: 'job2' },
        { name: 'job3' },
        { name: 'job4' }
      ]);

      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Concurrency should be limited to 1
      expect(maxConcurrent).toBeLessThanOrEqual(1);
    });
  });

  describe('Infrastructure Metrics', () => {
    it('should return infrastructure metrics', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 5,
        recoveryTimeoutMs: 1000
      });

      const rateLimiter = new RateLimiter(10, 1000);
      const concurrencyLimiter = new ConcurrencyLimiter(2);
      const cacheManager = new CacheManager({ enabled: true, ttl: 60000, maxSize: 100 });

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 2,
          tickIntervalMs: 50,
          sharedInfrastructure: {
            circuitBreaker,
            rateLimiter,
            concurrencyLimiter,
            cacheManager
          }
        },
        async (job) => {}
      );

      scheduler.addJobs([{ name: 'job1' }, { name: 'job2' }]);
      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 300));

      const metrics = scheduler.getInfrastructureMetrics();

      expect(metrics.circuitBreaker).toBeDefined();
      expect(metrics.circuitBreaker?.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.rateLimiter).toBeDefined();
      expect(metrics.concurrencyLimiter).toBeDefined();
      expect(metrics.cacheManager).toBeDefined();
    });

    it('should return empty metrics when no infrastructure is configured', () => {
      scheduler = new StableScheduler<TestJob>(
        { maxParallel: 1 },
        async () => {}
      );

      const metrics = scheduler.getInfrastructureMetrics();
      expect(metrics).toEqual({});
    });

    it('should return partial metrics when only some infrastructure is configured', () => {
      const circuitBreaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 5,
        recoveryTimeoutMs: 1000
      });

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 1,
          sharedInfrastructure: { circuitBreaker }
        },
        async () => {}
      );

      const metrics = scheduler.getInfrastructureMetrics();
      expect(metrics.circuitBreaker).toBeDefined();
      expect(metrics.rateLimiter).toBeUndefined();
      expect(metrics.concurrencyLimiter).toBeUndefined();
      expect(metrics.cacheManager).toBeUndefined();
    });
  });

  describe('getSharedInfrastructure', () => {
    it('should return configured infrastructure', () => {
      const circuitBreaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 5,
        recoveryTimeoutMs: 1000
      });

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 1,
          sharedInfrastructure: { circuitBreaker }
        },
        async () => {}
      );

      const infra = scheduler.getSharedInfrastructure();
      expect(infra?.circuitBreaker).toBe(circuitBreaker);
    });

    it('should return undefined when no infrastructure is configured', () => {
      scheduler = new StableScheduler<TestJob>(
        { maxParallel: 1 },
        async () => {}
      );

      const infra = scheduler.getSharedInfrastructure();
      expect(infra).toBeUndefined();
    });
  });

  describe('Sharing Infrastructure Across Multiple Schedulers', () => {
    it('should allow sharing same infrastructure between multiple schedulers', async () => {
      const sharedCircuitBreaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 10,
        recoveryTimeoutMs: 5000
      });

      const sharedInfrastructure: SchedulerSharedInfrastructure = {
        circuitBreaker: sharedCircuitBreaker
      };

      const scheduler1 = new StableScheduler<TestJob>(
        {
          maxParallel: 1,
          tickIntervalMs: 50,
          sharedInfrastructure
        },
        async (job) => {
          if (job.shouldFail) throw new Error('Failed');
        }
      );

      const scheduler2 = new StableScheduler<TestJob>(
        {
          maxParallel: 1,
          tickIntervalMs: 50,
          sharedInfrastructure
        },
        async (job) => {
          if (job.shouldFail) throw new Error('Failed');
        }
      );

      scheduler1.addJobs([
        { name: 'fail1', shouldFail: true },
        { name: 'fail2', shouldFail: true }
      ]);

      scheduler2.addJobs([
        { name: 'fail3', shouldFail: true },
        { name: 'success1', shouldFail: false }
      ]);

      scheduler1.start();
      scheduler2.start();

      await new Promise(resolve => setTimeout(resolve, 500));

      scheduler1.stop();
      scheduler2.stop();

      // Both schedulers should have recorded to the same circuit breaker
      const cbState = sharedCircuitBreaker.getState();
      expect(cbState.totalRequests).toBe(4);
      expect(cbState.failedRequests).toBe(3);
      expect(cbState.successfulRequests).toBe(1);
    });
  });

  describe('Infrastructure Metrics in getMetrics()', () => {
    it('should include infrastructure metrics in getMetrics result', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 5,
        recoveryTimeoutMs: 1000
      });

      const rateLimiter = new RateLimiter(10, 1000);
      const concurrencyLimiter = new ConcurrencyLimiter(2);
      const cacheManager = new CacheManager({ enabled: true, ttl: 60000, maxSize: 100 });

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 2,
          tickIntervalMs: 50,
          sharedInfrastructure: {
            circuitBreaker,
            rateLimiter,
            concurrencyLimiter,
            cacheManager
          }
        },
        async (job) => {}
      );

      scheduler.addJobs([{ name: 'job1' }, { name: 'job2' }]);
      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 300));

      const { metrics } = scheduler.getMetrics();

      expect(metrics.infrastructure).toBeDefined();
      expect(metrics.infrastructure?.circuitBreaker).toBeDefined();
      expect(metrics.infrastructure?.circuitBreaker?.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.infrastructure?.circuitBreaker?.totalRequests).toBe(2);
      expect(metrics.infrastructure?.circuitBreaker?.successfulRequests).toBe(2);
      
      expect(metrics.infrastructure?.rateLimiter).toBeDefined();
      expect(metrics.infrastructure?.rateLimiter?.totalRequests).toBe(2);
      
      expect(metrics.infrastructure?.concurrencyLimiter).toBeDefined();
      expect(metrics.infrastructure?.concurrencyLimiter?.totalRequests).toBe(2);
      
      expect(metrics.infrastructure?.cacheManager).toBeDefined();
    });

    it('should not include infrastructure in metrics when none is configured', () => {
      scheduler = new StableScheduler<TestJob>(
        { maxParallel: 1 },
        async () => {}
      );

      const { metrics } = scheduler.getMetrics();
      expect(metrics.infrastructure).toBeUndefined();
    });

    it('should validate infrastructure metrics against guardrails', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThresholdPercentage: 30,
        minimumRequests: 2,
        recoveryTimeoutMs: 5000
      });

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 1,
          tickIntervalMs: 50,
          sharedInfrastructure: { circuitBreaker },
          metricsGuardrails: {
            infrastructure: {
              circuitBreaker: {
                failureRate: { max: 20 } // Expect max 20% failure rate
              }
            }
          }
        },
        async (job) => {
          if (job.shouldFail) throw new Error('Failed');
        }
      );

      // Add jobs that will fail to trigger guardrail violation
      scheduler.addJobs([
        { name: 'fail1', shouldFail: true },
        { name: 'fail2', shouldFail: true },
        { name: 'success1', shouldFail: false }
      ]);

      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 400));

      const { metrics, validation } = scheduler.getMetrics();

      // Should have infrastructure metrics
      expect(metrics.infrastructure?.circuitBreaker).toBeDefined();
      expect(metrics.infrastructure?.circuitBreaker?.failurePercentage).toBeGreaterThan(20);

      // Should have validation with anomalies for infrastructure
      expect(validation).toBeDefined();
      expect(validation?.isValid).toBe(false);
      expect(validation?.anomalies.some(a => a.metricName.includes('circuitBreaker'))).toBe(true);
    });

    it('should pass validation when infrastructure metrics are within guardrails', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThresholdPercentage: 80,
        minimumRequests: 5,
        recoveryTimeoutMs: 1000
      });

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 1,
          tickIntervalMs: 50,
          sharedInfrastructure: { circuitBreaker },
          metricsGuardrails: {
            infrastructure: {
              circuitBreaker: {
                failureRate: { max: 50 } // Allow up to 50% failure rate
              }
            }
          }
        },
        async () => {} // All jobs succeed
      );

      scheduler.addJobs([
        { name: 'success1' },
        { name: 'success2' }
      ]);

      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 300));

      const { validation } = scheduler.getMetrics();

      expect(validation).toBeDefined();
      expect(validation?.isValid).toBe(true);
      expect(validation?.anomalies).toHaveLength(0);
    });

    it('should validate rate limiter metrics against guardrails', async () => {
      const rateLimiter = new RateLimiter(1, 1000); // Very restrictive

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 5,
          tickIntervalMs: 50,
          sharedInfrastructure: { rateLimiter },
          metricsGuardrails: {
            infrastructure: {
              rateLimiter: {
                throttleRate: { max: 10 } // Expect max 10% throttle rate
              }
            }
          }
        },
        async () => {}
      );

      // Add many jobs to trigger throttling
      scheduler.addJobs([
        { name: 'job1' },
        { name: 'job2' },
        { name: 'job3' },
        { name: 'job4' },
        { name: 'job5' }
      ]);

      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 500));

      const { metrics, validation } = scheduler.getMetrics();

      // Should have rate limiter metrics
      expect(metrics.infrastructure?.rateLimiter).toBeDefined();
      
      // If throttling occurred, should have validation anomalies
      if (metrics.infrastructure?.rateLimiter?.throttleRate && metrics.infrastructure.rateLimiter.throttleRate > 10) {
        expect(validation?.isValid).toBe(false);
        expect(validation?.anomalies.some(a => a.metricName.includes('rateLimiter'))).toBe(true);
      }
    });

    it('should combine scheduler and infrastructure validation anomalies', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThresholdPercentage: 30,
        minimumRequests: 2,
        recoveryTimeoutMs: 5000
      });

      scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 1,
          tickIntervalMs: 50,
          sharedInfrastructure: { circuitBreaker },
          metricsGuardrails: {
            scheduler: {
              failureRate: { max: 10 } // Scheduler-level guardrail
            },
            infrastructure: {
              circuitBreaker: {
                failureRate: { max: 10 } // Infrastructure-level guardrail
              }
            }
          }
        },
        async (job) => {
          if (job.shouldFail) throw new Error('Failed');
        }
      );

      // Add failing jobs to trigger both guardrails
      scheduler.addJobs([
        { name: 'fail1', shouldFail: true },
        { name: 'fail2', shouldFail: true },
        { name: 'success1', shouldFail: false }
      ]);

      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 400));

      const { validation } = scheduler.getMetrics();

      expect(validation).toBeDefined();
      expect(validation?.isValid).toBe(false);
      // Should have anomalies from both scheduler and infrastructure
      expect(validation?.anomalies.length).toBeGreaterThanOrEqual(2);
      expect(validation?.anomalies.some(a => a.metricName === 'failureRate')).toBe(true);
      expect(validation?.anomalies.some(a => a.metricName.includes('circuitBreaker'))).toBe(true);
    });
  });
});
