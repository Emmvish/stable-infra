import { ScheduleTypes } from '../enums/index.js';
import type {
  SchedulerConfig,
  SchedulerRetryConfig,
  SchedulerRunContext,
  SchedulerSchedule,
  SchedulerState,
  SchedulerJobHandler,
  ScheduledJob
} from '../types/index.js';

export class StableScheduler<TJob extends { id?: string; schedule?: SchedulerSchedule; retry?: SchedulerRetryConfig }> {
  private readonly config: {
    maxParallel: number;
    tickIntervalMs: number;
    queueLimit: number;
    timezone?: string;
    persistence: {
      enabled: boolean;
      saveState?: (state: SchedulerState<TJob>) => Promise<void> | void;
      loadState?: () => Promise<SchedulerState<TJob> | null> | SchedulerState<TJob> | null;
    };
    retry?: SchedulerRetryConfig;
  };
  private readonly handler: SchedulerJobHandler<TJob>;
  private readonly jobs = new Map<string, ScheduledJob<TJob>>();
  private readonly queue: string[] = [];
  private readonly queued = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private runningCount = 0;
  private completed = 0;
  private failed = 0;
  private dropped = 0;
  private sequence = 0;

  constructor(config: SchedulerConfig, handler: SchedulerJobHandler<TJob>) {
    this.config = {
      maxParallel: config.maxParallel ?? 2,
      tickIntervalMs: config.tickIntervalMs ?? 500,
      queueLimit: config.queueLimit ?? 1000,
      timezone: config.timezone,
      persistence: {
        enabled: config.persistence?.enabled ?? false,
        saveState: config.persistence?.saveState as ((state: SchedulerState<TJob>) => Promise<void> | void) | undefined,
        loadState: config.persistence?.loadState as (() => Promise<SchedulerState<TJob> | null> | SchedulerState<TJob> | null) | undefined
      },
      retry: config.retry
    };
    this.handler = handler;
  }

  addJobs(jobs: TJob[]): void {
    jobs.forEach((job) => this.addJob(job));
    void this.persistStateIfEnabled();
  }

  setJobs(jobs: TJob[]): void {
    this.stop();
    this.jobs.clear();
    this.queue.length = 0;
    this.queued.clear();
    this.runningCount = 0;
    this.completed = 0;
    this.failed = 0;
    this.dropped = 0;
    this.addJobs(jobs);
    this.start();
    void this.persistStateIfEnabled();
  }

  addJob(job: TJob): string {
    const id = job.id ?? this.createId('job');
    const schedule = job.schedule;
    const now = Date.now();
    const { nextRunAt, runOnce, remainingTimestamps } = this.initializeSchedule(schedule, now);
    const scheduledJob: ScheduledJob<TJob> = {
      id,
      job: { ...job, id },
      schedule,
      nextRunAt,
      lastRunAt: null,
      remainingTimestamps,
      runOnce,
      isRunning: false,
      retryAttempts: 0
    };
    this.jobs.set(id, scheduledJob);
    void this.persistStateIfEnabled();
    return id;
  }

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => this.tick(), Math.max(50, this.config.tickIntervalMs));
    this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  tick(): void {
    const now = Date.now();
    let stateChanged = false;
    for (const [id, job] of this.jobs.entries()) {
      if (job.isRunning || this.queued.has(id) || job.nextRunAt === null) {
        continue;
      }
      if (job.nextRunAt <= now) {
        if (this.queue.length >= this.config.queueLimit) {
          this.dropped += 1;
          continue;
        }
        this.queue.push(id);
        this.queued.add(id);
        stateChanged = true;
      }
    }

    while (this.runningCount < this.config.maxParallel && this.queue.length > 0) {
      const id = this.queue.shift();
      if (!id) break;
      this.queued.delete(id);
      const job = this.jobs.get(id);
      if (!job) continue;
      this.dispatch(job);
      stateChanged = true;
    }

    if (stateChanged) {
      void this.persistStateIfEnabled();
    }
  }

  getStats() {
    return {
      queued: this.queue.length,
      running: this.runningCount,
      completed: this.completed,
      failed: this.failed,
      dropped: this.dropped,
      totalJobs: this.jobs.size
    };
  }

  getState(): SchedulerState<TJob> {
    return {
      jobs: Array.from(this.jobs.values()).map((job) => ({
        id: job.id,
        job: job.job,
        schedule: job.schedule,
        nextRunAt: job.nextRunAt,
        lastRunAt: job.lastRunAt,
        remainingTimestamps: job.remainingTimestamps ? [...job.remainingTimestamps] : null,
        runOnce: job.runOnce,
        isRunning: job.isRunning,
        retryAttempts: job.retryAttempts
      })),
      queue: [...this.queue],
      stats: {
        completed: this.completed,
        failed: this.failed,
        dropped: this.dropped,
        sequence: this.sequence
      }
    };
  }

  async restoreState(state?: SchedulerState<TJob>): Promise<boolean> {
    let resolvedState: SchedulerState<TJob> | null | undefined = state;
    if (!resolvedState && this.config.persistence.loadState) {
      resolvedState = await this.config.persistence.loadState();
    }

    if (!resolvedState) {
      return false;
    }

    this.stop();
    this.jobs.clear();
    this.queue.length = 0;
    this.queued.clear();
    this.runningCount = 0;
    this.completed = resolvedState.stats.completed;
    this.failed = resolvedState.stats.failed;
    this.dropped = resolvedState.stats.dropped;
    this.sequence = resolvedState.stats.sequence;

    resolvedState.jobs.forEach((jobState) => {
      const restored: ScheduledJob<TJob> = {
        id: jobState.id,
        job: jobState.job,
        schedule: jobState.schedule,
        nextRunAt: jobState.nextRunAt,
        lastRunAt: jobState.lastRunAt,
        remainingTimestamps: jobState.remainingTimestamps ? [...jobState.remainingTimestamps] : null,
        runOnce: jobState.runOnce,
        isRunning: false,
        retryAttempts: jobState.retryAttempts ?? 0
      };
      this.jobs.set(jobState.id, restored);
    });

    resolvedState.queue.forEach((id) => {
      if (this.jobs.has(id)) {
        this.queue.push(id);
        this.queued.add(id);
      }
    });

    this.tick();
    void this.persistStateIfEnabled();
    return true;
  }

  private dispatch(job: ScheduledJob<TJob>): void {
    this.runningCount += 1;
    job.isRunning = true;
    void this.persistStateIfEnabled();
    const startedAt = Date.now();
    const context: SchedulerRunContext = {
      runId: this.createId('run'),
      jobId: job.id,
      scheduledAt: new Date(job.nextRunAt ?? startedAt).toISOString(),
      startedAt: new Date(startedAt).toISOString(),
      schedule: job.schedule
    };

    const retryConfig = this.getRetryConfig(job);
    if (retryConfig) {
      job.retryAttempts += 1;
    }

    let jobError: unknown = null;

    void this.handler(job.job, context)
      .then(() => {
        this.completed += 1;
        job.retryAttempts = 0;
      })
      .catch((error) => {
        this.failed += 1;
        jobError = error;
      })
      .finally(() => {
        const scheduledRetry = this.scheduleRetryIfEnabled(job, startedAt, jobError);
        job.isRunning = false;
        job.lastRunAt = startedAt;
        this.runningCount -= 1;
        if (!scheduledRetry) {
          job.retryAttempts = 0;
          this.updateNextRun(job, startedAt);
        }
        this.tick();
        void this.persistStateIfEnabled();
      });
  }

  private getRetryConfig(job: ScheduledJob<TJob>): SchedulerRetryConfig | undefined {
    return job.job.retry ?? this.config.retry;
  }

  private scheduleRetryIfEnabled(job: ScheduledJob<TJob>, startedAt: number, error: unknown): boolean {
    if (!error) {
      return false;
    }

    const retryConfig = this.getRetryConfig(job);
    if (!retryConfig) {
      return false;
    }

    const maxAttempts = retryConfig.maxAttempts ?? 1;
    if (maxAttempts <= 1 || job.retryAttempts >= maxAttempts) {
      return false;
    }

    const baseDelay = retryConfig.delayMs ?? 1000;
    const backoff = retryConfig.backoffMultiplier ?? 1;
    const calculatedDelay = baseDelay * Math.pow(backoff, Math.max(job.retryAttempts - 1, 0));
    const delay = retryConfig.maxDelayMs ? Math.min(calculatedDelay, retryConfig.maxDelayMs) : calculatedDelay;

    job.nextRunAt = startedAt + Math.max(0, delay);
    return true;
  }

  private initializeSchedule(schedule: SchedulerSchedule | undefined, now: number): {
    nextRunAt: number | null;
    runOnce: boolean;
    remainingTimestamps: number[] | null;
  } {
    if (!schedule) {
      return { nextRunAt: now, runOnce: true, remainingTimestamps: null };
    }

    if (schedule.type === ScheduleTypes.INTERVAL) {
      const startAt = this.parseTimestamp(schedule.startAt);
      if (startAt !== null && startAt > now) {
        return { nextRunAt: startAt, runOnce: false, remainingTimestamps: null };
      }
      return { nextRunAt: now, runOnce: false, remainingTimestamps: null };
    }

    if (schedule.type === ScheduleTypes.CRON) {
      const nextRunAt = this.getNextCronTime(schedule.expression, now, schedule.timezone);
      return { nextRunAt, runOnce: false, remainingTimestamps: null };
    }

    if (schedule.type === ScheduleTypes.TIMESTAMP) {
      const at = this.parseTimestamp(schedule.at);
      return { nextRunAt: at, runOnce: true, remainingTimestamps: null };
    }

    const timestamps = schedule.at
      .map((value) => this.parseTimestamp(value))
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);

    const nextRunAt = timestamps.length > 0 ? timestamps[0] : null;
    return { nextRunAt, runOnce: false, remainingTimestamps: timestamps };
  }

  private updateNextRun(job: ScheduledJob<TJob>, lastRunAt: number): void {
    const schedule = job.schedule;
    if (!schedule) {
      job.nextRunAt = job.runOnce ? null : lastRunAt;
      return;
    }

    if (schedule.type === ScheduleTypes.INTERVAL) {
      job.nextRunAt = lastRunAt + schedule.everyMs;
      return;
    }

    if (schedule.type === ScheduleTypes.CRON) {
      job.nextRunAt = this.getNextCronTime(schedule.expression, lastRunAt, schedule.timezone);
      return;
    }

    if (schedule.type === ScheduleTypes.TIMESTAMP) {
      job.nextRunAt = null;
      return;
    }

    const remaining = job.remainingTimestamps ?? [];
    while (remaining.length > 0 && remaining[0] <= lastRunAt) {
      remaining.shift();
    }
    job.remainingTimestamps = remaining;
    job.nextRunAt = remaining.length > 0 ? remaining[0] : null;
  }

  private parseTimestamp(value: string | number | undefined): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  private getNextCronTime(expression: string, fromMs: number, timezone?: string): number | null {
    const fields = expression.trim().split(/\s+/);
    if (fields.length < 5 || fields.length > 6) {
      return null;
    }

    const hasSeconds = fields.length === 6;
    const [secField, minField, hourField, dayField, monthField, dowField] = hasSeconds
      ? fields
      : ['0', ...fields];

    const seconds = this.parseCronField(secField, 0, 59, true);
    const minutes = this.parseCronField(minField, 0, 59, true);
    const hours = this.parseCronField(hourField, 0, 23, true);
    const days = this.parseCronField(dayField, 1, 31, true);
    const months = this.parseCronField(monthField, 1, 12, true);
    const dows = this.parseCronField(dowField, 0, 6, true);

    if (!seconds || !minutes || !hours || !days || !months || !dows) {
      return null;
    }

    const maxIterations = 366 * 24 * 60 * 60;
    let candidate = new Date(fromMs + 1000);
    for (let i = 0; i < maxIterations; i += 1) {
      const candidateDate = candidate;
      const match =
        seconds.has(candidateDate.getSeconds()) &&
        minutes.has(candidateDate.getMinutes()) &&
        hours.has(candidateDate.getHours()) &&
        days.has(candidateDate.getDate()) &&
        months.has(candidateDate.getMonth() + 1) &&
        dows.has(candidateDate.getDay());
      if (match) {
        return candidateDate.getTime();
      }
      candidate = new Date(candidateDate.getTime() + 1000);
    }

    return null;
  }

  private parseCronField(field: string, min: number, max: number, strict: boolean): Set<number> | null {
    const values = new Set<number>();
    const segments = field.split(',');
    let hasValidSegment = false;

    segments.forEach((segment) => {
      const trimmed = segment.trim();
      if (!trimmed) return;

      const [rangePart, stepPart] = trimmed.split('/');
      if (stepPart !== undefined && !this.isValidInteger(stepPart)) {
        return;
      }
      const step = stepPart ? Number(stepPart) : 1;
      const safeStep = Number.isFinite(step) && step > 0 ? step : null;
      if (!safeStep) {
        return;
      }

      let rangeStart: number;
      let rangeEnd: number;
      if (rangePart === '*') {
        rangeStart = min;
        rangeEnd = max;
      } else if (rangePart.includes('-')) {
        const [startRaw, endRaw] = rangePart.split('-');
        if (!this.isValidInteger(startRaw) || !this.isValidInteger(endRaw)) {
          return;
        }
        rangeStart = Number(startRaw);
        rangeEnd = Number(endRaw);
      } else {
        if (!this.isValidInteger(rangePart)) {
          return;
        }
        rangeStart = Number(rangePart);
        rangeEnd = rangeStart;
      }

      if (rangeStart < min || rangeEnd > max || rangeStart > rangeEnd) {
        return;
      }

      for (let value = rangeStart; value <= rangeEnd; value += safeStep) {
        values.add(value);
      }
      hasValidSegment = true;
    });

    if (values.size === 0) {
      if (strict) {
        return null;
      }
      for (let value = min; value <= max; value += 1) {
        values.add(value);
      }
    }

    return values;
  }

  private isValidInteger(value: string): boolean {
    return /^\d+$/.test(value);
  }

  private createId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${Date.now()}-${this.sequence}`;
  }

  private async persistStateIfEnabled(): Promise<void> {
    if (!this.config.persistence.enabled || !this.config.persistence.saveState) {
      return;
    }
    const state = this.getState();
    await this.config.persistence.saveState(state);
  }
}
