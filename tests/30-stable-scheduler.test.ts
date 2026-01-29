import { StableScheduler, ScheduleTypes } from '../src/index.js';

const flushPromises = async () => Promise.resolve();

describe('StableScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('runs at most maxParallel jobs', async () => {
    let active = 0;
    let maxActive = 0;
    let executed = 0;

    const scheduler = new StableScheduler({ maxParallel: 2, tickIntervalMs: 50 }, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      executed += 1;
      active -= 1;
    });

    scheduler.addJobs([{ id: 'job-1' }, { id: 'job-2' }, { id: 'job-3' }]);
    scheduler.tick();
    await flushPromises();

    await jest.advanceTimersByTimeAsync(100);
    await flushPromises();
    scheduler.tick();

    await jest.advanceTimersByTimeAsync(100);
    await flushPromises();
    scheduler.tick();

    await jest.advanceTimersByTimeAsync(100);
    await flushPromises();

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(executed).toBe(3);

    scheduler.stop();
  });

  test('interval and timestamp schedules fire as expected', async () => {
    let intervalCount = 0;
    let timestampCount = 0;

    const scheduler = new StableScheduler({ maxParallel: 1, tickIntervalMs: 50 }, async (job) => {
      if (job.id === 'interval-job') intervalCount += 1;
      if (job.id === 'timestamp-job') timestampCount += 1;
    });

    scheduler.addJobs([
      { id: 'interval-job', schedule: { type: ScheduleTypes.INTERVAL, everyMs: 100 } },
      { id: 'timestamp-job', schedule: { type: ScheduleTypes.TIMESTAMP, at: Date.now() + 200 } }
    ]);

    scheduler.tick();
    await flushPromises();
    expect(intervalCount).toBe(1);
    expect(timestampCount).toBe(0);

    await jest.advanceTimersByTimeAsync(100);
    scheduler.tick();
    await flushPromises();
    expect(intervalCount).toBe(2);
    expect(timestampCount).toBe(0);

    await jest.advanceTimersByTimeAsync(100);
    scheduler.tick();
    await flushPromises();
    expect(intervalCount).toBe(3);
    expect(timestampCount).toBe(1);

    await jest.advanceTimersByTimeAsync(200);
    scheduler.tick();
    await flushPromises();
    expect(timestampCount).toBe(1);

    scheduler.stop();
  });

  test('invalid cron expressions are rejected', async () => {
    let cronCount = 0;

    const scheduler = new StableScheduler({ maxParallel: 1, tickIntervalMs: 50 }, async () => {
      cronCount += 1;
    });

    scheduler.addJobs([
      { id: 'bad-field-count', schedule: { type: ScheduleTypes.CRON, expression: '* * *' } },
      { id: 'bad-range', schedule: { type: ScheduleTypes.CRON, expression: '61 * * * *' } },
      { id: 'bad-step', schedule: { type: ScheduleTypes.CRON, expression: '*/0 * * * *' } }
    ]);

    scheduler.tick();
    await flushPromises();

    await jest.advanceTimersByTimeAsync(500);
    scheduler.tick();
    await flushPromises();

    expect(cronCount).toBe(0);
    scheduler.stop();
  });

  test('restores scheduler state and continues execution', async () => {
    const executed: string[] = [];

    const scheduler = new StableScheduler({ maxParallel: 1, tickIntervalMs: 50 }, async (job) => {
      executed.push(job.id as string);
    });

    const now = Date.now();
    scheduler.addJobs([
      { id: 'job-a', schedule: { type: ScheduleTypes.TIMESTAMP, at: now + 100 } },
      { id: 'job-b', schedule: { type: ScheduleTypes.TIMESTAMP, at: now + 200 } }
    ]);

    await jest.advanceTimersByTimeAsync(100);
    scheduler.tick();
    await flushPromises();
    expect(executed).toEqual(['job-a']);

    const state = scheduler.getState();
    scheduler.stop();

    const restored = new StableScheduler({ maxParallel: 1, tickIntervalMs: 50 }, async (job) => {
      executed.push(job.id as string);
    });

    await restored.restoreState(state);

    await jest.advanceTimersByTimeAsync(100);
    restored.tick();
    await flushPromises();

    expect(executed).toEqual(['job-a', 'job-b']);
    restored.stop();
  });

  test('persists scheduler state via custom handlers when enabled', async () => {
    type SavedState = { jobs: Array<{ id: string }> };
    const savedState: SavedState = { jobs: [] };

    const scheduler = new StableScheduler(
      {
        maxParallel: 1,
        tickIntervalMs: 50,
        persistence: {
          enabled: true,
          saveState: (state) => {
            savedState.jobs = (state as SavedState).jobs;
          }
        }
      },
      async () => {}
    );

    scheduler.addJobs([{ id: 'job-1' }]);
    await flushPromises();

    expect(savedState.jobs.some((job: { id: string }) => job.id === 'job-1')).toBe(true);
    scheduler.stop();
  });

  test('retries failed jobs up to maxAttempts', async () => {
    let attempts = 0;

    const scheduler = new StableScheduler({ maxParallel: 1, tickIntervalMs: 50 }, async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('temporary failure');
      }
    });

    scheduler.addJobs([
      {
        id: 'retry-job',
        retry: { maxAttempts: 3, delayMs: 100 }
      }
    ]);

    scheduler.tick();
    await flushPromises();
    expect(attempts).toBe(1);

    await jest.advanceTimersByTimeAsync(100);
    scheduler.tick();
    await flushPromises();
    expect(attempts).toBe(2);

    await jest.advanceTimersByTimeAsync(100);
    scheduler.tick();
    await flushPromises();
    expect(attempts).toBe(3);

    const [jobState] = scheduler.getState().jobs;
    expect(jobState.retryAttempts).toBe(0);
    scheduler.stop();
  });

  test('times out long-running handlers and records failure', async () => {
    const scheduler = new StableScheduler({ maxParallel: 1, tickIntervalMs: 50, executionTimeoutMs: 100 }, async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    });

    scheduler.addJobs([{ id: 'timeout-job' }]);
    scheduler.tick();
    await flushPromises();

    await jest.advanceTimersByTimeAsync(100);
    await flushPromises();

    expect(scheduler.getStats().failed).toBe(1);
    scheduler.stop();
  });

  test('debounces persistence saves', async () => {
    let saveCount = 0;

    const scheduler = new StableScheduler(
      {
        maxParallel: 1,
        tickIntervalMs: 50,
        persistenceDebounceMs: 200,
        persistence: {
          enabled: true,
          saveState: () => {
            saveCount += 1;
          }
        }
      },
      async () => {}
    );

    scheduler.addJobs([{ id: 'job-1' }, { id: 'job-2' }]);
    scheduler.tick();
    scheduler.tick();
    await flushPromises();

    expect(saveCount).toBe(0);

    await jest.advanceTimersByTimeAsync(200);
    await flushPromises();

    expect(saveCount).toBe(1);
    scheduler.stop();
  });

  test('validates scheduler metrics guardrails', async () => {
    const scheduler = new StableScheduler(
      {
        maxParallel: 1,
        tickIntervalMs: 50,
        metricsGuardrails: {
          scheduler: {
            failureRate: { max: 0 }
          }
        }
      },
      async () => {
        throw new Error('forced failure');
      }
    );

    scheduler.addJobs([{ id: 'fail-job' }]);
    scheduler.tick();
    await flushPromises();

    const { validation } = scheduler.getMetrics();
    expect(validation?.isValid).toBe(false);
    scheduler.stop();
  });

  test('shares and persists sharedBuffer', async () => {
    const buffer = { count: 0 };
    let seenBuffer: Record<string, any> | undefined;
    let persistedBuffer: Record<string, any> | undefined;

    const scheduler = new StableScheduler(
      {
        maxParallel: 1,
        tickIntervalMs: 50,
        sharedBuffer: buffer,
        persistence: {
          enabled: true,
          saveState: (state) => {
            persistedBuffer = state.sharedBuffer;
          }
        }
      },
      async (_job, context) => {
        seenBuffer = context.sharedBuffer;
        context.sharedBuffer!.count += 1;
      }
    );

    scheduler.addJobs([{ id: 'buffer-job' }]);
    scheduler.tick();
    await flushPromises();

    expect(seenBuffer).toBe(buffer);
    expect(buffer.count).toBe(1);
    expect(persistedBuffer).toBe(buffer);
    scheduler.stop();
  });
});
