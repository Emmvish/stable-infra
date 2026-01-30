import { FunctionCacheConfig, CachedFunctionResponse, FunctionCacheManagerPersistedState, InfrastructurePersistence } from '../types/index.js';
import { getNodeCrypto, simpleHashToHex } from './hash-utils.js';
import { InfrastructurePersistenceCoordinator } from './infrastructure-persistence.js';

const nodeCrypto = getNodeCrypto();

export class FunctionCacheManager {
  private cache: Map<string, CachedFunctionResponse>;
  private config: Omit<FunctionCacheConfig<any, any>, 'persistence'>;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    getTimes: [] as number[],
    setTimes: [] as number[]
  };
  private readonly persistence?: InfrastructurePersistence<FunctionCacheManagerPersistedState>;
  private readonly persistenceCoordinator?: InfrastructurePersistenceCoordinator<FunctionCacheManagerPersistedState>;
  private initialized: boolean = false;

  constructor(config: FunctionCacheConfig<any, any>) {
    this.cache = new Map();
    this.config = {
      enabled: config.enabled,
      ttl: config.ttl ?? 300000,
      maxSize: config.maxSize ?? 1000,
      keyGenerator: config.keyGenerator
    };
    this.persistence = config.persistence;
    this.persistenceCoordinator = this.persistence
      ? new InfrastructurePersistenceCoordinator(this.persistence, 'function-cache-manager')
      : undefined;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    if (this.persistenceCoordinator) {
      try {
        const persistedState = await this.persistenceCoordinator.load();
        if (persistedState) {
          this.restoreState(persistedState);
        }
      } catch (error) {
        console.warn('stable-request: Unable to load function cache manager state from persistence.');
      }
    }
    this.initialized = true;
  }

  private restoreState(persistedState: FunctionCacheManagerPersistedState): void {
    this.cache.clear();
    for (const entry of persistedState.entries) {
      this.cache.set(entry.key, entry.value);
    }
    this.stats.hits = persistedState.stats.hits;
    this.stats.misses = persistedState.stats.misses;
    this.stats.sets = persistedState.stats.sets;
    this.stats.evictions = persistedState.stats.evictions;
  }

  private getPersistedState(): FunctionCacheManagerPersistedState {
    const entries: FunctionCacheManagerPersistedState['entries'] = [];
    for (const [key, value] of this.cache.entries()) {
      entries.push({ key, value });
    }
    return {
      entries,
      stats: {
        hits: this.stats.hits,
        misses: this.stats.misses,
        sets: this.stats.sets,
        evictions: this.stats.evictions
      }
    };
  }

  private async persistState(): Promise<void> {
    if (this.persistenceCoordinator) {
      try {
        await this.persistenceCoordinator.store(this.getPersistedState());
      } catch (error) {
        console.warn('stable-request: Unable to store function cache manager state to persistence.');
      }
    }
  }

  private generateKey<TArgs extends any[]>(fn: (...args: TArgs) => any, args: TArgs): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(fn, args);
    }
    
    const fnName = fn.name || fn.toString();
    const argsString = JSON.stringify(args);
    const keyString = `${fnName}:${argsString}`;

    if (nodeCrypto?.createHash) {
      return nodeCrypto.createHash('md5').update(keyString).digest('hex');
    }

    return simpleHashToHex(keyString);
  }

  get<TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => any, 
    args: TArgs
  ): CachedFunctionResponse<TReturn> | null {
    const startTime = Date.now();
    
    try {
      const key = this.generateKey(fn, args);
      const cached = this.cache.get(key);

      if (!cached) {
        this.stats.misses++;
        return null;
      }

      const now = Date.now();
      if (now > cached.expiresAt) {
        this.cache.delete(key);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return cached as CachedFunctionResponse<TReturn>;
    } finally {
      this.stats.getTimes.push(Date.now() - startTime);
    }
  }

  set<TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => any,
    args: TArgs,
    data: TReturn
  ): void {
    const startTime = Date.now();
    
    try {
      const key = this.generateKey(fn, args);
      const now = Date.now();
      const ttl = this.config.ttl || 300000;

      if (this.cache.size >= (this.config.maxSize || 1000) && !this.cache.has(key)) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.cache.delete(firstKey);
          this.stats.evictions++;
        }
      }

      this.cache.set(key, {
        data,
        timestamp: now,
        expiresAt: now + ttl
      });

      this.stats.sets++;
      this.persistState();
    } finally {
      this.stats.setTimes.push(Date.now() - startTime);
    }
  }

  clear(): void {
    this.cache.clear();
    this.persistState();
  }

  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0,
      sets: this.stats.sets,
      evictions: this.stats.evictions,
      size: this.cache.size,
      maxSize: this.config.maxSize || 1000,
      averageGetTime: this.stats.getTimes.length > 0 
        ? this.stats.getTimes.reduce((a, b) => a + b, 0) / this.stats.getTimes.length 
        : 0,
      averageSetTime: this.stats.setTimes.length > 0 
        ? this.stats.setTimes.reduce((a, b) => a + b, 0) / this.stats.setTimes.length 
        : 0
    };
  }
}

let globalFunctionCacheManager: FunctionCacheManager | null = null;

export function getGlobalFunctionCacheManager(config?: FunctionCacheConfig<any, any>): FunctionCacheManager {
  if (!globalFunctionCacheManager || config) {
    globalFunctionCacheManager = new FunctionCacheManager(config || { enabled: true });
  }
  return globalFunctionCacheManager;
}
