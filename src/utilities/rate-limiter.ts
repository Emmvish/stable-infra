export class RateLimiter {
    private readonly maxRequests: number;
    private readonly windowMs: number;
    private tokens: number;
    private lastRefillTime: number;
    private readonly queue: Array<() => void> = [];

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
        }
    }

    private async acquire(): Promise<void> {
        this.refillTokens();

        if (this.tokens > 0) {
            this.tokens--;
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            this.queue.push(resolve);
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
        return fn();
    }

    async executeAll<T>(fns: Array<() => Promise<T>>): Promise<T[]> {
        return Promise.all(fns.map(fn => this.execute(fn)));
    }

    getState() {
        this.refillTokens();
        return {
            availableTokens: this.tokens,
            queueLength: this.queue.length,
            maxRequests: this.maxRequests,
            windowMs: this.windowMs
        };
    }
}