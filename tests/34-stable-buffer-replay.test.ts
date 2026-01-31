import { StableBuffer } from '../src/index.js';
import { replayStableBufferTransactions } from '../src/utilities/index.js';
import type { StableBufferTransactionLog } from '../src/types/index.js';

describe('StableBuffer Replay', () => {
  test('replays logs in order', async () => {
    const logs: StableBufferTransactionLog[] = [];
    const buffer = new StableBuffer({
      initialState: { count: 0 },
      logTransaction: (log) => {
        logs.push(log);
      }
    });

    await buffer.run((state) => {
      state.count += 1;
    }, { activity: 'increment', hookName: 'inc-1' });

    await buffer.run((state) => {
      state.count += 2;
    }, { activity: 'increment', hookName: 'inc-2' });

    const handlers = {
      'inc-1': (state: Record<string, any>) => {
        state.count += 1;
      },
      'inc-2': (state: Record<string, any>) => {
        state.count += 2;
      }
    };

    const replay = await replayStableBufferTransactions({
      logs,
      handlers,
      initialState: { count: 0 }
    });

    expect(replay.applied).toBe(2);
    expect(replay.skipped).toBe(0);
    expect(replay.errors.length).toBe(0);
    expect(replay.buffer.getState().count).toBe(3);
  });

  test('dedupes duplicate transactions', async () => {
    const log: StableBufferTransactionLog = {
      transactionId: 'dup-1',
      queuedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      queueWaitMs: 0,
      success: true,
      stateBefore: { count: 0 },
      stateAfter: { count: 1 },
      activity: 'increment',
      hookName: 'inc-1'
    } as StableBufferTransactionLog;

    const handlers = {
      'inc-1': (state: Record<string, any>) => {
        state.count = (state.count ?? 0) + 1;
      }
    };

    const replay = await replayStableBufferTransactions({
      logs: [log, log],
      handlers,
      initialState: { count: 0 }
    });

    expect(replay.applied).toBe(1);
    expect(replay.skipped).toBe(1);
    expect(replay.buffer.getState().count).toBe(1);
  });

  test('skips logs without handlers when allowed', async () => {
    const log: StableBufferTransactionLog = {
      transactionId: 'missing-1',
      queuedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      queueWaitMs: 0,
      success: true,
      stateBefore: {},
      stateAfter: {},
      activity: 'unknown',
      hookName: 'missing-handler'
    } as StableBufferTransactionLog;

    const replay = await replayStableBufferTransactions({
      logs: [log],
      handlers: {},
      allowUnknownHooks: true,
      initialState: {}
    });

    expect(replay.applied).toBe(0);
    expect(replay.skipped).toBe(1);
    expect(replay.errors.length).toBe(0);
  });

  test('filters logs by activity', async () => {
    const logs: StableBufferTransactionLog[] = [];
    const buffer = new StableBuffer({
      initialState: { count: 0 },
      logTransaction: (log) => {
        logs.push(log);
      }
    });

    await buffer.run((state) => {
      state.count += 1;
    }, { activity: 'keep', hookName: 'inc-1' });

    await buffer.run((state) => {
      state.count += 5;
    }, { activity: 'skip', hookName: 'inc-5' });

    const handlers = {
      'inc-1': (state: Record<string, any>) => {
        state.count += 1;
      },
      'inc-5': (state: Record<string, any>) => {
        state.count += 5;
      }
    };

    const replay = await replayStableBufferTransactions({
      logs,
      handlers,
      initialState: { count: 0 },
      activityFilter: (log) => log.activity === 'keep'
    });

    expect(replay.applied).toBe(1);
    expect(replay.skipped).toBe(1);
    expect(replay.buffer.getState().count).toBe(1);
  });
});