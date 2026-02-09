import type {
  DistributedConfig,
  CircuitBreakerPersistedState,
  RateLimiterPersistedState,
  ConcurrencyLimiterPersistedState,
  CacheManagerPersistedState,
  FunctionCacheManagerPersistedState,
  CircuitBreakerConfig,
  RateLimitConfig,
  ConcurrencyLimiterConfig,
  CacheConfig,
  FunctionCacheConfig,
  DistributedInfrastructureOptions,
  DistributedCircuitBreakerOptions,
  DistributedRateLimiterOptions,
  DistributedConcurrencyLimiterOptions,
  DistributedCacheManagerOptions,
  DistributedFunctionCacheManagerOptions,
  DistributedInfrastructureBundle,
  CreateDistributedInfrastructureBundleOptions
} from '../types/index.js';
import { DistributedCoordinator } from './distributed-coordinator.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { RateLimiter } from './rate-limiter.js';
import { ConcurrencyLimiter } from './concurrency-limiter.js';
import { CacheManager } from './cache-manager.js';
import { FunctionCacheManager } from './function-cache-manager.js';
import { DEFAULT_STATE_KEY_PREFIX } from '../constants/index.js';
import { DistributedInfrastructureKey } from '../enums/index.js';


const createDistributedPersistence = <TState>(
  coordinator: DistributedCoordinator,
  stateKey: string
) => {
  return {
    load: async (): Promise<TState | null> => {
      const state = await coordinator.getState<TState>(stateKey);
      return state ?? null;
    },
    store: async (state: TState): Promise<void> => {
      await coordinator.setState(stateKey, state);
    }
  };
};

export const createDistributedCircuitBreaker = async (
  options: DistributedCircuitBreakerOptions
): Promise<CircuitBreaker> => {
  const { distributed, stateKey = DistributedInfrastructureKey.CIRCUIT_BREAKER, ...circuitBreakerConfig } = options;
  
  const coordinator = new DistributedCoordinator(distributed);
  await coordinator.connect();
  
  const persistence = createDistributedPersistence<CircuitBreakerPersistedState>(
    coordinator,
    `${DEFAULT_STATE_KEY_PREFIX}:${stateKey}`
  );
  
  const circuitBreaker = new CircuitBreaker({
    ...circuitBreakerConfig,
    persistence
  });
  
  await circuitBreaker.initialize();
  
  return circuitBreaker;
};

export const createDistributedRateLimiter = async (
  options: DistributedRateLimiterOptions
): Promise<RateLimiter> => {
  const { distributed, stateKey = DistributedInfrastructureKey.RATE_LIMITER, ...rateLimiterConfig } = options;
  
  const coordinator = new DistributedCoordinator(distributed);
  await coordinator.connect();
  
  const persistence = createDistributedPersistence<RateLimiterPersistedState>(
    coordinator,
    `${DEFAULT_STATE_KEY_PREFIX}:${stateKey}`
  );
  
  const rateLimiter = new RateLimiter({
    ...rateLimiterConfig,
    persistence
  });
  
  await rateLimiter.initialize();
  
  return rateLimiter;
};

export const createDistributedConcurrencyLimiter = async (
  options: DistributedConcurrencyLimiterOptions
): Promise<ConcurrencyLimiter> => {
  const { distributed, stateKey = DistributedInfrastructureKey.CONCURRENCY_LIMITER, ...limiterConfig } = options;
  
  const coordinator = new DistributedCoordinator(distributed);
  await coordinator.connect();
  
  const persistence = createDistributedPersistence<ConcurrencyLimiterPersistedState>(
    coordinator,
    `${DEFAULT_STATE_KEY_PREFIX}:${stateKey}`
  );
  
  const limiter = new ConcurrencyLimiter({
    ...limiterConfig,
    persistence
  });
  
  await limiter.initialize();
  
  return limiter;
};

export const createDistributedCacheManager = async (
  options: DistributedCacheManagerOptions
): Promise<CacheManager> => {
  const { distributed, stateKey = DistributedInfrastructureKey.CACHE_MANAGER, ...cacheConfig } = options;
  
  const coordinator = new DistributedCoordinator(distributed);
  await coordinator.connect();
  
  const persistence = createDistributedPersistence<CacheManagerPersistedState>(
    coordinator,
    `${DEFAULT_STATE_KEY_PREFIX}:${stateKey}`
  );
  
  const cacheManager = new CacheManager({
    ...cacheConfig,
    persistence
  });
  
  await cacheManager.initialize();
  
  return cacheManager;
};

export const createDistributedFunctionCacheManager = async (
  options: DistributedFunctionCacheManagerOptions
): Promise<FunctionCacheManager> => {
  const { distributed, stateKey = DistributedInfrastructureKey.FUNCTION_CACHE_MANAGER, ...cacheConfig } = options;
  
  const coordinator = new DistributedCoordinator(distributed);
  await coordinator.connect();
  
  const persistence = createDistributedPersistence<FunctionCacheManagerPersistedState>(
    coordinator,
    `${DEFAULT_STATE_KEY_PREFIX}:${stateKey}`
  );
  
  const functionCacheManager = new FunctionCacheManager({
    ...cacheConfig,
    persistence
  });
  
  await functionCacheManager.initialize();
  
  return functionCacheManager;
};

export const createDistributedInfrastructureBundle = async (
  options: CreateDistributedInfrastructureBundleOptions
): Promise<DistributedInfrastructureBundle> => {
  const { 
    distributed, 
    stateKeyPrefix = DEFAULT_STATE_KEY_PREFIX,
    circuitBreaker: cbConfig,
    rateLimiter: rlConfig,
    concurrencyLimiter: clConfig,
    cacheManager: cmConfig,
    functionCacheManager: fcmConfig
  } = options;
  
  const coordinator = new DistributedCoordinator(distributed);
  await coordinator.connect();
  
  const bundle: DistributedInfrastructureBundle = {
    coordinator,
    disconnect: async () => {
      await coordinator.disconnect();
    }
  };
  
  if (cbConfig) {
    const persistence = createDistributedPersistence<CircuitBreakerPersistedState>(
      coordinator,
      `${stateKeyPrefix}:${DistributedInfrastructureKey.CIRCUIT_BREAKER}`
    );
    bundle.circuitBreaker = new CircuitBreaker({ ...cbConfig, persistence });
    await bundle.circuitBreaker.initialize();
  }
  
  if (rlConfig) {
    const persistence = createDistributedPersistence<RateLimiterPersistedState>(
      coordinator,
      `${stateKeyPrefix}:${DistributedInfrastructureKey.RATE_LIMITER}`
    );
    bundle.rateLimiter = new RateLimiter({ ...rlConfig, persistence });
    await bundle.rateLimiter.initialize();
  }
  
  if (clConfig) {
    const persistence = createDistributedPersistence<ConcurrencyLimiterPersistedState>(
      coordinator,
      `${stateKeyPrefix}:${DistributedInfrastructureKey.CONCURRENCY_LIMITER}`
    );
    bundle.concurrencyLimiter = new ConcurrencyLimiter({ ...clConfig, persistence });
    await bundle.concurrencyLimiter.initialize();
  }
  
  if (cmConfig) {
    const persistence = createDistributedPersistence<CacheManagerPersistedState>(
      coordinator,
      `${stateKeyPrefix}:${DistributedInfrastructureKey.CACHE_MANAGER}`
    );
    bundle.cacheManager = new CacheManager({ ...cmConfig, persistence });
    await bundle.cacheManager.initialize();
  }
  
  if (fcmConfig) {
    const persistence = createDistributedPersistence<FunctionCacheManagerPersistedState>(
      coordinator,
      `${stateKeyPrefix}:${DistributedInfrastructureKey.FUNCTION_CACHE_MANAGER}`
    );
    bundle.functionCacheManager = new FunctionCacheManager({ ...fcmConfig, persistence });
    await bundle.functionCacheManager.initialize();
  }
  
  return bundle;
};
