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

    constructor(maxRequests: number, windowMs: number) {
        this.maxRequests = Math.max(1, Math.floor(maxRequests));
        this.windowMs = Math.max(100, windowMs);
        this.tokens = this.maxRequests;
        this.lastRefillTime = Date.now();
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
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquire();
        try {
            const result = await fn();
            this.completedRequests++;
            return result;
        } catch (error) {
            this.completedRequests++;
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