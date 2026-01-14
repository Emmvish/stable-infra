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

    constructor(limit: number) {
        this.limit = Math.max(1, Math.floor(limit));
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
            return result;
        } catch (error) {
            const executionTime = Date.now() - executionStartTime;
            this.totalExecutionTime += executionTime;
            this.failedRequests++;
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