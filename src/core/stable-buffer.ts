import type { MetricsGuardrailsStableBuffer, StableBufferMetrics, StableBufferState, StableBufferOptions } from '../types/index.js';
import { MetricsValidator } from '../utilities/index.js';

export class StableBuffer {
  private state: StableBufferState;
  private queue: Promise<unknown> = Promise.resolve();
  private totalTransactions = 0;
  private totalWaitMs = 0;
  private cloneState: (state: StableBufferState) => StableBufferState;
  private metricsGuardrails?: MetricsGuardrailsStableBuffer;
  private transactionTimeoutMs?: number;

  constructor(options: StableBufferOptions = {}) {
    this.state = options.initialState ? { ...options.initialState } : {};
    this.cloneState = options.clone ?? ((value) => {
      if (typeof structuredClone === 'function') {
        return structuredClone(value);
      }
      return JSON.parse(JSON.stringify(value));
    });
    this.metricsGuardrails = options.metricsGuardrails;
    this.transactionTimeoutMs = options.transactionTimeoutMs ?? 0;
  }

  read(): StableBufferState {
    return this.cloneState(this.state);
  }

  getState(): StableBufferState {
    return this.state;
  }

  setState(nextState: StableBufferState): void {
    this.state = nextState;
  }

  async run<T>(fn: (state: StableBufferState) => T | Promise<T>): Promise<T> {
    const queuedAt = Date.now();
    const task = async () => {
      const startAt = Date.now();
      this.totalWaitMs += Math.max(0, startAt - queuedAt);
      this.totalTransactions += 1;
      return fn(this.state);
    };

    const executionPromise = this.queue.then(task, task);
    this.queue = executionPromise.then(
      () => undefined,
      () => undefined
    );

    return this.wrapWithTimeout(executionPromise, this.transactionTimeoutMs);
  }

  private async wrapWithTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
    if (!timeoutMs || timeoutMs <= 0) {
      return promise;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`StableBuffer transaction timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  }

  async update(mutator: (state: StableBufferState) => void | Promise<void>): Promise<void> {
    await this.run(async (state) => {
      await mutator(state);
    });
  }

  async transaction<T>(fn: (state: StableBufferState) => T | Promise<T>): Promise<T> {
    return this.run(fn);
  }

  getMetrics(): StableBufferMetrics {
    const metrics: StableBufferMetrics = {
      totalTransactions: this.totalTransactions,
      averageQueueWaitMs: this.totalTransactions > 0 ? this.totalWaitMs / this.totalTransactions : 0
    };

    if (!this.metricsGuardrails) {
      return metrics;
    }

    return {
      ...metrics,
      validation: MetricsValidator.validateStableBufferMetrics(metrics, {
        stableBuffer: this.metricsGuardrails
      })
    };
  }
}
