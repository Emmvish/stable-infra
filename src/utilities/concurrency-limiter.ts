import { ConcurrencyLimiterConfig, ConcurrencyLimiterPersistedState, InfrastructurePersistence } from '../types/index.js';

export class ConcurrencyLimiter {
    private readonly limit: number;
    private running: number = 0;
    private readonly queue: Array<() => void> = [];
    private totalRequests: number = 0;
    private completedRequests: number = 0;
    private failedRequests: number = 0;
    private queuedRequests: number = 0;
    private peakConcurrency: number = 0;
    private peakQueueLength: number = 0;
    private totalQueueWaitTime: number = 0;
    private totalExecutionTime: number = 0;
    private queueWaitTimes: number[] = [];
    private readonly persistence?: InfrastructurePersistence<ConcurrencyLimiterPersistedState>;
    private initialized: boolean = false;

    constructor(limit: number, persistence?: InfrastructurePersistence<ConcurrencyLimiterPersistedState>);
    constructor(config: ConcurrencyLimiterConfig);
    constructor(limitOrConfig: number | ConcurrencyLimiterConfig, persistence?: InfrastructurePersistence<ConcurrencyLimiterPersistedState>) {
        if (typeof limitOrConfig === 'object') {
            this.limit = Math.max(1, Math.floor(limitOrConfig.limit));
            this.persistence = limitOrConfig.persistence;
        } else {
            this.limit = Math.max(1, Math.floor(limitOrConfig));
            this.persistence = persistence;
        }
    }
    
    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        if (this.persistence?.load) {
            try {
                const persistedState = await this.persistence.load();
                if (persistedState) {
                    this.restoreState(persistedState);
                }
            } catch (error) {
                console.warn('stable-request: Unable to load concurrency limiter state from persistence.');
            }
        }
        this.initialized = true;
    }

    private restoreState(persistedState: ConcurrencyLimiterPersistedState): void {
        this.totalRequests = persistedState.totalRequests;
        this.completedRequests = persistedState.completedRequests;
        this.failedRequests = persistedState.failedRequests;
        this.queuedRequests = persistedState.queuedRequests;
        this.peakConcurrency = persistedState.peakConcurrency;
        this.peakQueueLength = persistedState.peakQueueLength;
        this.totalQueueWaitTime = persistedState.totalQueueWaitTime;
        this.totalExecutionTime = persistedState.totalExecutionTime;
    }

    private getPersistedState(): ConcurrencyLimiterPersistedState {
        return {
            totalRequests: this.totalRequests,
            completedRequests: this.completedRequests,
            failedRequests: this.failedRequests,
            queuedRequests: this.queuedRequests,
            peakConcurrency: this.peakConcurrency,
            peakQueueLength: this.peakQueueLength,
            totalQueueWaitTime: this.totalQueueWaitTime,
            totalExecutionTime: this.totalExecutionTime
        };
    }

    private async persistState(): Promise<void> {
        if (this.persistence?.store) {
            try {
                await this.persistence.store(this.getPersistedState());
            } catch (error) {
                console.warn('stable-request: Unable to store concurrency limiter state to persistence.');
            }
        }
    }

    private async acquire(): Promise<{ queueWaitTime: number }> {
        const queueStartTime = Date.now();
        
        if (this.running < this.limit) {
            this.running++;
            this.peakConcurrency = Math.max(this.peakConcurrency, this.running);
            return Promise.resolve({ queueWaitTime: 0 });
        }

        this.queuedRequests++;
        
        return new Promise<{ queueWaitTime: number }>((resolve) => {
            this.queue.push(() => {
                const queueWaitTime = Date.now() - queueStartTime;
                this.totalQueueWaitTime += queueWaitTime;
                this.queueWaitTimes.push(queueWaitTime);
                resolve({ queueWaitTime });
            });
            this.peakQueueLength = Math.max(this.peakQueueLength, this.queue.length);
        });
    }

    private release(): void {
        this.running--;
        const next = this.queue.shift();
        if (next) {
            this.running++;
            this.peakConcurrency = Math.max(this.peakConcurrency, this.running);
            next();
        }
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        this.totalRequests++;
        const { queueWaitTime } = await this.acquire();
        const executionStartTime = Date.now();
        
        try {
            const result = await fn();
            const executionTime = Date.now() - executionStartTime;
            this.totalExecutionTime += executionTime;
            this.completedRequests++;
            this.persistState();
            return result;
        } catch (error) {
            const executionTime = Date.now() - executionStartTime;
            this.totalExecutionTime += executionTime;
            this.failedRequests++;
            this.persistState();
            throw error;
        } finally {
            this.release();
        }
    }

    async executeAll<T>(fns: Array<() => Promise<T>>): Promise<T[]> {
        return Promise.all(fns.map(fn => this.execute(fn)));
    }
    
    getState() {
        const successRate = this.totalRequests > 0
            ? (this.completedRequests - this.failedRequests) / this.totalRequests * 100
            : 0;
        const averageConcurrency = this.completedRequests > 0
            ? this.totalExecutionTime / (Date.now() - (this.totalExecutionTime / this.completedRequests))
            : 0;
        const averageQueueWaitTime = this.queuedRequests > 0
            ? this.totalQueueWaitTime / this.queuedRequests
            : 0;
        const averageExecutionTime = this.completedRequests > 0
            ? this.totalExecutionTime / this.completedRequests
            : 0;
            
        return {
            limit: this.limit,
            running: this.running,
            queueLength: this.queue.length,
            totalRequests: this.totalRequests,
            completedRequests: this.completedRequests,
            failedRequests: this.failedRequests,
            queuedRequests: this.queuedRequests,
            successRate: successRate,
            peakConcurrency: this.peakConcurrency,
            peakQueueLength: this.peakQueueLength,
            averageQueueWaitTime: averageQueueWaitTime,
            averageExecutionTime: averageExecutionTime,
            utilizationPercentage: (this.running / this.limit) * 100
        };
    }
}

let globalConcurrencyLimiter: ConcurrencyLimiter | null = null;

export function getGlobalConcurrencyLimiter(limit?: number): ConcurrencyLimiter {
    if (!globalConcurrencyLimiter && limit !== undefined) {
        globalConcurrencyLimiter = new ConcurrencyLimiter(limit);
    }
    return globalConcurrencyLimiter!;
}

export function resetGlobalConcurrencyLimiter(): void {
    globalConcurrencyLimiter = null;
}