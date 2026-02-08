import type {
  DistributedConfig,
  SchedulerConfig,
  SchedulerState,
} from '../types/index.js';
import { DistributedCoordinator } from './distributed-coordinator.js';
import { DistributedLeaderStatus, DistributedSchedulerKey } from '../enums/index.js';
import { 
  createDistributedCircuitBreaker,
  createDistributedRateLimiter,
  createDistributedConcurrencyLimiter,
  createDistributedCacheManager
} from './distributed-infrastructure.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { RateLimiter } from './rate-limiter.js';
import { ConcurrencyLimiter } from './concurrency-limiter.js';
import { CacheManager } from './cache-manager.js';

export interface DistributedSchedulerOptions<TJob = unknown> {
  distributed: DistributedConfig;
  scheduler?: Omit<SchedulerConfig<TJob>, 'persistence' | 'sharedInfrastructure'>;
  stateKey?: string;
  leaderElectionKey?: string;
  enableLeaderElection?: boolean;
  persistenceDebounceMs?: number;
  circuitBreaker?: {
    failureThresholdPercentage: number;
    minimumRequests: number;
    recoveryTimeoutMs: number;
    successThresholdPercentage?: number;
    halfOpenMaxRequests?: number;
  };
  rateLimiter?: {
    maxRequests: number;
    windowMs: number;
  };
  concurrencyLimiter?: {
    limit: number;
  };
  cacheManager?: {
    enabled: boolean;
    ttl?: number;
    maxSize?: number;
  };
  onBecomeLeader?: () => void | Promise<void>;
  onLoseLeadership?: () => void | Promise<void>;
}

export interface DistributedSchedulerSetup<TJob = unknown> {
  config: SchedulerConfig<TJob>;
  coordinator: DistributedCoordinator;
  isLeader: () => boolean;
  campaignForLeader: () => Promise<void>;
  resignLeadership: () => Promise<void>;
  waitForLeadership: (timeoutMs?: number) => Promise<boolean>;
  disconnect: () => Promise<void>;
}

export const createDistributedSchedulerConfig = async <TJob = unknown>(
  options: DistributedSchedulerOptions<TJob>
): Promise<DistributedSchedulerSetup<TJob>> => {
  const {
    distributed,
    scheduler: baseSchedulerConfig = {},
    stateKey = DistributedSchedulerKey.STATE,
    leaderElectionKey = DistributedSchedulerKey.LEADER,
    enableLeaderElection = distributed.enableLeaderElection ?? true,
    persistenceDebounceMs = 500,
    circuitBreaker: cbConfig,
    rateLimiter: rlConfig,
    concurrencyLimiter: clConfig,
    cacheManager: cmConfig,
    onBecomeLeader,
    onLoseLeadership
  } = options;
  
  const coordinator = new DistributedCoordinator(distributed);
  await coordinator.connect();
  
  let _isLeader = false;
  
  const persistence = {
    enabled: true,
    saveState: async (state: SchedulerState<TJob>): Promise<void> => {
      await coordinator.setState(stateKey, state);
    },
    loadState: async (): Promise<SchedulerState<TJob> | null> => {
      return await coordinator.getState<SchedulerState<TJob>>(stateKey) ?? null;
    },
    persistenceDebounceMs
  };
  
  const sharedInfrastructure: {
    circuitBreaker?: CircuitBreaker;
    rateLimiter?: RateLimiter;
    concurrencyLimiter?: ConcurrencyLimiter;
    cacheManager?: CacheManager;
  } = {};
  
  if (cbConfig) {
    sharedInfrastructure.circuitBreaker = await createDistributedCircuitBreaker({
      distributed,
      ...cbConfig,
      stateKey: DistributedSchedulerKey.CIRCUIT_BREAKER
    });
  }
  
  if (rlConfig) {
    sharedInfrastructure.rateLimiter = await createDistributedRateLimiter({
      distributed,
      ...rlConfig,
      stateKey: DistributedSchedulerKey.RATE_LIMITER
    });
  }
  
  if (clConfig) {
    sharedInfrastructure.concurrencyLimiter = await createDistributedConcurrencyLimiter({
      distributed,
      ...clConfig,
      stateKey: DistributedSchedulerKey.CONCURRENCY_LIMITER
    });
  }
  
  if (cmConfig) {
    sharedInfrastructure.cacheManager = await createDistributedCacheManager({
      distributed,
      ...cmConfig,
      stateKey: DistributedSchedulerKey.CACHE_MANAGER
    });
  }
  
  const config: SchedulerConfig<TJob> = {
    ...baseSchedulerConfig,
    persistence,
    sharedInfrastructure: Object.keys(sharedInfrastructure).length > 0 ? sharedInfrastructure : undefined
  };
  
  const campaignForLeader = async (): Promise<void> => {
    if (!enableLeaderElection) {
      _isLeader = true;
      return;
    }
    
    const state = await coordinator.campaignForLeader({
      electionKey: leaderElectionKey,
      onBecomeLeader: async () => {
        _isLeader = true;
        await onBecomeLeader?.();
      },
      onLoseLeadership: async () => {
        _isLeader = false;
        await onLoseLeadership?.();
      }
    });
    
    _isLeader = state.status === DistributedLeaderStatus.LEADER;
  };
  
  const resignLeadership = async (): Promise<void> => {
    if (!enableLeaderElection) return;
    await coordinator.resignLeadership(leaderElectionKey);
    _isLeader = false;
  };
  
  const waitForLeadership = async (timeoutMs?: number): Promise<boolean> => {
    if (!enableLeaderElection) {
      _isLeader = true;
      return true;
    }
    
    const startTime = Date.now();
    const checkInterval = 1000;
    
    while (true) {
      await campaignForLeader();
      
      if (_isLeader) {
        return true;
      }
      
      if (timeoutMs && (Date.now() - startTime) >= timeoutMs) {
        return false;
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  };
  
  const disconnect = async (): Promise<void> => {
    await resignLeadership();
    await coordinator.disconnect();
  };
  
  return {
    config,
    coordinator,
    isLeader: () => _isLeader,
    campaignForLeader,
    resignLeadership,
    waitForLeadership,
    disconnect
  };
};

export interface RunAsDistributedSchedulerOptions<TJob = unknown> extends DistributedSchedulerOptions<TJob> {
  createScheduler: (config: SchedulerConfig<TJob>) => {
    start: () => void;
    stop: () => void;
  };
}

export interface DistributedSchedulerRunner {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isLeader: () => boolean;
  coordinator: DistributedCoordinator;
}

export const runAsDistributedScheduler = async <TJob = unknown>(
  options: RunAsDistributedSchedulerOptions<TJob>
): Promise<DistributedSchedulerRunner> => {
  const { createScheduler, ...setupOptions } = options;
  
  const setup = await createDistributedSchedulerConfig(setupOptions);
  let scheduler: ReturnType<typeof createScheduler> | null = null;
  let running = false;
  
  const checkLeadershipInterval = setInterval(async () => {
    if (!running) return;
    
    const wasLeader = setup.isLeader();
    await setup.campaignForLeader();
    const isNowLeader = setup.isLeader();
    
    if (!wasLeader && isNowLeader) {
      scheduler = createScheduler(setup.config);
      scheduler.start();
    }
    
    if (wasLeader && !isNowLeader && scheduler) {
      scheduler.stop();
      scheduler = null;
    }
  }, 5000);
  
  return {
    start: async () => {
      running = true;
      
      await setup.campaignForLeader();
      
      if (setup.isLeader()) {
        scheduler = createScheduler(setup.config);
        scheduler.start();
      }
    },
    stop: async () => {
      running = false;
      clearInterval(checkLeadershipInterval);
      
      if (scheduler) {
        scheduler.stop();
        scheduler = null;
      }
      
      await setup.disconnect();
    },
    isLeader: setup.isLeader,
    coordinator: setup.coordinator
  };
};
