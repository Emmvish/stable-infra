# Stable Runner API Reference

## Table of Contents

1. [Overview](#overview)
2. [Runner Config](#runner-config)
3. [Runner Job Types](#runner-job-types)
4. [Environment Variables](#environment-variables)
5. [Output Format](#output-format)
6. [Examples](#examples)
7. [Docker Quick Start](#docker-quick-start)
8. [Operational Notes](#operational-notes)

---

## Overview

The **Stable Runner** is a lightweight, config-driven execution utility that runs Stable Request jobs from a local file. It supports automatic re-runs on config file changes, structured JSON output, and multiple execution modes (request, function, API gateway, workflow, and workflow graph).

Source: [src/stable-runner/index.ts](../../src/stable-runner/index.ts)

Key features:

- ✅ **Config-driven jobs** via JSON or ESM module
- ✅ **Automatic re-run** on config file changes
- ✅ **Append-only output** for auditability
- ✅ **Supports all core APIs**

---

## Runner Config

The runner expects a `RunnerConfig` file (JSON or ESM module) that provides a single job to execute.

```ts
interface RunnerConfig {
	jobId?: string;
	outputPath?: string;
	job: RunnerJob;
}
```

**Fields**

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `jobId` | `string` | No | Optional identifier written to output. |
| `outputPath` | `string` | No | Where results are written. Defaults to `./output/result.json`. |
| `job` | `RunnerJob` | Yes | The job definition to execute. |

---

## Runner Job Types

The job must specify a `kind` and the associated payload for that kind.

```ts
type RunnerJob =
	| RunnerRequestJob
	| RunnerFunctionJob
	| RunnerApiGatewayJob
	| RunnerWorkflowJob
	| RunnerWorkflowGraphJob;
```

### Type-Safe Job Interfaces

Each job type has a dedicated generic interface for full type safety:

```ts
// Type-safe stableRequest job
interface RunnerRequestJob<RequestDataType = any, ResponseDataType = any> {
	kind: RunnerJobs.STABLE_REQUEST;
	options: STABLE_REQUEST<RequestDataType, ResponseDataType>;
}

// Type-safe stableFunction job
interface RunnerFunctionJob<FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
	kind: RunnerJobs.STABLE_FUNCTION;
	options: STABLE_FUNCTION<FunctionArgsType, FunctionReturnType>;
}

// Type-safe stableApiGateway job
interface RunnerApiGatewayJob<
	RequestDataType = any,
	ResponseDataType = any,
	FunctionArgsType extends any[] = any[],
	FunctionReturnType = any
> {
	kind: RunnerJobs.STABLE_API_GATEWAY;
	requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[];
	options: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
	functions?: API_GATEWAY_FUNCTION<FunctionArgsType, FunctionReturnType>[];
}

// Type-safe stableWorkflow job
interface RunnerWorkflowJob<
	RequestDataType = any,
	ResponseDataType = any,
	FunctionArgsType extends any[] = any[],
	FunctionReturnType = any
> {
	kind: RunnerJobs.STABLE_WORKFLOW;
	phases: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
	options?: STABLE_WORKFLOW_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
}

// Type-safe stableWorkflowGraph job
interface RunnerWorkflowGraphJob<
	RequestDataType = any,
	ResponseDataType = any,
	FunctionArgsType extends any[] = any[],
	FunctionReturnType = any
> {
	kind: RunnerJobs.STABLE_WORKFLOW_GRAPH;
	graph: WorkflowGraph<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
	options?: WorkflowGraphOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
}
```

### Usage with Generics

```ts
import { RunnerJobs, RunnerRequestJob, RunnerConfig, REQUEST_METHODS } from '@emmvish/stable-request';

interface MyRequest { userId: number; }
interface MyResponse { id: number; name: string; }

// Fully typed job
const job: RunnerRequestJob<MyRequest, MyResponse> = {
	kind: RunnerJobs.STABLE_REQUEST,
	options: {
		reqData: { hostname: 'abc.com', method: REQUEST_METHODS.GET, data: { userId: 1 } },
		responseAnalyzer: ({ data }) => data.id > 0  // data is typed as MyResponse
	}
};

// Typed config
const config: RunnerConfig<RunnerRequestJob<MyRequest, MyResponse>> = {
	jobId: 'typed-job',
	job
};
```

**Notes**
- `STABLE_API_GATEWAY` supports `requests` plus optional `functions`. If `functions` is omitted, only request items are used.
- `options` is optional for API gateway, workflow, and workflow graph.

---

## Environment Variables

| Variable | Default | Description |
|---------|---------|-------------|
| `CONFIG_PATH` | _Required_ | Absolute or relative path to config file (JSON or ESM module). |
| `OUTPUT_PATH` | `./output/result.json` | Output JSON file path. Can be overridden by `outputPath` in config. |
| `POLL_INTERVAL_MS` | `2000` | How often the runner checks for config file changes. |
| `RUN_ON_START` | `true` | Set to `false` to only run on file change. |
| `MAX_RUNS` | `0` | Maximum number of runs before exiting. `0` means unlimited. |

---

## Output Format

The runner writes **append-only** JSON to the output file. If the file already exists, the runner loads it and appends a new entry.

```json
[
	{
		"jobId": "job-001",
		"startedAt": "2026-01-28T10:32:15.210Z",
		"completedAt": "2026-01-28T10:32:16.112Z",
		"durationMs": 902,
		"result": { /* stable request or workflow output */ }
	}
]
```

If a job fails, the `error` field is written:

```json
{
	"jobId": "job-001",
	"completedAt": "2026-01-28T10:32:16.112Z",
	"durationMs": 902,
	"error": {
		"message": "...",
		"stack": "..."
	}
}
```

---

## Examples

### ESM Config (runner-config.mjs)

```js
import { RunnerJobs, REQUEST_METHODS } from '@emmvish/stable-request';

export default {
	jobId: 'demo-001',
	outputPath: './output/result.json',
	job: {
		kind: RunnerJobs.STABLE_REQUEST,
		options: {
			reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/todos/1',
				method: REQUEST_METHODS.GET
			},
			resReq: true
		}
	}
};
```

### JSON Config (runner-config.json)

```json
{
	"jobId": "demo-002",
	"job": {
		"kind": "stable_request",
		"options": {
			"reqData": {
                "hostname": "jsonplaceholder.typicode.com",
                "path": "/todos/1",
				"method": "GET"
			},
			"resReq": true
		}
	}
}
```

---

## Docker Quick Start

Build the image and run the runner with a mounted config file:

```bash
docker build -t stable-request-runner .

docker run --rm \
	-e CONFIG_PATH=/app/examples/runner-config.mjs \
	-e OUTPUT_PATH=/app/output/result.json \
	-v "$(pwd)/examples:/app/examples" \
	-v "$(pwd)/output:/app/output" \
	stable-request-runner
```

---

## Operational Notes

- The runner **watches `CONFIG_PATH`** and will re-run whenever the file changes.
- If `RUN_ON_START=true`, it executes immediately on startup.
- The output file is **append-only**, so you get an audit trail of runs.
