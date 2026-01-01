export class ConcurrencyLimiter {
    private readonly limit: number;
    private running: number = 0;
    private readonly queue: Array<() => void> = [];

    constructor(limit: number) {
        this.limit = Math.max(1, Math.floor(limit));
    }

    private async acquire(): Promise<void> {
        if (this.running < this.limit) {
            this.running++;
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            this.queue.push(resolve);
        });
    }

    private release(): void {
        this.running--;
        const next = this.queue.shift();
        if (next) {
            this.running++;
            next();
        }
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }

    async executeAll<T>(fns: Array<() => Promise<T>>): Promise<T[]> {
        return Promise.all(fns.map(fn => this.execute(fn)));
    }
}