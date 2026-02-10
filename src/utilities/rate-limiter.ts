import { RateLimitConfig, RateLimiterPersistedState, InfrastructurePersistence } from '../types/index.js';
import { InfrastructurePersistenceCoordinator } from './infrastructure-persistence.js';

export class RateLimiter {
    private readonly maxRequests: number;
    private readonly windowMs: number;
    private tokens: number;
    private lastRefillTime: number;
    private readonly queue: Array<() => void> = [];    
    private totalRequests: number = 0;
    private throttledRequests: number = 0;
    private completedRequests: number = 0;
    private peakQueueLength: number = 0;
    private totalQueueWaitTime: number = 0;
    private peakRequestRate: number = 0;
    private requestsInCurrentWindow: number = 0;
    private windowStartTime: number = Date.now();
    private readonly persistence?: InfrastructurePersistence<RateLimiterPersistedState>;
    private readonly persistenceCoordinator?: InfrastructurePersistenceCoordinator<RateLimiterPersistedState>;
    private initialized: boolean = false;

    constructor(maxRequests: number, windowMs: number, persistence?: InfrastructurePersistence<RateLimiterPersistedState>);
    constructor(config: RateLimitConfig);
    constructor(maxRequestsOrConfig: number | RateLimitConfig, windowMs?: number, persistence?: InfrastructurePersistence<RateLimiterPersistedState>) {
        if (typeof maxRequestsOrConfig === 'object') {
            this.maxRequests = Math.max(1, Math.floor(maxRequestsOrConfig.maxRequests));
            this.windowMs = Math.max(100, maxRequestsOrConfig.windowMs);
            this.persistence = maxRequestsOrConfig.persistence;
        } else {
            this.maxRequests = Math.max(1, Math.floor(maxRequestsOrConfig));
            this.windowMs = Math.max(100, windowMs!);
            this.persistence = persistence;
        }
        this.persistenceCoordinator = this.persistence
            ? new InfrastructurePersistenceCoordinator(this.persistence, 'rate-limiter')
            : undefined;
        this.tokens = this.maxRequests;
        this.lastRefillTime = Date.now();
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        await this.reloadFromPersistence();
        this.initialized = true;
    }

    async reloadFromPersistence(): Promise<void> {
        if (this.persistenceCoordinator) {
            try {
                const persistedState = await this.persistenceCoordinator.load();
                if (persistedState) {
                    this.restoreState(persistedState);
                }
            } catch (error) {
                console.warn('stable-infra: Unable to load rate limiter state from persistence.');
            }
        }
    }

    private restoreState(persistedState: RateLimiterPersistedState): void {
        this.tokens = persistedState.tokens;
        this.lastRefillTime = persistedState.lastRefillTime;
        this.totalRequests = persistedState.totalRequests;
        this.throttledRequests = persistedState.throttledRequests;
        this.completedRequests = persistedState.completedRequests;
        this.peakQueueLength = persistedState.peakQueueLength;
        this.totalQueueWaitTime = persistedState.totalQueueWaitTime;
        this.peakRequestRate = persistedState.peakRequestRate;
        this.requestsInCurrentWindow = persistedState.requestsInCurrentWindow;
        this.windowStartTime = persistedState.windowStartTime;
    }

    private getPersistedState(): RateLimiterPersistedState {
        return {
            tokens: this.tokens,
            lastRefillTime: this.lastRefillTime,
            totalRequests: this.totalRequests,
            throttledRequests: this.throttledRequests,
            completedRequests: this.completedRequests,
            peakQueueLength: this.peakQueueLength,
            totalQueueWaitTime: this.totalQueueWaitTime,
            peakRequestRate: this.peakRequestRate,
            requestsInCurrentWindow: this.requestsInCurrentWindow,
            windowStartTime: this.windowStartTime
        };
    }

    private async persistState(): Promise<void> {
        if (this.persistenceCoordinator) {
            try {
                await this.persistenceCoordinator.store(this.getPersistedState());
            } catch (error) {
                console.warn('stable-infra: Unable to store rate limiter state to persistence.');
            }
        }
    }

    private refillTokens(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefillTime;
        
        if (elapsed >= this.windowMs) {
            const windowsPassed = Math.floor(elapsed / this.windowMs);
            this.tokens = Math.min(this.maxRequests, this.tokens + (windowsPassed * this.maxRequests));
            this.lastRefillTime = now;
            this.requestsInCurrentWindow = 0;
            this.windowStartTime = now;
        }
    }

    private async acquire(): Promise<void> {
        this.totalRequests++;
        this.refillTokens();

        if (this.tokens > 0) {
            this.tokens--;
            this.requestsInCurrentWindow++;
            this.peakRequestRate = Math.max(this.peakRequestRate, this.requestsInCurrentWindow);
            this.persistState();
            return Promise.resolve();
        }

        this.throttledRequests++;
        const queueStartTime = Date.now();
        
        return new Promise<void>((resolve) => {
            this.queue.push(() => {
                this.totalQueueWaitTime += (Date.now() - queueStartTime);
                resolve();
            });
            this.peakQueueLength = Math.max(this.peakQueueLength, this.queue.length);
            this.persistState();
            this.scheduleRefill();
        });
    }

    private scheduleRefill(): void {
        const now = Date.now();
        const timeUntilRefill = this.windowMs - (now - this.lastRefillTime);

        if (timeUntilRefill > 0) {
            setTimeout(() => {
                this.refillTokens();
                this.processQueue();
            }, timeUntilRefill);
        }
    }

    private processQueue(): void {
        while (this.queue.length > 0 && this.tokens > 0) {
            const next = this.queue.shift();
            if (next) {
                this.tokens--;
                next();
            }
        }

        if (this.queue.length > 0) {
            this.scheduleRefill();
        }
        
        this.persistState();
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquire();
        try {
            const result = await fn();
            this.completedRequests++;
            this.persistState();
            return result;
        } catch (error) {
            this.completedRequests++;
            this.persistState();
            throw error;
        }
    }

    async executeAll<T>(fns: Array<() => Promise<T>>): Promise<T[]> {
        return Promise.all(fns.map(fn => this.execute(fn)));
    }

    getState() {
        this.refillTokens();
        const throttleRate = this.totalRequests > 0 
            ? (this.throttledRequests / this.totalRequests) * 100 
            : 0;
        const averageQueueWaitTime = this.throttledRequests > 0
            ? this.totalQueueWaitTime / this.throttledRequests
            : 0;
        const currentRate = this.requestsInCurrentWindow / ((Date.now() - this.windowStartTime) / 1000);
        
        return {
            availableTokens: this.tokens,
            queueLength: this.queue.length,
            maxRequests: this.maxRequests,
            windowMs: this.windowMs,
            totalRequests: this.totalRequests,
            throttledRequests: this.throttledRequests,
            completedRequests: this.completedRequests,
            throttleRate: throttleRate,
            peakQueueLength: this.peakQueueLength,
            averageQueueWaitTime: averageQueueWaitTime,
            peakRequestRate: this.peakRequestRate,
            currentRequestRate: currentRate,
            requestsInCurrentWindow: this.requestsInCurrentWindow
        };
    }
}

let globalRateLimiter: RateLimiter | null = null;

export function getGlobalRateLimiter(maxRequests?: number, windowMs?: number): RateLimiter {
    if (!globalRateLimiter && maxRequests !== undefined && windowMs !== undefined) {
        globalRateLimiter = new RateLimiter(maxRequests, windowMs);
    }
    return globalRateLimiter!;
}

export function resetGlobalRateLimiter(): void {
    globalRateLimiter = null;
}