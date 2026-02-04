import { promises as fs } from 'node:fs';
import { statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RunnerJobs } from '../enums/index.js';
import { StableScheduler } from '../core/index.js';
import {
  stableRequest,
  stableFunction,
  stableApiGateway,
  stableWorkflow,
  stableWorkflowGraph
} from '../core/index.js';
import type {
  BufferLike,
  RunnerConfig,
  RunnerJob,
  RunnerScheduledJob,
  SchedulerConfig,
  SchedulerRunContext
} from '../types/index.js';

const CONFIG_PATH = process.env.CONFIG_PATH || '';
const OUTPUT_PATH_ENV = process.env.OUTPUT_PATH || '';
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 2000);
const RUN_ON_START = process.env.RUN_ON_START !== 'false';
const MAX_RUNS = Number(process.env.MAX_RUNS || 0);

if (!CONFIG_PATH) {
  console.error('stable-infra runner: CONFIG_PATH env var is required.');
  process.exit(1);
}

let lastMtimeMs = 0;
let running = false;
let pending = false;
let runCount = 0;
let currentJobId: string | null = null;
let scheduledRunCount = 0;
let scheduler: StableScheduler<RunnerScheduledJob> | null = null;
let writeOutputQueue = Promise.resolve();
let activeSchedulerConfig: SchedulerConfig | null = null;

const envFallbackCache: Record<string, string> = {};

const loadEnvFallback = async (): Promise<Record<string, string>> => {
  if (Object.keys(envFallbackCache).length > 0) {
    return envFallbackCache;
  }
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const raw = await fs.readFile(envPath, 'utf-8');
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) return;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!(key in envFallbackCache)) {
        envFallbackCache[key] = value;
      }
    });
  } catch {
    return envFallbackCache;
  }
  return envFallbackCache;
};

const getEnvValue = async (key: string): Promise<string | undefined> => {
  if (process.env[key]) {
    return process.env[key];
  }
  const envFallback = await loadEnvFallback();
  return envFallback[key];
};

const parseNumberOrDefault = (value: string | undefined, fallback: number): number => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveSchedulerConfig = async (config?: SchedulerConfig): Promise<SchedulerConfig> => {
  const maxParallelEnv = await getEnvValue('SCHEDULER_MAX_PARALLEL');
  const tickIntervalEnv = await getEnvValue('SCHEDULER_TICK_INTERVAL_MS');
  const queueLimitEnv = await getEnvValue('SCHEDULER_QUEUE_LIMIT');
  const timezoneEnv = await getEnvValue('SCHEDULER_TIMEZONE');

  return {
    maxParallel: parseNumberOrDefault(maxParallelEnv, config?.maxParallel ?? 2),
    tickIntervalMs: parseNumberOrDefault(tickIntervalEnv, config?.tickIntervalMs ?? 500),
    queueLimit: parseNumberOrDefault(queueLimitEnv, config?.queueLimit ?? 1000),
    timezone: timezoneEnv ?? config?.timezone,
    persistence: config?.persistence,
    sharedBuffer: config?.sharedBuffer,
    sharedInfrastructure: config?.sharedInfrastructure,
    metricsGuardrails: config?.metricsGuardrails,
    retry: config?.retry,
    executionTimeoutMs: config?.executionTimeoutMs,
  };
};

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  
  if (keysA.length !== keysB.length) return false;
  
  return keysA.every(key => 
    Object.prototype.hasOwnProperty.call(b, key) && 
    deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
  );
};

const isSchedulerConfigEqual = (a?: SchedulerConfig | null, b?: SchedulerConfig | null): boolean => {
  if (!a || !b) return false;
  return (
    a.maxParallel === b.maxParallel &&
    a.tickIntervalMs === b.tickIntervalMs &&
    a.queueLimit === b.queueLimit &&
    a.timezone === b.timezone &&
    a.executionTimeoutMs === b.executionTimeoutMs &&
    a.persistence?.persistenceDebounceMs === b.persistence?.persistenceDebounceMs &&
    a.sharedBuffer === b.sharedBuffer &&
    a.sharedInfrastructure === b.sharedInfrastructure &&
    deepEqual(a.metricsGuardrails, b.metricsGuardrails) &&
    deepEqual(a.retry, b.retry) &&
    deepEqual(a.persistence, b.persistence)
  );
};

const resolveOutputPath = (config?: RunnerConfig): string => {
  return config?.outputPath || OUTPUT_PATH_ENV || path.resolve(process.cwd(), 'output', 'result.json');
};

const loadConfig = async (): Promise<RunnerConfig> => {
  const ext = path.extname(CONFIG_PATH).toLowerCase();
  if (ext === '.json') {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as unknown as RunnerConfig;
  }

  const url = pathToFileURL(CONFIG_PATH);
  url.searchParams.set('t', Date.now().toString());
  const mod = await import(url.toString());
  return (mod.default || mod) as unknown as RunnerConfig;
};

const writeOutput = async (outputPath: string, payload: unknown) => {
  writeOutputQueue = writeOutputQueue
    .then(async () => {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      let existing: unknown = [];
      try {
        const raw = await fs.readFile(outputPath, 'utf-8');
        existing = raw.trim().length > 0 ? JSON.parse(raw) : [];
      } catch (error) {
        existing = [];
      }

      const outputArray = Array.isArray(existing) ? existing : [existing];
      outputArray.push(payload);

      await fs.writeFile(outputPath, JSON.stringify(outputArray, null, 2), 'utf-8');
    })
    .catch((error) => {
      console.error('stable-infra runner: failed to write output.', error);
    });

  await writeOutputQueue;
};

const executeJob = async (job: RunnerJob) => {
  switch (job.kind) {
    case RunnerJobs.STABLE_REQUEST:
      return stableRequest(job.options);
    case RunnerJobs.STABLE_FUNCTION:
      return stableFunction(job.options);
    case RunnerJobs.STABLE_API_GATEWAY:
      return job.functions
        ? stableApiGateway(job.requests, job.functions, job.options)
        : stableApiGateway(job.requests, job.options);
    case RunnerJobs.STABLE_WORKFLOW:
      return stableWorkflow(job.phases, job.options || {});
    case RunnerJobs.STABLE_WORKFLOW_GRAPH:
      return stableWorkflowGraph(job.graph, job.options || {});
    default:
      throw new Error(`stable-infra runner: Unsupported job kind: ${(job as RunnerJob).kind}`);
  }
};

const applySharedBuffer = (job: RunnerScheduledJob, sharedBuffer: BufferLike): RunnerJob => {
  switch (job.kind) {
    case RunnerJobs.STABLE_REQUEST:
      return { ...job, options: { ...job.options, commonBuffer: sharedBuffer } };
    case RunnerJobs.STABLE_FUNCTION:
      return { ...job, options: { ...job.options, commonBuffer: sharedBuffer } };
    case RunnerJobs.STABLE_API_GATEWAY:
      return { ...job, options: { ...job.options, sharedBuffer } };
    case RunnerJobs.STABLE_WORKFLOW:
      return { ...job, options: { ...(job.options || {}), sharedBuffer } };
    case RunnerJobs.STABLE_WORKFLOW_GRAPH:
      return { ...job, options: { ...(job.options || {}), sharedBuffer } };
    default:
      return job as RunnerJob;
  }
};

const executeScheduledJob = async (
  job: RunnerScheduledJob,
  context: SchedulerRunContext,
  outputPath: string,
  sharedBuffer?: BufferLike
) => {
  const startedMs = Date.now();
  try {
    const resolvedJob = sharedBuffer ? applySharedBuffer(job, sharedBuffer) : (job as RunnerJob);
    const result = await executeJob(resolvedJob);
    const completedAt = new Date().toISOString();
    await writeOutput(outputPath, {
      jobId: job.id ?? currentJobId,
      runId: context.runId,
      scheduledAt: context.scheduledAt,
      startedAt: context.startedAt,
      completedAt,
      durationMs: Date.now() - startedMs,
      schedule: job.schedule,
      result
    });
  } catch (error: unknown) {
    const completedAt = new Date().toISOString();
    await writeOutput(outputPath, {
      jobId: job.id ?? currentJobId,
      runId: context.runId,
      scheduledAt: context.scheduledAt,
      startedAt: context.startedAt,
      completedAt,
      durationMs: Date.now() - startedMs,
      schedule: job.schedule,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });
  } finally {
    scheduledRunCount += 1;
    if (MAX_RUNS > 0 && scheduledRunCount >= MAX_RUNS) {
      process.exit(0);
    }
  }
};

const runOnce = async () => {
  if (running) {
    pending = true;
    return;
  }
  running = true;
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  try {
    const config = await loadConfig();
    const outputPath = resolveOutputPath(config);
    const jobs = config.jobs ?? [];

    if (jobs.length > 0) {
      const schedulerConfig = await resolveSchedulerConfig(config.scheduler);
      currentJobId = config.jobId ?? null;
      const shouldRecreate = !scheduler || !isSchedulerConfigEqual(activeSchedulerConfig, schedulerConfig);
      if (shouldRecreate) {
        if (scheduler) {
          scheduler.stop();
          scheduler = null;
        }
        scheduler = new StableScheduler<RunnerScheduledJob>(schedulerConfig, async (job, context) => {
          await executeScheduledJob(job, context, outputPath, schedulerConfig.sharedBuffer);
        });
        if (schedulerConfig.persistence?.enabled && schedulerConfig.persistence.loadState) {
          await scheduler.restoreState();
        }
        scheduler.start();
        activeSchedulerConfig = schedulerConfig;
      }
      if (!scheduler) {
        throw new Error('stable-infra runner: scheduler unavailable after initialization.');
      }
      scheduler.setJobs(jobs);
      return;
    }

    if (scheduler) {
      scheduler.stop();
      scheduler = null;
      activeSchedulerConfig = null;
    }

    if (!config.job) {
      throw new Error('stable-infra runner: config must include a job or jobs array.');
    }

    const result = await executeJob(config.job);
    const completedAt = new Date().toISOString();

    if (currentJobId && currentJobId !== config.jobId) {
      console.warn(`stable-infra runner: Job ID changed from ${currentJobId} to ${config.jobId}`);
    }
    currentJobId = config.jobId ?? null;

    await writeOutput(outputPath, {
      jobId: currentJobId,
      startedAt,
      completedAt,
      durationMs: Date.now() - startedMs,
      result
    });
  } catch (error: any) {
    const outputPath = resolveOutputPath();
    await writeOutput(outputPath, {
      jobId: currentJobId,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
      error: {
        message: error?.message || String(error),
        stack: error?.stack
      }
    });
  } finally {
    runCount++;
    running = false;
    if (pending) {
      pending = false;
      await runOnce();
    }
    if (MAX_RUNS > 0 && runCount >= MAX_RUNS) {
      process.exit(0);
    }
  }
};

const tick = async () => {
  try {
    const stat = statSync(CONFIG_PATH);
    if (stat.mtimeMs > lastMtimeMs) {
      lastMtimeMs = stat.mtimeMs;
      await runOnce();
    }
  } catch (error: any) {
    console.error('stable-infra runner: unable to read CONFIG_PATH.', error?.message || error);
  }
};

if (RUN_ON_START) {
  runOnce().catch((error) => {
    console.error('stable-infra runner: initial run failed.', error);
  });
}

setInterval(tick, Math.max(250, POLL_INTERVAL_MS));

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));