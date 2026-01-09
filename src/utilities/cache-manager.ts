import * as crypto from 'crypto';
import { AxiosRequestConfig } from 'axios';
import { CachedResponse, CacheConfig } from '../types/index.js';

export class CacheManager {
    private cache: Map<string, CachedResponse>;
    private config: Required<Omit<CacheConfig, 'keyGenerator'>> & { keyGenerator?: CacheConfig['keyGenerator'] };
    private accessOrder: string[] = []; 

    constructor(config: CacheConfig) {
        this.cache = new Map();
        this.config = {
            enabled: config.enabled,
            ttl: config.ttl ?? 300000,
            respectCacheControl: config.respectCacheControl ?? true,
            cacheableStatusCodes: config.cacheableStatusCodes ?? [200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501],
            maxSize: config.maxSize ?? 100,
            excludeMethods: config.excludeMethods ?? ['POST', 'PUT', 'PATCH', 'DELETE'],
            keyGenerator: config.keyGenerator
        };
    }

    private generateKey(reqConfig: AxiosRequestConfig): string {
        if (this.config.keyGenerator) {
            return this.config.keyGenerator(reqConfig);
        }

        const method = (reqConfig.method || 'GET').toUpperCase();
        const url = reqConfig.url || '';
        const params = reqConfig.params ? JSON.stringify(reqConfig.params) : '';
        
        const relevantHeaders = ['accept', 'accept-encoding', 'accept-language', 'authorization'];
        const headers = reqConfig.headers || {};
        const headerString = relevantHeaders
            .filter(h => headers[h])
            .map(h => `${h}:${headers[h]}`)
            .join('|');

        const keyString = `${method}:${url}:${params}:${headerString}`;
        
        return crypto.createHash('sha256').update(keyString).digest('hex');
    }

    private shouldCacheMethod(method?: string): boolean {
        if (!method) return true;
        return !this.config.excludeMethods.includes(method.toUpperCase());
    }

    private shouldCacheStatus(status: number): boolean {
        return this.config.cacheableStatusCodes.includes(status);
    }

    private parseCacheControl(headers: Record<string, any>): number | null {
        if (!this.config.respectCacheControl) {
            return null;
        }

        const cacheControl = headers['cache-control'] || headers['Cache-Control'];
        if (cacheControl && typeof cacheControl === 'string') {
            if (cacheControl.includes('no-cache') || cacheControl.includes('no-store')) {
                return 0;
            }

            const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
            if (maxAgeMatch) {
                return parseInt(maxAgeMatch[1]) * 1000;
            }
        }

        // Check Expires header if no cache-control max-age was found
        const expires = headers['expires'] || headers['Expires'];
        if (expires) {
            const expiresDate = new Date(expires);
            const now = new Date();
            const ttl = expiresDate.getTime() - now.getTime();
            return ttl > 0 ? ttl : 0;
        }

        return null;
    }

    get<T = any>(reqConfig: AxiosRequestConfig): CachedResponse<T> | null {
        if (!this.config.enabled) {
            return null;
        }

        if (!this.shouldCacheMethod(reqConfig.method)) {
            return null;
        }

        const key = this.generateKey(reqConfig);
        const cached = this.cache.get(key);

        if (!cached) {
            return null;
        }

        const now = Date.now();
        
        if (now > cached.expiresAt) {
            this.cache.delete(key);
            this.accessOrder = this.accessOrder.filter(k => k !== key);
            return null;
        }

        this.accessOrder = this.accessOrder.filter(k => k !== key);
        this.accessOrder.push(key);

        return cached as CachedResponse<T>;
    }

    set<T = any>(
        reqConfig: AxiosRequestConfig,
        data: T,
        status: number,
        statusText: string,
        headers: Record<string, any>
    ): void {
        if (!this.config.enabled) {
            return;
        }

        if (!this.shouldCacheMethod(reqConfig.method)) {
            return;
        }

        if (!this.shouldCacheStatus(status)) {
            return;
        }

        const key = this.generateKey(reqConfig);
        const now = Date.now();

        let ttl = this.config.ttl;
        const cacheControlTtl = this.parseCacheControl(headers);
        
        if (cacheControlTtl !== null) {
            if (cacheControlTtl === 0) {
                return;
            }
            ttl = cacheControlTtl;
        }

        const cached: CachedResponse<T> = {
            data,
            status,
            statusText,
            headers,
            timestamp: now,
            expiresAt: now + ttl
        };

        if (this.cache.size >= this.config.maxSize) {
            const oldestKey = this.accessOrder.shift();
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(key, cached);
        this.accessOrder.push(key);
    }

    clear(): void {
        this.cache.clear();
        this.accessOrder = [];
    }

    delete(reqConfig: AxiosRequestConfig): boolean {
        const key = this.generateKey(reqConfig);
        this.accessOrder = this.accessOrder.filter(k => k !== key);
        return this.cache.delete(key);
    }

    getStats() {
        const now = Date.now();
        const entries = Array.from(this.cache.entries());
        const validEntries = entries.filter(([_, cached]) => now <= cached.expiresAt);

        return {
            size: this.cache.size,
            validEntries: validEntries.length,
            expiredEntries: this.cache.size - validEntries.length,
            maxSize: this.config.maxSize,
            oldestEntry: entries.length > 0 
                ? Math.min(...entries.map(([_, cached]) => cached.timestamp))
                : null,
            newestEntry: entries.length > 0
                ? Math.max(...entries.map(([_, cached]) => cached.timestamp))
                : null
        };
    }

    prune(): number {
        const now = Date.now();
        let prunedCount = 0;

        for (const [key, cached] of Array.from(this.cache.entries())) {
            if (now > cached.expiresAt) {
                this.cache.delete(key);
                this.accessOrder = this.accessOrder.filter(k => k !== key);
                prunedCount++;
            }
        }

        return prunedCount;
    }
}

let globalCacheManager: CacheManager | null = null;

export function getGlobalCacheManager(config?: CacheConfig): CacheManager {
    if (!globalCacheManager && config) {
        globalCacheManager = new CacheManager(config);
    }
    return globalCacheManager!;
}

export function resetGlobalCacheManager(): void {
    if (globalCacheManager) {
        globalCacheManager.clear();
    }
    globalCacheManager = null;
}