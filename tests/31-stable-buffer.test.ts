import { StableBuffer } from '../src/index.js';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('StableBuffer', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('serializes concurrent updates', async () => {
    jest.useRealTimers();
    const buffer = new StableBuffer({ initialState: { count: 0 } });

    const task = async () =>
      buffer.run(async (state) => {
        const before = state.count;
        await delay(10);
        state.count = before + 1;
      });

    await Promise.all([task(), task()]);
    expect(buffer.getState().count).toBe(2);
  });

  test('read returns a snapshot', async () => {
    const buffer = new StableBuffer({ initialState: { count: 1 } });
    await buffer.update((state) => {
      state.count += 1;
    });

    const snapshot = buffer.read();
    snapshot.count = 99;

    expect(buffer.getState().count).toBe(2);
  });

  test('tracks transaction metrics', async () => {
    const buffer = new StableBuffer({ initialState: { value: 0 } });

    await buffer.run((state) => {
      state.value += 1;
    });
    await buffer.transaction((state) => {
      state.value += 1;
    });

    const metrics = buffer.getMetrics();
    expect(metrics.totalTransactions).toBe(2);
    expect(metrics.averageQueueWaitMs).toBeGreaterThanOrEqual(0);
  });

  test('validates guardrails when configured', async () => {
    const buffer = new StableBuffer({
      metricsGuardrails: {
        totalTransactions: { max: 1 }
      }
    });

    await buffer.run((state) => {
      state.count = 1;
    });
    await buffer.run((state) => {
      state.count = 2;
    });

    const metrics = buffer.getMetrics();
    expect(metrics.validation?.isValid).toBe(false);
    expect(metrics.validation?.anomalies.length).toBeGreaterThan(0);
  });
});
