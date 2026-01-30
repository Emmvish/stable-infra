import {
  CircuitBreaker,
  RateLimiter,
  ConcurrencyLimiter,
  CacheManager,
  FunctionCacheManager
} from '../src/utilities/index.js';
import {
  CircuitBreakerPersistedState,
  RateLimiterPersistedState,
  ConcurrencyLimiterPersistedState,
  CacheManagerPersistedState,
  FunctionCacheManagerPersistedState
} from '../src/types/index.js';
import { CircuitBreakerState } from '../src/enums/index.js';

const flushPersistence = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Infrastructure Persistence', () => {
  describe('CircuitBreaker Persistence', () => {
    it('should persist state on state changes', async () => {
      const storedStates: CircuitBreakerPersistedState[] = [];
      
      const breaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 2,
        recoveryTimeoutMs: 1000,
        persistence: {
          store: (state) => {
            storedStates.push({ ...state });
          }
        }
      });

      // Record success
      breaker.recordSuccess();
      await flushPersistence();
      expect(storedStates.length).toBeGreaterThanOrEqual(1);
      expect(storedStates[storedStates.length - 1].successfulRequests).toBe(1);
      expect(storedStates[storedStates.length - 1].state).toBe(CircuitBreakerState.CLOSED);

      // Record failure
      breaker.recordFailure();
      await flushPersistence();
      expect(storedStates.length).toBeGreaterThanOrEqual(2);
      expect(storedStates[storedStates.length - 1].failedRequests).toBe(1);

      // Record another failure (should trip circuit - triggers additional persist on transition)
      const countBeforeTrip = storedStates.length;
      breaker.recordFailure();
      await flushPersistence();
      expect(storedStates.length).toBeGreaterThan(countBeforeTrip);
      expect(storedStates[storedStates.length - 1].state).toBe(CircuitBreakerState.OPEN);
    });

    it('should load persisted state on initialize', async () => {
      const persistedState: CircuitBreakerPersistedState = {
        state: CircuitBreakerState.OPEN,
        totalRequests: 10,
        failedRequests: 8,
        successfulRequests: 2,
        totalAttempts: 0,
        failedAttempts: 0,
        successfulAttempts: 0,
        lastFailureTime: Date.now() - 500,
        halfOpenRequests: 0,
        halfOpenSuccesses: 0,
        halfOpenFailures: 0,
        stateTransitions: 1,
        lastStateChangeTime: Date.now() - 1000,
        openCount: 1,
        halfOpenCount: 0,
        totalOpenDuration: 0,
        lastOpenTime: Date.now() - 500,
        recoveryAttempts: 0,
        successfulRecoveries: 0,
        failedRecoveries: 0
      };

      const breaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 5,
        recoveryTimeoutMs: 10000,
        persistence: {
          load: () => persistedState
        }
      });

      await breaker.initialize();

      const state = breaker.getState();
      expect(state.state).toBe(CircuitBreakerState.OPEN);
      expect(state.totalRequests).toBe(10);
      expect(state.failedRequests).toBe(8);
      expect(state.openCount).toBe(1);
    });

    it('should handle async persistence functions', async () => {
      let storedState: CircuitBreakerPersistedState | null = null;
      
      const breaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 2,
        recoveryTimeoutMs: 1000,
        persistence: {
          store: async (state) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            storedState = { ...state };
          },
          load: async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return null;
          }
        }
      });

      await breaker.initialize();
      breaker.recordSuccess();
      
      // Wait for async store
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(storedState!.successfulRequests).toBe(1);
    });

    it('should silently handle load errors', async () => {
      const breaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 2,
        recoveryTimeoutMs: 1000,
        persistence: {
          load: () => {
            throw new Error('Load failed');
          }
        }
      });

      // Should not throw
      await breaker.initialize();
      
      // Should work normally
      breaker.recordSuccess();
      expect(breaker.getState().successfulRequests).toBe(1);
    });

    it('should persist on reset', async () => {
      let storeCount = 0;
      
      const breaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 2,
        recoveryTimeoutMs: 1000,
        persistence: {
          store: () => { storeCount++; }
        }
      });

      breaker.recordFailure();
      breaker.recordFailure();
      const countBeforeReset = storeCount;
      
      breaker.reset();
      await flushPersistence();
      expect(storeCount).toBeGreaterThanOrEqual(countBeforeReset + 1);
      expect(breaker.getState().state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('RateLimiter Persistence', () => {
    it('should persist state on token consumption', async () => {
      const storedStates: RateLimiterPersistedState[] = [];
      
      const limiter = new RateLimiter({
        maxRequests: 5,
        windowMs: 1000,
        persistence: {
          store: (state) => {
            storedStates.push({ ...state });
          }
        }
      });

      await limiter.execute(async () => 'result');
      await flushPersistence();
      expect(storedStates.length).toBeGreaterThanOrEqual(1);
      expect(storedStates[storedStates.length - 1].completedRequests).toBe(1);
    });

    it('should load persisted state on initialize', async () => {
      const persistedState: RateLimiterPersistedState = {
        tokens: 2,
        lastRefillTime: Date.now(),
        totalRequests: 100,
        throttledRequests: 10,
        completedRequests: 90,
        peakQueueLength: 5,
        totalQueueWaitTime: 500,
        peakRequestRate: 10,
        requestsInCurrentWindow: 3,
        windowStartTime: Date.now()
      };

      const limiter = new RateLimiter({
        maxRequests: 5,
        windowMs: 1000,
        persistence: {
          load: () => persistedState
        }
      });

      await limiter.initialize();

      const state = limiter.getState();
      expect(state.totalRequests).toBe(100);
      expect(state.completedRequests).toBe(90);
      expect(state.throttledRequests).toBe(10);
    });

    it('should work with constructor overload (numbers)', async () => {
      const storedStates: RateLimiterPersistedState[] = [];
      
      const limiter = new RateLimiter(5, 1000, {
        store: (state) => { storedStates.push({ ...state }); }
      });

      await limiter.execute(async () => 'result');
      await flushPersistence();
      expect(storedStates.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ConcurrencyLimiter Persistence', () => {
    it('should persist state after execution', async () => {
      const storedStates: ConcurrencyLimiterPersistedState[] = [];
      
      const limiter = new ConcurrencyLimiter({
        limit: 2,
        persistence: {
          store: (state) => {
            storedStates.push({ ...state });
          }
        }
      });

      await limiter.execute(async () => 'result');
      await flushPersistence();
      expect(storedStates.length).toBeGreaterThanOrEqual(1);
      expect(storedStates[storedStates.length - 1].completedRequests).toBe(1);
    });

    it('should load persisted state on initialize', async () => {
      const persistedState: ConcurrencyLimiterPersistedState = {
        totalRequests: 50,
        completedRequests: 45,
        failedRequests: 5,
        queuedRequests: 20,
        peakConcurrency: 10,
        peakQueueLength: 15,
        totalQueueWaitTime: 1000,
        totalExecutionTime: 5000
      };

      const limiter = new ConcurrencyLimiter({
        limit: 5,
        persistence: {
          load: () => persistedState
        }
      });

      await limiter.initialize();

      const state = limiter.getState();
      expect(state.totalRequests).toBe(50);
      expect(state.completedRequests).toBe(45);
      expect(state.failedRequests).toBe(5);
    });

    it('should persist on failure', async () => {
      let lastState: ConcurrencyLimiterPersistedState | null = null;
      
      const limiter = new ConcurrencyLimiter({
        limit: 2,
        persistence: {
          store: (state) => {
            lastState = { ...state };
          }
        }
      });

      try {
        await limiter.execute(async () => {
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }
      await flushPersistence();
      expect(lastState!.failedRequests).toBe(1);
    });

    it('should work with constructor overload (number)', async () => {
      const storedStates: ConcurrencyLimiterPersistedState[] = [];
      
      const limiter = new ConcurrencyLimiter(2, {
        store: (state) => { storedStates.push({ ...state }); }
      });

      await limiter.execute(async () => 'result');
      await flushPersistence();
      expect(storedStates.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('CacheManager Persistence', () => {
    it('should persist state on cache set', async () => {
      const storedStates: CacheManagerPersistedState[] = [];
      
      const cache = new CacheManager({
        enabled: true,
        ttl: 60000,
        persistence: {
          store: (state) => {
            storedStates.push(JSON.parse(JSON.stringify(state)));
          }
        }
      });

      cache.set({ url: '/test', method: 'GET' }, { data: 'test' }, 200, 'OK', {});
      await flushPersistence();
      
      expect(storedStates.length).toBe(1);
      expect(storedStates[0].entries.length).toBe(1);
      expect(storedStates[0].sets).toBe(1);
    });

    it('should load persisted entries on initialize', async () => {
      const now = Date.now();
      const persistedState: CacheManagerPersistedState = {
        entries: [
          {
            key: 'test-key',
            value: {
              data: { result: 'cached' },
              status: 200,
              statusText: 'OK',
              headers: {},
              timestamp: now,
              expiresAt: now + 60000
            }
          }
        ],
        accessOrder: ['test-key'],
        hits: 10,
        misses: 5,
        sets: 15,
        evictions: 2,
        expirations: 1
      };

      const cache = new CacheManager({
        enabled: true,
        persistence: {
          load: () => persistedState
        }
      });

      await cache.initialize();

      const stats = cache.getStats();
      expect(stats.hits).toBe(10);
      expect(stats.misses).toBe(5);
      expect(stats.sets).toBe(15);
      expect(stats.size).toBe(1);
    });

    it('should persist on clear', async () => {
      let lastState: CacheManagerPersistedState | null = null;
      
      const cache = new CacheManager({
        enabled: true,
        ttl: 60000,
        persistence: {
          store: (state) => {
            lastState = JSON.parse(JSON.stringify(state));
          }
        }
      });

      cache.set({ url: '/test', method: 'GET' }, { data: 'test' }, 200, 'OK', {});
      cache.clear();
      await flushPersistence();
      
      expect(lastState!.entries.length).toBe(0);
    });

    it('should persist on delete', async () => {
      let lastState: CacheManagerPersistedState | null = null;
      
      const cache = new CacheManager({
        enabled: true,
        ttl: 60000,
        persistence: {
          store: (state) => {
            lastState = JSON.parse(JSON.stringify(state));
          }
        }
      });

      cache.set({ url: '/test', method: 'GET' }, { data: 'test' }, 200, 'OK', {});
      const deleted = cache.delete({ url: '/test', method: 'GET' });
      await flushPersistence();
      
      expect(deleted).toBe(true);
      expect(lastState!.entries.length).toBe(0);
    });

    it('should persist on prune', async () => {
      let storeCount = 0;
      
      const cache = new CacheManager({
        enabled: true,
        ttl: 1, // Very short TTL
        persistence: {
          store: () => { storeCount++; }
        }
      });

      cache.set({ url: '/test', method: 'GET' }, { data: 'test' }, 200, 'OK', {});
      const countAfterSet = storeCount;
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const prunedCount = cache.prune();
      await flushPersistence();
      expect(prunedCount).toBe(1);
      expect(storeCount).toBeGreaterThanOrEqual(countAfterSet + 1);
    });
  });

  describe('FunctionCacheManager Persistence', () => {
    it('should persist state on cache set', async () => {
      const storedStates: FunctionCacheManagerPersistedState[] = [];
      
      const cache = new FunctionCacheManager({
        enabled: true,
        ttl: 60000,
        persistence: {
          store: (state) => {
            storedStates.push(JSON.parse(JSON.stringify(state)));
          }
        }
      });

      const testFn = (x: number) => x * 2;
      cache.set(testFn, [5], 10);
      await flushPersistence();
      
      expect(storedStates.length).toBe(1);
      expect(storedStates[0].entries.length).toBe(1);
      expect(storedStates[0].stats.sets).toBe(1);
    });

    it('should load persisted entries on initialize', async () => {
      const now = Date.now();
      const persistedState: FunctionCacheManagerPersistedState = {
        entries: [
          {
            key: 'test-fn-key',
            value: {
              data: 'cached-result',
              timestamp: now,
              expiresAt: now + 60000
            }
          }
        ],
        stats: {
          hits: 20,
          misses: 10,
          sets: 30,
          evictions: 5
        }
      };

      const cache = new FunctionCacheManager({
        enabled: true,
        persistence: {
          load: () => persistedState
        }
      });

      await cache.initialize();

      const stats = cache.getStats();
      expect(stats.hits).toBe(20);
      expect(stats.misses).toBe(10);
      expect(stats.sets).toBe(30);
      expect(stats.evictions).toBe(5);
    });

    it('should persist on clear', async () => {
      let lastState: FunctionCacheManagerPersistedState | null = null;
      
      const cache = new FunctionCacheManager({
        enabled: true,
        ttl: 60000,
        persistence: {
          store: (state) => {
            lastState = JSON.parse(JSON.stringify(state));
          }
        }
      });

      const testFn = (x: number) => x * 2;
      cache.set(testFn, [5], 10);
      cache.clear();
      await flushPersistence();
      
      expect(lastState!.entries.length).toBe(0);
    });
  });

  describe('Multiple instances with shared persistence', () => {
    it('should allow state transfer between instances', async () => {
      // First instance accumulates state
      let sharedStorage: CircuitBreakerPersistedState | null = null;
      
      const breaker1 = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 10,
        recoveryTimeoutMs: 1000,
        persistence: {
          store: (state) => { sharedStorage = { ...state }; }
        }
      });

      breaker1.recordSuccess();
      breaker1.recordSuccess();
      breaker1.recordFailure();
      await flushPersistence();

      // Second instance loads state from first
      const breaker2 = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 10,
        recoveryTimeoutMs: 1000,
        persistence: {
          load: () => sharedStorage,
          store: (state) => { sharedStorage = { ...state }; }
        }
      });

      await breaker2.initialize();

      const state = breaker2.getState();
      expect(state.totalRequests).toBe(3);
      expect(state.successfulRequests).toBe(2);
      expect(state.failedRequests).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle null return from load', async () => {
      const breaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 2,
        recoveryTimeoutMs: 1000,
        persistence: {
          load: () => null
        }
      });

      await breaker.initialize();
      expect(breaker.getState().totalRequests).toBe(0);
    });

    it('should handle undefined return from load', async () => {
      const breaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 2,
        recoveryTimeoutMs: 1000,
        persistence: {
          load: () => undefined
        }
      });

      await breaker.initialize();
      expect(breaker.getState().totalRequests).toBe(0);
    });

    it('should only initialize once', async () => {
      let loadCount = 0;
      
      const breaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 2,
        recoveryTimeoutMs: 1000,
        persistence: {
          load: () => {
            loadCount++;
            return null;
          }
        }
      });

      await breaker.initialize();
      await breaker.initialize();
      await breaker.initialize();

      expect(loadCount).toBe(1);
    });

    it('should silently handle store errors', async () => {
      const breaker = new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 2,
        recoveryTimeoutMs: 1000,
        persistence: {
          store: () => {
            throw new Error('Store failed');
          }
        }
      });

      // Should not throw
      breaker.recordSuccess();
      expect(breaker.getState().successfulRequests).toBe(1);
    });
  });
});
