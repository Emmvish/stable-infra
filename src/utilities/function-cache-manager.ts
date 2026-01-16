import { FunctionCacheConfig } from '../types/index.js';
import crypto from 'crypto';

export interface CachedFunctionResponse<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export class FunctionCacheManager {
  private cache: Map<string, CachedFunctionResponse>;
  private config: FunctionCacheConfig<any, any>;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    getTimes: [] as number[],
    setTimes: [] as number[]
  };

  constructor(config: FunctionCacheConfig<any, any>) {
    this.cache = new Map();
    this.config = {
      ttl: 300000,
      maxSize: 1000,
      ...config
    };
  }

  private generateKey<TArgs extends any[]>(fn: (...args: TArgs) => any, args: TArgs): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(fn, args);
    }
    
    const fnName = fn.name || fn.toString();
    const argsString = JSON.stringify(args);
    const hash = crypto.createHash('md5').update(`${fnName}:${argsString}`).digest('hex');
    return hash;
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
    } finally {
      this.stats.setTimes.push(Date.now() - startTime);
    }
  }

  clear(): void {
    this.cache.clear();
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
