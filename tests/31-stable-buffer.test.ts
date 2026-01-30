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

  test('emits transaction logs with context', async () => {
    const logs: Array<Record<string, any>> = [];
    const buffer = new StableBuffer({
      initialState: { count: 0 },
      logTransaction: (log) => {
        logs.push(log);
      }
    });

    await buffer.run(
      (state) => {
        state.count += 1;
      },
      {
        activity: 'test-activity',
        hookName: 'test-hook',
        workflowId: 'wf-1',
        phaseId: 'phase-1',
        requestId: 'req-1'
      }
    );

    expect(logs.length).toBe(1);
    const log = logs[0];
    expect(log.activity).toBe('test-activity');
    expect(log.hookName).toBe('test-hook');
    expect(log.workflowId).toBe('wf-1');
    expect(log.phaseId).toBe('phase-1');
    expect(log.requestId).toBe('req-1');
    expect(log.success).toBe(true);
    expect(log.stateBefore.count).toBe(0);
    expect(log.stateAfter.count).toBe(1);
    expect(typeof log.transactionId).toBe('string');
  });

  test('records failed transactions in logs', async () => {
    const logs: Array<Record<string, any>> = [];
    const buffer = new StableBuffer({
      logTransaction: (log) => {
        logs.push(log);
      }
    });

    await expect(
      buffer.run(() => {
        throw new Error('boom');
      }, { activity: 'failure-test', hookName: 'failing-hook' })
    ).rejects.toThrow('boom');

    expect(logs.length).toBe(1);
    expect(logs[0].success).toBe(false);
    expect(logs[0].errorMessage).toBe('boom');
  });

  test('supports replay by re-applying logged operations', async () => {
    const logs: Array<Record<string, any>> = [];
    const buffer = new StableBuffer({
      initialState: { count: 0, flag: false },
      logTransaction: (log) => {
        logs.push(log);
      }
    });

    await buffer.run((state) => {
      state.count += 2;
    }, { activity: 'increment', hookName: 'inc-by-2' });

    await buffer.run((state) => {
      state.flag = true;
    }, { activity: 'toggle', hookName: 'set-flag' });

    const replayBuffer = new StableBuffer({ initialState: { count: 0, flag: false } });
    const handlers: Record<string, (state: any) => void> = {
      'inc-by-2': (state) => {
        state.count += 2;
      },
      'set-flag': (state) => {
        state.flag = true;
      }
    };

    for (const log of logs) {
      const handler = handlers[log.hookName as string];
      expect(handler).toBeDefined();
      await replayBuffer.run((state) => handler(state), {
        activity: log.activity as string,
        hookName: log.hookName as string
      });
    }

    expect(replayBuffer.getState()).toEqual(buffer.getState());
  });
});
