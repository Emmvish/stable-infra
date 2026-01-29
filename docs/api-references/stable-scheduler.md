# Stable Scheduler API Reference

## Table of Contents

1. [Overview](#overview)
2. [Core Interface: SchedulerConfig](#core-interface-schedulerconfig)
3. [Core Interface: SchedulerSchedule](#core-interface-schedulerschedule)
4. [Class: StableScheduler](#class-stablescheduler)
5. [Retry Behavior](#retry-behavior)
6. [State Recoverability](#state-recoverability)
7. [Runner Integration Example](#runner-integration-example)
8. [Best Practices](#best-practices)

---

## Overview

`StableScheduler` is a queue-based scheduler with concurrency limits and multiple schedule types (cron, interval, timestamp). It supports state recoverability via user-provided persistence handlers and can be integrated with the Stable Runner to schedule any of the core APIs.

### Key Features

- ✅ **Queue-based scheduling** with max parallelism
- ✅ **Schedule types**: cron, fixed interval, and timestamp(s)
- ✅ **State recoverability** via custom persistence handlers
- ✅ **Runner integration** for scheduled core API jobs

---

## Core Interface: SchedulerConfig

Configuration for scheduler behavior and persistence.

```ts
interface SchedulerConfig<TJob = unknown> {
	maxParallel?: number;
	tickIntervalMs?: number;
	queueLimit?: number;
	timezone?: string;
	persistence?: SchedulerPersistence<TJob>;
	retry?: SchedulerRetryConfig;
	executionTimeoutMs?: number;
	persistenceDebounceMs?: number;
}

interface SchedulerPersistence<TJob = unknown> {
	enabled?: boolean;
	saveState?: (state: SchedulerState<TJob>) => Promise<void> | void;
	loadState?: () => Promise<SchedulerState<TJob> | null> | SchedulerState<TJob> | null;
}

interface SchedulerRetryConfig {
	maxAttempts?: number;
	delayMs?: number;
	backoffMultiplier?: number;
	maxDelayMs?: number;
}
```

### Field Descriptions

| Field | Type | Default | Description |
|------|------|---------|-------------|
| `maxParallel` | `number` | `2` | Maximum number of jobs running in parallel. |
| `tickIntervalMs` | `number` | `500` | Scheduler tick interval in milliseconds. |
| `queueLimit` | `number` | `1000` | Maximum number of queued jobs before dropping. |
| `timezone` | `string?` | `undefined` | Optional timezone hint for cron parsing (best-effort). |
| `persistence` | `SchedulerPersistence?` | `undefined` | Custom persistence handlers for state recoverability. |
| `retry` | `SchedulerRetryConfig?` | `undefined` | Default retry policy applied when a job does not specify `retry`. |
| `executionTimeoutMs` | `number?` | `86400000` | Max handler execution time (ms) before timing out and marking failure. |
| `persistenceDebounceMs` | `number?` | `1000` | Debounce window for persistence writes to reduce rapid saves. |

---

## Core Interface: SchedulerSchedule

Defines when a job should run using `ScheduleTypes`.

```ts
type SchedulerSchedule =
	| { type: ScheduleTypes.CRON; expression: string; timezone?: string }
	| { type: ScheduleTypes.INTERVAL; everyMs: number; startAt?: string | number }
	| { type: ScheduleTypes.TIMESTAMP; at: string | number }
	| { type: ScheduleTypes.TIMESTAMPS; at: Array<string | number> };
```

---

## Class: StableScheduler

### Constructor

```ts
const scheduler = new StableScheduler(config, handler);
```

### Methods

- `addJob(job)` / `addJobs(jobs)`
- `setJobs(jobs)`
- `start()` / `stop()`
- `getStats()`
- `getState()`
- `restoreState(state?)`

**Handler Signature**

```ts
type SchedulerJobHandler<TJob> = (job: TJob, context: SchedulerRunContext) => Promise<unknown>;
```

The handler is invoked for each scheduled job and receives execution metadata like `runId`, `jobId`, `scheduledAt`, and `startedAt`.

---

## Retry Behavior

Retries are opt-in. Provide a retry policy in `SchedulerConfig.retry` or per job using `job.retry`. When a job fails, the scheduler retries up to `maxAttempts` (including the initial attempt). The next retry is scheduled after `delayMs` with optional exponential backoff via `backoffMultiplier`, capped by `maxDelayMs`.

Execution timeouts are also opt-in. Set `SchedulerConfig.executionTimeoutMs` to apply a default timeout, or add `executionTimeoutMs` to a job to override it. When a timeout occurs, the run is marked as a failure.

---

## State Recoverability

To enable recoverability, provide persistence handlers:

```ts
const scheduler = new StableScheduler(
	{
		persistence: {
			enabled: true,
			saveState: async (state) => {
				// Save to DB, file, or cache
			},
			loadState: async () => {
				// Load previously saved state
				return null;
			}
		}
	},
	async (job) => {
		// Execute job
	}
);

await scheduler.restoreState();
```

The scheduler persists `nextRunAt` and `lastRunAt` per job, so cron and interval jobs resume at the correct next time after a crash.

---

## Runner Integration Example

Example config for the Stable Runner to schedule workflow and API gateway jobs:

```js
import { RunnerJobs, ScheduleTypes } from '@emmvish/stable-request';

export default {
	jobId: 'scheduled-runner',
	jobs: [
		{
			id: 'nightly-workflow',
			kind: RunnerJobs.STABLE_WORKFLOW,
			schedule: { type: ScheduleTypes.CRON, expression: '0 0 * * *' },
			phases: [/* ... */],
			options: { workflowId: 'nightly-001' }
		},
		{
			id: 'hourly-gateway',
			kind: RunnerJobs.STABLE_API_GATEWAY,
			schedule: { type: ScheduleTypes.INTERVAL, everyMs: 60 * 60 * 1000 },
			requests: [/* ... */],
			options: { concurrentExecution: false }
		}
	],
	scheduler: {
		maxParallel: 2,
		persistence: {
			enabled: true,
			saveState: async (state) => {
				// persist state
			},
			loadState: async () => {
				// load persisted state
				return null;
			}
		}
	}
};
```

---

## Best Practices

1. **Enable persistence** for long-running schedules.
2. **Use reasonable `tickIntervalMs`** for predictable scheduling.
3. **Keep `maxParallel` conservative** to protect downstream services.
4. **Validate cron expressions** before scheduling in production.
