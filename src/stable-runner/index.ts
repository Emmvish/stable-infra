import { promises as fs } from 'node:fs';
import { statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RunnerJobs } from '../enums/index.js';
import {
  stableRequest,
  stableFunction,
  stableApiGateway,
  stableWorkflow,
  stableWorkflowGraph
} from '../core/index.js';
import type {
  RunnerConfig,
  RunnerJob
} from '../types/index.js';

const CONFIG_PATH = process.env.CONFIG_PATH || '';
const OUTPUT_PATH_ENV = process.env.OUTPUT_PATH || '';
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 2000);
const RUN_ON_START = process.env.RUN_ON_START !== 'false';
const MAX_RUNS = Number(process.env.MAX_RUNS || 0);

if (!CONFIG_PATH) {
  console.error('stable-request runner: CONFIG_PATH env var is required.');
  process.exit(1);
}

let lastMtimeMs = 0;
let running = false;
let pending = false;
let runCount = 0;
let currentJobId: string | null = null;

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
      throw new Error(`stable-request runner: Unsupported job kind: ${(job as RunnerJob).kind}`);
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
    const result = await executeJob(config.job);
    const completedAt = new Date().toISOString();

    if(currentJobId && currentJobId !== config.jobId) {
      console.warn(`stable-request runner: Job ID changed from ${currentJobId} to ${config.jobId}`);
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
    console.error('stable-request runner: unable to read CONFIG_PATH.', error?.message || error);
  }
};

if (RUN_ON_START) {
  runOnce().catch((error) => {
    console.error('stable-request runner: initial run failed.', error);
  });
}

setInterval(tick, Math.max(250, POLL_INTERVAL_MS));

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));