# stable-request

**stable-request** is a TypeScript-first **HTTP workflow execution engine** for real-world distributed systems — where HTTP `200 OK` does **not** guarantee business success.

It enables **content-aware retries**, **hierarchical configuration**, **batch orchestration**, and **multi-phase workflows** with deep observability — all built on top of standard HTTP calls.

> If you’ve ever retried an API call that “succeeded” but returned the *wrong* data — this library is for you.

---

## Why stable-request exists

Modern systems fail in subtle and dangerous ways:

- APIs return `200` but the resource isn’t ready
- Databases are eventually consistent
- Downstream services partially fail
- Some requests are critical, others are optional
- Blind retries amplify failures
- Workflows fail midway and leave systems inconsistent

Most HTTP clients answer only one question:

> “Did the request fail at the network or HTTP layer?”

**stable-request answers a different one:**

> “Is the system state actually correct yet?”

---

## What stable-request gives you

### Core capabilities

✅ **Content-aware retries**  
  Retry based on response validation, not just status codes

🔄 **Deterministic execution semantics**  
  Fixed, linear, or exponential retry strategies with hard limits

🧠 **Graceful failure handling**  
  Suppress non-critical failures without crashing workflows

🧪 **Trial mode / chaos testing**  
  Simulate failures without depending on real outages

📊 **First-class observability hooks**  
  Inspect every failed and successful attempt

---

### Scaling beyond single requests

🚀 **Batch execution with shared state (`stableApiGateway`)**  
  Run many requests concurrently or sequentially with shared configuration and shared state

🎯 **Request groups**  
  Apply different reliability rules to critical, standard, and optional services

🧱 **Hierarchical configuration**  
  Workflow → Phase → Group → Request (predictable overrides)

---

### Full workflow orchestration

🧩 **Multi-phase workflows with shared state (`stableWorkflow`)**

🔀 **Mix concurrent and sequential execution**

🛑 **Stop early or degrade gracefully**

📈 **Phase-level metrics and hooks**

🧭 **Deterministic, observable execution paths**

---

## Table of contents

- [Installation](#installation)
- [Choose your entry point](#choose-your-entry-point)
- [Core concepts](#core-concepts)
  - [Content-aware retries](#content-aware-retries)
  - [Retry strategies](#retry-strategies)
  - [Hooks and observability](#hooks-and-observability)
  - [Buffers](#buffers)
- [Quick start](#quick-start)
- [stableRequest](#stablerequest)
  - [Basic request](#basic-request)
  - [Retries](#retries)
  - [Content-aware retries (`responseAnalyzer`)](#content-aware-retries-responseanalyzer)
  - [Observability hooks](#observability-hooks)
  - [Handle final errors gracefully](#handle-final-errors-gracefully)
  - [Pass custom parameters to hooks](#pass-custom-parameters-to-hooks)
  - [Pre-execution hook (dynamic configuration)](#pre-execution-hook-dynamic-configuration)
  - [Request configuration](#request-configuration)
  - [Trial mode](#trial-mode)
- [stableApiGateway (batch execution)](#stableapigateway-batch-execution)
  - [Basic batch request](#basic-batch-request)
  - [Sequential execution (with dependencies)](#sequential-execution-with-dependencies)
  - [Shared configuration (common options)](#shared-configuration-common-options)
  - [Request grouping](#request-grouping)
  - [Using `sharedBuffer` (cross-request state)](#using-sharedbuffer-cross-request-state)
- [stableWorkflow (multi-phase workflows)](#stableworkflow-multi-phase-workflows)
  - [Basic workflow](#basic-workflow)
  - [Phase configuration](#phase-configuration)
  - [Workflow with request groups](#workflow-with-request-groups)
  - [Phase observability hooks](#phase-observability-hooks)
  - [Using `workflowBuffer` (cross-phase state)](#using-workflowbuffer-cross-phase-state)
- [Configuration hierarchy](#configuration-hierarchy)
- [TypeScript support](#typescript-support)
- [Complete API reference](#complete-api-reference)
  - [`REQUEST_DATA`](#request_data)
  - [`stableRequest(options)`](#stablerequestoptions)
  - [`stableApiGateway(requests, options)`](#stableapigatewayrequests-options)
  - [`stableWorkflow(phases, options)`](#stableworkflowphases-options)
  - [Hooks reference](#hooks-reference)
- [Best practices](#best-practices)
- [License](#license)

---

## Installation

```bash
npm install @mv/stable-request
```

---

## Choose your entry point

| Need | Use |
|------|-----|
| Reliable single API call | `stableRequest` |
| Batch / fan-out requests | `stableApiGateway` |
| Multi-step orchestration | `stableWorkflow` |

---

## Core concepts

### Content-aware retries

Many systems return `200` while the *state* is still wrong (eventual consistency, async jobs, partial rollouts).  
`stableRequest` lets you retry based on response validation:

- `responseAnalyzer` returns `true` → accept response
- returns `false` → retry (even if HTTP is `200`)
- throws → treated as an error (goes through error handling / retry rules)

### Retry strategies

Supported strategies:
- `RETRY_STRATEGIES.FIXED` — constant delay (e.g., 1s, 1s, 1s…)
- `RETRY_STRATEGIES.LINEAR` — increasing delay (e.g., 1s, 2s, 3s…)
- `RETRY_STRATEGIES.EXPONENTIAL` — exponential backoff (e.g., 1s, 2s, 4s, 8s…)

Use `maxAllowedWait` to cap long backoff.

### Hooks and observability

You can observe:
- failed attempts via `handleErrors` (enabled by `logAllErrors`)
- successful attempts via `handleSuccessfulAttemptData` (enabled by `logAllSuccessfulAttempts`)
- final resolution via `finalErrorAnalyzer`

Hooks receive consistent context including `reqData`, attempt metadata, and your buffers.

### Buffers

Buffers are plain JS objects passed to hooks for coordination and state sharing.

#### `commonBuffer` (per request)

`stableRequest({ commonBuffer })`  
Use to share data across hooks within a single request (e.g., trace IDs, computed headers, decisions).

#### `sharedBuffer` (per gateway run)

`stableApiGateway(requests, { sharedBuffer })`  
Forwarded into each underlying request as that request’s `commonBuffer`, enabling cross-request coordination.

#### `workflowBuffer` (per workflow run)

`stableWorkflow(phases, { workflowBuffer })`  
Forwarded into each phase as the phase gateway’s `sharedBuffer`, so all requests across phases see the same object as `commonBuffer`.

---

## Quick start

### 1) Basic request (no retries)

```ts
import { stableRequest } from '@mv/stable-request';

const data = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/users/123'
  },
  resReq: true
});

console.log(data);
```

### 2) Add simple retries

```ts
import { stableRequest, RETRY_STRATEGIES } from '@mv/stable-request';

const data = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/users/123'
  },
  resReq: true,
  attempts: 3,
  wait: 1000,
  maxAllowedWait: 8000,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
});
```

### 3) Validate response content (content-aware retries)

```ts
import { stableRequest } from '@mv/stable-request';

const data = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/jobs/456/status'
  },
  resReq: true,
  attempts: 10,
  wait: 2000,

  responseAnalyzer: async ({ data }) => {
    if (data.status === 'completed') return true;
    return false;
  }
});
```

---

## stableRequest

### Basic request

```ts
import { stableRequest } from '@mv/stable-request';

const user = await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/users/1' },
  resReq: true
});
```

### Retries

```ts
import { stableRequest, RETRY_STRATEGIES } from '@mv/stable-request';

await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  attempts: 5,
  wait: 500,
  retryStrategy: RETRY_STRATEGIES.LINEAR
});
```

### Content-aware retries (`responseAnalyzer`)

```ts
import { stableRequest } from '@mv/stable-request';

const jobResult = await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/jobs/abc123/status' },
  resReq: true,
  attempts: 20,
  wait: 3000,

  responseAnalyzer: async ({ data }) => {
    if (data.status === 'completed') return true;
    if (data.status === 'failed') throw new Error(`Job failed: ${data.error}`);
    return false;
  }
});
```

### Observability hooks

Enable logs with flags, and handle events with hooks.

```ts
import { stableRequest } from '@mv/stable-request';

await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  attempts: 5,
  wait: 1000,

  logAllErrors: true,
  handleErrors: async ({ reqData, errorLog }) => {
    console.log(`Request to ${reqData.url} failed at ${errorLog.attempt}: ${errorLog.error}`);
  },

  logAllSuccessfulAttempts: true,
  handleSuccessfulAttemptData: async ({ successfulAttemptData }) => {
    console.log('Succeeded at', successfulAttemptData.attempt, 'in', successfulAttemptData.executionTime, 'ms');
  }
});
```

### Handle final errors gracefully

`finalErrorAnalyzer` runs after retries are exhausted (or a fatal error occurs). Return:
- `true` → suppress error and return `false`
- `false` → throw the error

```ts
import { stableRequest } from '@mv/stable-request';

const data = await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/optional-feature' },
  resReq: true,
  attempts: 3,

  finalErrorAnalyzer: async ({ error }) => {
    if (error?.message?.includes('404')) return true; // suppress
    return false; // throw
  }
});

if (data === false) {
  console.log('Optional feature unavailable, continuing.');
}
```

### Pass custom parameters to hooks

```ts
import { stableRequest } from '@mv/stable-request';

const expectedVersion = 42;

const data = await stableRequest({
  reqData: { hostname: 'replica.db.example.com', path: '/records/123' },
  resReq: true,
  attempts: 10,
  wait: 500,

  hookParams: {
    responseAnalyzerParams: { expectedVersion },
    finalErrorAnalyzerParams: { suppress: false }
  },

  responseAnalyzer: async ({ data, params }) => {
    return data.version >= params.expectedVersion;
  }
});
```

### Pre-execution hook (dynamic configuration)

`preExecution` runs once before attempts start. It can:
- write into `commonBuffer`
- optionally return overrides (applied only when `applyPreExecutionConfigOverride: true`)

```ts
import { stableRequest } from '@mv/stable-request';

const commonBuffer: Record<string, any> = {};

const data = await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/protected' },
  resReq: true,
  commonBuffer,

  preExecution: {
    preExecutionHook: async ({ inputParams, commonBuffer }) => {
      commonBuffer.traceId = `trace_${Date.now()}`;
      commonBuffer.userId = inputParams.userId;

      return {
        reqData: {
          hostname: 'api.example.com',
          path: '/protected',
          headers: { 'X-Trace-Id': commonBuffer.traceId }
        }
      };
    },
    preExecutionHookParams: { userId: 'u-123' },
    applyPreExecutionConfigOverride: true,
    continueOnPreExecutionHookFailure: false
  }
});

console.log(data, commonBuffer);
```

### Request configuration

#### POST/PUT/PATCH requests

```ts
import { stableRequest, REQUEST_METHODS } from '@mv/stable-request';

const newUser = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/users',
    method: REQUEST_METHODS.POST,
    headers: { 'Content-Type': 'application/json' },
    body: { name: 'John Doe', email: 'john@example.com' }
  },
  resReq: true,
  attempts: 3
});
```

#### Query parameters

```ts
import { stableRequest } from '@mv/stable-request';

const users = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/users',
    query: { page: 1, limit: 10, sort: 'createdAt' }
  },
  resReq: true
});
```

#### Custom timeout and port

```ts
import { stableRequest, VALID_REQUEST_PROTOCOLS } from '@mv/stable-request';

const data = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/slow-endpoint',
    port: 8080,
    protocol: VALID_REQUEST_PROTOCOLS.HTTP,
    timeout: 30000
  },
  resReq: true,
  attempts: 2
});
```

#### Request cancellation (AbortController)

```ts
import { stableRequest } from '@mv/stable-request';

const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/data',
    signal: controller.signal
  },
  resReq: true
});
```

### Trial mode

Simulate failures without depending on real outages.

```ts
import { stableRequest } from '@mv/stable-request';

await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  attempts: 5,
  logAllErrors: true,

  trialMode: {
    enabled: true,
    reqFailureProbability: 0.3,
    retryFailureProbability: 0.2
  }
});
```

---

## stableApiGateway (batch execution)

`stableApiGateway` executes multiple stable requests concurrently or sequentially.

### Basic batch request

```ts
import { stableApiGateway } from '@mv/stable-request';

const requests = [
  { id: 'user-1', requestOptions: { reqData: { path: '/users/1' }, resReq: true } },
  { id: 'user-2', requestOptions: { reqData: { path: '/users/2' }, resReq: true } },
  { id: 'user-3', requestOptions: { reqData: { path: '/users/3' }, resReq: true } }
];

const results = await stableApiGateway(requests, {
  commonRequestData: { hostname: 'api.example.com' },
  commonAttempts: 3,
  commonWait: 1000,
  concurrentExecution: true
});

results.forEach(r => {
  if (r.success) console.log(r.requestId, 'ok');
  else console.error(r.requestId, 'failed:', r.error);
});
```

### Sequential execution (with dependencies)

```ts
import { stableApiGateway, REQUEST_METHODS } from '@mv/stable-request';

const steps = [
  {
    id: 'step-1-create',
    requestOptions: {
      reqData: { path: '/orders', method: REQUEST_METHODS.POST, body: { item: 'Widget' } },
      resReq: true
    }
  },
  {
    id: 'step-2-process',
    requestOptions: {
      reqData: { path: '/orders/123/process', method: REQUEST_METHODS.POST },
      resReq: true
    }
  }
];

const results = await stableApiGateway(steps, {
  concurrentExecution: false,
  stopOnFirstError: true,
  commonRequestData: { hostname: 'api.example.com' },
  commonAttempts: 3
});
```

### Shared configuration (common options)

```ts
import { stableApiGateway, RETRY_STRATEGIES } from '@mv/stable-request';

const results = await stableApiGateway(
  [
    { id: 'req-1', requestOptions: { reqData: { path: '/users/1' } } },
    { id: 'req-2', requestOptions: { reqData: { path: '/users/2' } } },
    { id: 'req-3', requestOptions: { reqData: { path: '/users/3' } } }
  ],
  {
    commonRequestData: { hostname: 'api.example.com' },
    commonResReq: true,
    commonAttempts: 5,
    commonWait: 2000,
    commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
    commonLogAllErrors: true,

    commonHandleErrors: async ({ reqData, errorLog }) => {
      console.log(`Request to ${reqData.url} failed (${errorLog.attempt})`);
    },

    commonResponseAnalyzer: async ({ data }) => {
      return data?.success === true;
    }
  }
);
```

### Request grouping

Group related requests with different configurations. Priority:

**Individual request** > **Group config** > **Global common config**

```ts
import { stableApiGateway, RETRY_STRATEGIES } from '@mv/stable-request';

const results = await stableApiGateway(
  [
    {
      id: 'auth-check',
      groupId: 'critical',
      requestOptions: { reqData: { path: '/auth/verify' }, resReq: true }
    },
    {
      id: 'track-event',
      groupId: 'analytics',
      requestOptions: { reqData: { path: '/analytics/track' }, resReq: true }
    }
  ],
  {
    commonRequestData: { hostname: 'api.example.com' },
    commonAttempts: 2,

    requestGroups: [
      {
        id: 'critical',
        commonConfig: {
          commonAttempts: 10,
          commonWait: 2000,
          commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
        }
      },
      {
        id: 'analytics',
        commonConfig: {
          commonAttempts: 1,
          commonFinalErrorAnalyzer: async () => true
        }
      }
    ]
  }
);
```

### Using `sharedBuffer` (cross-request state)

`sharedBuffer` is forwarded into each request as `commonBuffer`, enabling cross-request communication.

```ts
import { stableApiGateway, REQUEST_METHODS } from '@mv/stable-request';

const sharedBuffer: Record<string, any> = {};

const results = await stableApiGateway(
  [
    {
      id: 'create-order',
      requestOptions: {
        reqData: { path: '/orders', method: REQUEST_METHODS.POST, body: { item: 'Widget' } },
        resReq: true,
        handleSuccessfulAttemptData: async ({ successfulAttemptData, commonBuffer }) => {
          commonBuffer.orderId = (successfulAttemptData.data as any).id;
        }
      }
    },
    {
      id: 'confirm-order',
      requestOptions: {
        reqData: { path: '/orders/_/confirm', method: REQUEST_METHODS.POST },
        resReq: true,
        preExecution: {
          preExecutionHook: ({ commonBuffer }) => ({
            reqData: { path: `/orders/${commonBuffer.orderId}/confirm`, method: REQUEST_METHODS.POST }
          }),
          preExecutionHookParams: {},
          applyPreExecutionConfigOverride: true
        }
      }
    }
  ],
  {
    concurrentExecution: false,
    stopOnFirstError: true,
    commonRequestData: { hostname: 'api.example.com' },
    sharedBuffer
  }
);

console.log(results, sharedBuffer.orderId);
```

---

## stableWorkflow (multi-phase workflows)

For complex operations requiring multiple stages, use `stableWorkflow` to orchestrate phase-based execution.

### Basic workflow

```ts
import { stableWorkflow, REQUEST_METHODS } from '@mv/stable-request';

const workflow = await stableWorkflow(
  [
    {
      id: 'validation',
      concurrentExecution: true,
      requests: [
        { id: 'check-inventory', requestOptions: { reqData: { path: '/inventory/check' }, resReq: true } },
        { id: 'validate-payment', requestOptions: { reqData: { path: '/payment/validate' }, resReq: true } }
      ]
    },
    {
      id: 'processing',
      concurrentExecution: false,
      stopOnFirstError: true,
      requests: [
        { id: 'charge-payment', requestOptions: { reqData: { path: '/payment/charge', method: REQUEST_METHODS.POST }, resReq: true } },
        { id: 'reserve-inventory', requestOptions: { reqData: { path: '/inventory/reserve', method: REQUEST_METHODS.POST }, resReq: true } }
      ]
    }
  ],
  {
    workflowId: 'order-processing-123',
    stopOnFirstPhaseError: true,
    logPhaseResults: true,
    commonRequestData: { hostname: 'api.example.com' },
    commonAttempts: 3,
    commonWait: 1000
  }
);

console.log('Workflow completed:', workflow.success);
```

### Phase configuration

Each phase can provide `commonConfig` to override workflow-level defaults for that phase.

### Workflow with request groups

```ts
import { stableWorkflow, RETRY_STRATEGIES, REQUEST_METHODS } from '@mv/stable-request';

const workflow = await stableWorkflow(
  [
    {
      id: 'critical-validation',
      concurrentExecution: true,
      requests: [
        { id: 'auth-check', groupId: 'critical', requestOptions: { reqData: { path: '/auth/verify' }, resReq: true } },
        { id: 'rate-limit-check', groupId: 'critical', requestOptions: { reqData: { path: '/ratelimit/check' }, resReq: true } }
      ]
    },
    {
      id: 'data-processing',
      concurrentExecution: false,
      commonConfig: {
        commonAttempts: 5,
        commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
      },
      requests: [
        { id: 'process-data', groupId: 'standard', requestOptions: { reqData: { path: '/data/process', method: REQUEST_METHODS.POST }, resReq: true } },
        { id: 'store-result', groupId: 'standard', requestOptions: { reqData: { path: '/data/store', method: REQUEST_METHODS.POST }, resReq: true } }
      ]
    }
  ],
  {
    workflowId: 'data-pipeline-workflow',
    stopOnFirstPhaseError: true,
    logPhaseResults: true,

    commonRequestData: { hostname: 'api.example.com' },
    commonAttempts: 3,
    commonWait: 1000,

    requestGroups: [
      {
        id: 'critical',
        commonConfig: {
          commonAttempts: 10,
          commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
          commonWait: 2000
        }
      },
      {
        id: 'standard',
        commonConfig: {
          commonAttempts: 5,
          commonRetryStrategy: RETRY_STRATEGIES.LINEAR,
          commonWait: 1000
        }
      },
      {
        id: 'optional',
        commonConfig: {
          commonAttempts: 2,
          commonFinalErrorAnalyzer: async () => true
        }
      }
    ]
  }
);

console.log(workflow.success);
```

### Phase observability hooks

```ts
import { stableWorkflow } from '@mv/stable-request';

await stableWorkflow(
  [
    {
      id: 'phase-1',
      concurrentExecution: true,
      requests: [{ id: 'r1', requestOptions: { reqData: { path: '/a' }, resReq: true } }]
    }
  ],
  {
    workflowId: 'wf-hooks',
    commonRequestData: { hostname: 'api.example.com' },

    handlePhaseCompletion: async ({ workflowId, phaseResult }) => {
      console.log('phase complete', workflowId, phaseResult.phaseId, phaseResult.success);
    },

    handlePhaseError: async ({ workflowId, phaseResult, error }) => {
      console.error('phase error', workflowId, phaseResult.phaseId, error?.message);
    }
  }
);
```

### Using `workflowBuffer` (cross-phase state)

`workflowBuffer` is shared across the entire workflow and becomes the `commonBuffer` for every request in every phase.

```ts
import { stableWorkflow, REQUEST_METHODS } from '@mv/stable-request';

const workflowBuffer: Record<string, any> = {};

const wf = await stableWorkflow(
  [
    {
      id: 'create',
      concurrentExecution: false,
      requests: [
        {
          id: 'create-order',
          requestOptions: {
            reqData: { path: '/orders', method: REQUEST_METHODS.POST, body: { item: 'Widget' } },
            resReq: true,
            handleSuccessfulAttemptData: async ({ successfulAttemptData, commonBuffer }) => {
              commonBuffer.orderId = (successfulAttemptData.data as any).id;
            }
          }
        }
      ]
    },
    {
      id: 'confirm',
      concurrentExecution: false,
      requests: [
        {
          id: 'confirm-order',
          requestOptions: {
            reqData: { path: '/orders/_/confirm', method: REQUEST_METHODS.POST },
            resReq: true,
            preExecution: {
              preExecutionHook: ({ commonBuffer }) => ({
                reqData: { path: `/orders/${commonBuffer.orderId}/confirm`, method: REQUEST_METHODS.POST }
              }),
              preExecutionHookParams: {},
              applyPreExecutionConfigOverride: true
            }
          }
        }
      ]
    }
  ],
  {
    workflowId: 'wf-buffer-demo',
    commonRequestData: { hostname: 'api.example.com' },
    workflowBuffer
  }
);

console.log(wf.success, workflowBuffer.orderId);
```

---

## Configuration hierarchy

Configuration precedence across orchestration:

1. Workflow-level (lowest priority)
2. Phase-level (`commonConfig`)
3. Request group (`requestGroups[].commonConfig`)
4. Individual request options (highest priority)

Buffers are state (not config):
- request scope: `commonBuffer`
- gateway scope: `sharedBuffer`
- workflow scope: `workflowBuffer`

---

## TypeScript support

All entry points are generic:

```ts
import { stableRequest, REQUEST_METHODS } from '@mv/stable-request';

interface CreateUserRequest {
  name: string;
  email: string;
}

interface UserResponse {
  id: string;
  name: string;
  email: string;
}

const user = await stableRequest<CreateUserRequest, UserResponse>({
  reqData: {
    hostname: 'api.example.com',
    path: '/users',
    method: REQUEST_METHODS.POST,
    body: { name: 'John', email: 'john@example.com' }
  },
  resReq: true
});

console.log(user.id);
```

---

## Complete API reference

Types are exported from `src/index.ts` and defined in `src/types/index.ts`.

### `REQUEST_DATA`

```ts
interface REQUEST_DATA<RequestDataType = any> {
  hostname: string;                    // required
  protocol?: 'http' | 'https';         // default: 'https'
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; // default: 'GET'
  path?: `/${string}`;                 // default: ''
  port?: number;                       // default: 443
  headers?: Record<string, any>;
  body?: RequestDataType;
  query?: Record<string, any>;
  timeout?: number;                    // default: 15000ms (implementation default)
  signal?: AbortSignal;
}
```

### `stableRequest(options)`

Key options:

- `preExecution?: RequestPreExecutionOptions`
- `commonBuffer?: Record<string, any>`
- `responseAnalyzer?: (...) => boolean | Promise<boolean>`
- `handleErrors?: (...) => any | Promise<any>`
- `handleSuccessfulAttemptData?: (...) => any | Promise<any>`
- `finalErrorAnalyzer?: (...) => boolean | Promise<boolean>`
- `trialMode?: TRIAL_MODE_OPTIONS`

### `stableApiGateway(requests, options)`

Key options:

- `concurrentExecution?: boolean`
- `stopOnFirstError?: boolean` (sequential only)
- `requestGroups?: RequestGroup[]`
- `sharedBuffer?: Record<string, any>` (cross-request buffer)
- `commonRequestData?: Partial<REQUEST_DATA>`
- `common*` options for defaults (attempts, wait, hooks, etc.)

### `stableWorkflow(phases, options)`

Key options:

- `workflowId?: string`
- `stopOnFirstPhaseError?: boolean`
- `logPhaseResults?: boolean`
- `handlePhaseCompletion?: (...) => any | Promise<any>`
- `handlePhaseError?: (...) => any | Promise<any>`
- `workflowBuffer?: Record<string, any>`
- plus workflow-level defaults compatible with `stableApiGateway` (applied to phases)

---

## Hooks reference

All hooks (request-level and workflow-level) receive rich context. A few key points:

- `commonBuffer` is always available in request hooks.
- In a gateway run, `commonBuffer` may be the gateway `sharedBuffer`.
- In a workflow run, `commonBuffer` may be the workflow `workflowBuffer`.

### `preExecution.preExecutionHook`

```ts
preExecution: {
  preExecutionHook: async ({ inputParams, commonBuffer }) => {
    commonBuffer.traceId = `t_${Date.now()}`;
    return { attempts: 5 };
  },
  preExecutionHookParams: { any: 'value' },
  applyPreExecutionConfigOverride: true,
  continueOnPreExecutionHookFailure: false
}
```

### `responseAnalyzer`

```ts
responseAnalyzer: async ({ data, commonBuffer }) => {
  commonBuffer.lastSeenStatus = data.status;
  return data.status === 'ready';
}
```

### `handleErrors`

```ts
handleErrors: async ({ reqData, errorLog, commonBuffer }) => {
  console.log('failed', reqData.url, errorLog.attempt, commonBuffer.traceId);
}
```

### `handleSuccessfulAttemptData`

```ts
handleSuccessfulAttemptData: async ({ successfulAttemptData, commonBuffer }) => {
  commonBuffer.lastSuccess = successfulAttemptData.timestamp;
}
```

### `finalErrorAnalyzer`

```ts
finalErrorAnalyzer: async ({ error }) => {
  if (error.message.includes('404')) return true; // suppress
  return false; // throw
}
```

---

## Best practices

1. Start simple: retries + `responseAnalyzer` for correctness, then add hooks.
2. Use exponential backoff for rate-limited services; cap with `maxAllowedWait`.
3. Use `finalErrorAnalyzer` to suppress non-critical failures and keep workflows resilient.
4. Use `preExecution` for dynamic headers/config (tokens, correlation IDs, runtime decisions).
5. Use buffers intentionally:
   - `commonBuffer` for request-local coordination
   - `sharedBuffer` for cross-request coordination inside a gateway call
   - `workflowBuffer` for cross-phase coordination inside a workflow
6. Keep buffers small and namespaced to avoid collisions in large orchestrations.
7. Use sequential execution when requests have dependencies (`stopOnFirstError` helps fail fast).

---

## License

MIT © Manish Varma
