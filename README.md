# @emmvish/stable-request

A production-grade TypeScript library for resilient API integrations, batch processing, and orchestrating complex workflows with deterministic error handling, type safety, and comprehensive observability.

## Table of Contents

- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Core Modules](#core-modules)
  - [stableRequest](#stablerequest)
  - [stableFunction](#stablefunction)
  - [stableApiGateway](#stableapigateway)
  - [stableWorkflow](#stableworkflow)
  - [stableWorkflowGraph](#stableworkflowgraph)
- [Resilience Mechanisms](#resilience-mechanisms)
  - [Retry Strategies](#retry-strategies)
  - [Circuit Breaker](#circuit-breaker)
  - [Caching](#caching)
  - [Rate Limiting](#rate-limiting)
  - [Concurrency Limiting](#concurrency-limiting)
- [Workflow Patterns](#workflow-patterns)
  - [Sequential & Concurrent Phases](#sequential--concurrent-phases)
  - [Non-Linear Workflows](#non-linear-workflows)
  - [Branched Workflows](#branched-workflows)
- [Graph-based Workflow Patterns](#graph-based-workflow-patterns)
  - [Graph-Based Workflows with Mixed Items](#graph-based-workflows-with-mixed-items)
  - [Parallel Phase Execution](#parallel-phase-execution)
  - [Merge Points](#merge-points)
  - [Linear Helper](#linear-helper)
- [Configuration & State](#configuration--state)
  - [Config Cascading](#config-cascading)
  - [Shared & State Buffers](#shared--state-buffers)
- [Hooks & Observability](#hooks--observability)
  - [Pre-Execution Hooks](#pre-execution-hooks)
  - [Analysis Hooks](#analysis-hooks)
  - [Handler Hooks](#handler-hooks)
  - [Decision Hooks](#decision-hooks)
  - [Metrics & Logging](#metrics--logging)
- [Advanced Features](#advanced-features)
  - [Trial Mode](#trial-mode)
  - [State Persistence](#state-persistence)
  - [Mixed Request & Function Phases](#mixed-request--function-phases)
- [Best Practices](#best-practices)

---

## Overview

**@emmvish/stable-request** evolved from a focused library for resilient API calls to a comprehensive execution framework. Originally addressing API integration challenges, it expanded to include:

1. **Batch orchestration** via `stableApiGateway` for processing groups of mixed requests/functions
2. **Phased workflows** via `stableWorkflow` for array-based multi-phase execution with dynamic control flow
3. **Graph-based workflows** via `stableWorkflowGraph` for DAG execution with higher parallelism
4. **Generic function execution** via `stableFunction`, inheriting all resilience guards

All four execution modes support the same resilience stack: retries, jitter, circuit breaking, caching, rate/concurrency limits, config cascading, shared buffers, trial mode, comprehensive hooks, and metrics. This uniformity makes it trivial to compose requests and functions in any topology.

---

## Core Concepts

### Resilience as Default

Every execution—whether a single request, a pure function, or an entire workflow—inherits built-in resilience:

- **Retries** with configurable backoff strategies (FIXED, LINEAR, EXPONENTIAL)
- **Jitter** to prevent thundering herd
- **Circuit breaker** to fail fast and protect downstream systems
- **Caching** for idempotent read operations
- **Rate & concurrency limits** to respect external constraints
- **Metrics guardrails** to validate execution against thresholds with automatic anomaly detection

### Type Safety

All examples in this guide use TypeScript generics for type-safe request/response data and function arguments/returns. Analyzers validate shapes at runtime; TypeScript ensures compile-time safety.

### Config Cascading

Global defaults → group overrides → phase overrides → branch overrides → item overrides. Lower levels always win, preventing repetition while maintaining expressiveness.

### Shared State

Workflows and gateways support `sharedBuffer` for passing computed state across phases/branches/items without global state.

---

## Core Modules

### stableRequest

Single API call with resilience, type-safe request and response types.

```typescript
import { stableRequest, REQUEST_METHODS, VALID_REQUEST_PROTOCOLS } from '@emmvish/stable-request';

interface GetUserRequest {
  // Empty for GET requests with no body
}

interface User {
  id: number;
  name: string;
}

const result = await stableRequest<GetUserRequest, User>({
  reqData: {
    method: REQUEST_METHODS.GET,
    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
    hostname: 'api.example.com',
    path: '/users/1'
  },
  resReq: true,
  attempts: 3,
  wait: 500,
  jitter: 100,
  cache: { enabled: true, ttl: 5000 },
  rateLimit: { maxRequests: 10, windowMs: 1000 },
  maxConcurrentRequests: 5,
  responseAnalyzer: ({ data }) => {
    return typeof data === 'object' && data !== null && 'id' in data;
  },
  handleSuccessfulAttemptData: ({ successfulAttemptData }) => {
    console.log(`User loaded: ${successfulAttemptData.data.name}`);
  }
});

if (result.success) {
  console.log(result.data.name, result.metrics.totalAttempts);
} else {
  console.error(result.error);
}
```

**Key responsibilities:**
- Execute a single HTTP request with automatic retry and backoff
- Validate response shape via analyzer; retry if invalid
- Cache successful responses with TTL
- Apply rate and concurrency limits
- Throw or gracefully suppress errors via finalErrorAnalyzer
- Collect attempt metrics and infra dashboards (circuit breaker, cache, rate limiter state)

### stableFunction

Generic async/sync function execution with identical resilience.

```typescript
import { stableFunction, RETRY_STRATEGIES } from '@emmvish/stable-request';

type ComputeArgs = [number, number];
type ComputeResult = number;

const multiply = (a: number, b: number) => a * b;

const result = await stableFunction<ComputeArgs, ComputeResult>({
  fn: multiply,
  args: [5, 3],
  returnResult: true,
  attempts: 2,
  wait: 100,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
  responseAnalyzer: ({ data }) => data > 0,
  cache: { enabled: true, ttl: 10000 }
});

if (result.success) {
  console.log('Result:', result.data); // 15
}
```

**Key responsibilities:**
- Execute any async or sync function with typed arguments and return
- Support argument-based cache key generation
- Retry on error or analyzer rejection
- Enforce success criteria via analyzer
- Optionally suppress exceptions

### stableApiGateway

Batch orchestration of mixed requests and functions.

```typescript
import {
  stableApiGateway,
  REQUEST_METHODS,
  VALID_REQUEST_PROTOCOLS,
  RequestOrFunction
} from '@emmvish/stable-request';
import type { API_GATEWAY_ITEM } from '@emmvish/stable-request';

// Define request types
interface ApiRequestData {
  filters?: Record<string, any>;
}

interface ApiResponse {
  id: number;
  value: string;
}

// Define function types
type TransformArgs = [ApiResponse[], number];
type TransformResult = {
  transformed: ApiResponse[];
  count: number;
};

type ValidateArgs = [TransformResult];
type ValidateResult = boolean;

const items: API_GATEWAY_ITEM<ApiRequestData, ApiResponse, TransformArgs | ValidateArgs, TransformResult | ValidateResult>[] = [
  {
    type: RequestOrFunction.REQUEST,
    request: {
      id: 'fetch-data',
      requestOptions: {
        reqData: {
          method: REQUEST_METHODS.GET,
          protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
          hostname: 'api.example.com',
          path: '/data'
        },
        resReq: true,
        attempts: 3
      }
    }
  },
  {
    type: RequestOrFunction.FUNCTION,
    function: {
      id: 'transform-data',
      functionOptions: {
        fn: (data: ApiResponse[], threshold: number): TransformResult => ({
          transformed: data.filter(item => item.id > threshold),
          count: data.length
        }),
        args: [[], 10] as TransformArgs,
        returnResult: true,
        attempts: 2,
        cache: { enabled: true, ttl: 5000 }
      }
    }
  },
  {
    type: RequestOrFunction.FUNCTION,
    function: {
      id: 'validate-result',
      functionOptions: {
        fn: (result: TransformResult): ValidateResult => result.count > 0,
        args: [{ transformed: [], count: 0 }] as ValidateArgs,
        returnResult: true
      }
    }
  }
];

const responses = await stableApiGateway<ApiRequestData, ApiResponse>(items, {
  concurrentExecution: true,
  stopOnFirstError: false,
  sharedBuffer: {},
  commonAttempts: 2,
  commonWait: 300,
  maxConcurrentRequests: 3
});

// Access individual responses
responses.forEach((resp, i) => {
  console.log(`Item ${i}: success=${resp.success}`);
});

// Access aggregate metrics
console.log(`Success rate: ${responses.metrics.successRate.toFixed(2)}%`);
console.log(`Execution time: ${responses.metrics.executionTime}ms`);
console.log(`Throughput: ${responses.metrics.throughput.toFixed(2)} req/s`);
console.log(`Average duration: ${responses.metrics.averageRequestDuration.toFixed(2)}ms`);
```

**Key responsibilities:**
- Execute a batch of requests and functions concurrently or sequentially
- Apply global, group-level, and item-level config overrides
- Maintain shared buffer across items for state passing
- Stop on first error or continue despite failures
- Collect per-item and aggregate metrics (success rates, execution time, throughput)
- Support request grouping with group-specific config
- Track infrastructure metrics (circuit breaker, cache, rate limiter, concurrency)

### stableWorkflow

Phased array-based workflows with sequential/concurrent phases, mixed items, and non-linear control flow.

```typescript
import { stableWorkflow, PHASE_DECISION_ACTIONS, RequestOrFunction, REQUEST_METHODS } from '@emmvish/stable-request';
import type { STABLE_WORKFLOW_PHASE, API_GATEWAY_ITEM } from '@emmvish/stable-request';

// Define types for requests
interface FetchRequestData {}
interface FetchResponse {
  users: Array<{ id: number; name: string }>;
  posts: Array<{ id: number; title: string }>;
}

// Define types for functions
type ProcessArgs = [FetchResponse];
type ProcessResult = {
  merged: Array<{ userId: number; userName: string; postTitle: string }>;
};

type AuditArgs = [ProcessResult, string];
type AuditResult = { logged: boolean; timestamp: string };

const phases: STABLE_WORKFLOW_PHASE<FetchRequestData, FetchResponse, ProcessArgs | AuditArgs, ProcessResult | AuditResult>[] = [
  {
    id: 'fetch-data',
    requests: [
      {
        id: 'get-users-posts',
        requestOptions: {
          reqData: {
            hostname: 'api.example.com',
            path: '/users-and-posts'
          },
          resReq: true,
          attempts: 3
        }
      }
    ]
  },
  {
    id: 'process-and-audit',
    markConcurrentPhase: true,
    items: [
      {
        type: RequestOrFunction.FUNCTION,
        function: {
          id: 'process-data',
          functionOptions: {
            fn: (data: FetchResponse): ProcessResult => ({
              merged: data.users.map((user, idx) => ({
                userId: user.id,
                userName: user.name,
                postTitle: data.posts[idx]?.title || 'No post'
              }))
            }),
            args: [{ users: [], posts: [] }] as ProcessArgs,
            returnResult: true
          }
        }
      },
      {
        type: RequestOrFunction.FUNCTION,
        function: {
          id: 'audit-processing',
          functionOptions: {
            fn: async (result: ProcessResult, auditId: string): Promise<AuditResult> => {
              console.log(`Audit ${auditId}:`, result);
              return { logged: true, timestamp: new Date().toISOString() };
            },
            args: [{ merged: [] }, 'audit-123'] as AuditArgs,
            returnResult: true
          }
        }
      }
    ],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      if (!phaseResult.success) {
        return { action: PHASE_DECISION_ACTIONS.TERMINATE };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  },
  {
    id: 'finalize',
    requests: [
      {
        id: 'store-result',
        requestOptions: {
          reqData: {
            hostname: 'api.example.com',
            path: '/store',
            method: REQUEST_METHODS.POST
          },
          resReq: false
        }
      }
    ]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'data-pipeline',
  concurrentPhaseExecution: false, // Phases sequential
  enableNonLinearExecution: true,
  sharedBuffer: { userId: '123' },
  commonAttempts: 2,
  commonWait: 200,
  handlePhaseCompletion: ({ phaseResult, workflowId }) => {
    console.log(`Phase ${phaseResult.phaseId} complete in workflow ${workflowId}`);
  }
});

console.log(`Workflow succeeded: ${result.success}, phases: ${result.totalPhases}`);
```

**Key responsibilities:**
- Execute phases sequentially or concurrently
- Support mixed requests and functions per phase
- Enable non-linear flow (CONTINUE, SKIP, REPLAY, JUMP, TERMINATE)
- Maintain shared buffer across all phases
- Apply phase-level and request-level config cascading
- Support branching with parallel/sequential branches
- Collect per-phase metrics and workflow aggregates

### stableWorkflowGraph

DAG-based execution for higher parallelism and explicit phase dependencies.

```typescript
import { stableWorkflowGraph, WorkflowGraphBuilder } from '@emmvish/stable-request';

const graph = new WorkflowGraphBuilder()
  .addPhase('fetch-posts', {
    requests: [{
      id: 'get-posts',
      requestOptions: {
        reqData: { hostname: 'api.example.com', path: '/posts' },
        resReq: true
      }
    }]
  })
  .addPhase('fetch-users', {
    requests: [{
      id: 'get-users',
      requestOptions: {
        reqData: { hostname: 'api.example.com', path: '/users' },
        resReq: true
      }
    }]
  })
  .addParallelGroup('fetch-all', ['fetch-posts', 'fetch-users'])
  .addPhase('aggregate', {
    functions: [{
      id: 'combine',
      functionOptions: {
        fn: () => ({ posts: [], users: [] }),
        args: [],
        returnResult: true
      }
    }]
  })
  .addMergePoint('sync', ['fetch-all'])
  .connectSequence('fetch-all', 'sync', 'aggregate')
  .setEntryPoint('fetch-all')
  .build();

const result = await stableWorkflowGraph(graph, {
  workflowId: 'data-aggregation'
});

console.log(`Graph workflow success: ${result.success}`);
```

**Key responsibilities:**
- Define phases as DAG nodes with explicit dependency edges
- Execute independent phases in parallel automatically
- Support parallel groups, merge points, and conditional routing
- Validate graph structure (cycle detection, reachability, orphan detection)
- Provide deterministic execution order
- Offer higher parallelism than phased workflows for complex topologies

---

## Resilience Mechanisms

### Retry Strategies

When a request or function fails and is retryable, retry with configurable backoff.

#### FIXED Strategy

Constant wait between retries.

```typescript
import { stableRequest, RETRY_STRATEGIES } from '@emmvish/stable-request';

interface DataRequest {}
interface DataResponse { data: any; }

const result = await stableRequest<DataRequest, DataResponse>({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  attempts: 4,
  wait: 500,
  retryStrategy: RETRY_STRATEGIES.FIXED
  // Retries at: 500ms, 1000ms, 1500ms
});
```

#### LINEAR Strategy

Wait increases linearly with attempt number.

```typescript
const result = await stableRequest<DataRequest, DataResponse>({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  attempts: 4,
  wait: 100,
  retryStrategy: RETRY_STRATEGIES.LINEAR
  // Retries at: 100ms, 200ms, 300ms (wait * attempt)
});
```

#### EXPONENTIAL Strategy

Wait increases exponentially; useful for heavily loaded services.

```typescript
const result = await stableRequest<DataRequest, DataResponse>({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  attempts: 4,
  wait: 100,
  maxAllowedWait: 10000,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
  // Retries at: 100ms, 200ms, 400ms (wait * 2^(attempt-1))
  // Capped at maxAllowedWait
});
```

#### Jitter

Add random milliseconds to prevent synchronization.

```typescript
const result = await stableRequest<DataRequest, DataResponse>({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  attempts: 3,
  wait: 500,
  jitter: 200, // Add 0-200ms randomness
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
});
```

#### Perform All Attempts

Collect all outcomes instead of failing on first error.

```typescript
const result = await stableRequest<DataRequest, DataResponse>({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  attempts: 3,
  performAllAttempts: true
  // All 3 attempts execute; check result.successfulAttempts
});
```

### Circuit Breaker

Prevent cascading failures by failing fast when a dependency becomes unhealthy.

```typescript
import { stableApiGateway, CircuitBreaker } from '@emmvish/stable-request';

interface FlakyRequest {}
interface FlakyResponse { status: string; }

const breaker = new CircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 10,
  recoveryTimeoutMs: 30000,
  successThresholdPercentage: 80,
  halfOpenMaxRequests: 5
});

const requests = [
  { id: 'req-1', requestOptions: { reqData: { path: '/flaky' }, resReq: true } },
  { id: 'req-2', requestOptions: { reqData: { path: '/flaky' }, resReq: true } }
];

const responses = await stableApiGateway<FlakyRequest, FlakyResponse>(requests, {
  circuitBreaker: breaker
});

// Circuit breaker states:
// CLOSED: Normal operation (accept all requests)
// OPEN: Too many failures; reject immediately
// HALF_OPEN: Testing recovery; allow limited requests
```

**State Transitions:**

- **CLOSED → OPEN:** Failure rate exceeds threshold after minimum requests
- **OPEN → HALF_OPEN:** Recovery timeout elapsed; attempt recovery
- **HALF_OPEN → CLOSED:** Success rate exceeds recovery threshold
- **HALF_OPEN → OPEN:** Success rate below recovery threshold; reopen

### Caching

Cache responses to avoid redundant calls.

```typescript
import { stableRequest, CacheManager } from '@emmvish/stable-request';

interface UserRequest {}
interface UserResponse {
  id: number;
  name: string;
  email: string;
}

const cache = new CacheManager({
  enabled: true,
  ttl: 5000 // 5 seconds
});

// First call: cache miss, hits API
const result1 = await stableRequest<UserRequest, UserResponse>({
  reqData: { hostname: 'api.example.com', path: '/user/1' },
  resReq: true,
  cache
});

// Second call within 5s: cache hit, returns cached response
const result2 = await stableRequest<UserRequest, UserResponse>({
  reqData: { hostname: 'api.example.com', path: '/user/1' },
  resReq: true,
  cache
});

// Respects Cache-Control headers if enabled
const cache2 = new CacheManager({
  enabled: true,
  ttl: 60000,
  respectCacheControl: true // Uses max-age, no-cache, no-store
});
```

**Function Caching:**

Arguments become cache key; identical args hit cache.

```typescript
import { stableFunction } from '@emmvish/stable-request';

const expensive = (x: number) => x * x * x; // Cubic calculation

const result1 = await stableFunction({
  fn: expensive,
  args: [5],
  returnResult: true,
  cache: { enabled: true, ttl: 10000 }
});

const result2 = await stableFunction({
  fn: expensive,
  args: [5], // Same args → cache hit
  returnResult: true,
  cache: { enabled: true, ttl: 10000 }
});
```

### Rate Limiting

Enforce max requests per time window.

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

interface ItemRequest {}
interface ItemResponse {
  id: number;
  data: any;
}

const requests = Array.from({ length: 20 }, (_, i) => ({
  id: `req-${i}`,
  requestOptions: {
    reqData: { path: `/item/${i}` },
    resReq: true
  }
}));

const responses = await stableApiGateway<ItemRequest, ItemResponse>(requests, {
  concurrentExecution: true,
  rateLimit: {
    maxRequests: 5,
    windowMs: 1000 // 5 requests per second
  }
  // Requests queued until window allows; prevents overwhelming API
});
```

### Concurrency Limiting

Limit concurrent in-flight requests.

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

interface ItemRequest {}
interface ItemResponse {
  id: number;
  data: any;
}

const requests = Array.from({ length: 50 }, (_, i) => ({
  id: `req-${i}`,
  requestOptions: {
    reqData: { path: `/item/${i}` },
    resReq: true,
    attempts: 1
  }
}));

const responses = await stableApiGateway<ItemRequest, ItemResponse>(requests, {
  concurrentExecution: true,
  maxConcurrentRequests: 5 // Only 5 requests in-flight at a time
  // Others queued and executed as slots free
});
```

---

## Workflow Patterns

### Sequential & Concurrent Phases

#### Sequential (Default)

Each phase waits for the previous to complete.

```typescript
import { stableWorkflow } from '@emmvish/stable-request';
import type { STABLE_WORKFLOW_PHASE } from '@emmvish/stable-request';

const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'phase-1',
    requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }]
  },
  {
    id: 'phase-2',
    requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }]
  },
  {
    id: 'phase-3',
    requests: [{ id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'sequential-phases',
  concurrentPhaseExecution: false // Phase-1 → Phase-2 → Phase-3
});
```

#### Concurrent Phases

Multiple phases run in parallel.

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'fetch-users',
    requests: [{ id: 'get-users', requestOptions: { reqData: { path: '/users' }, resReq: true } }]
  },
  {
    id: 'fetch-posts',
    requests: [{ id: 'get-posts', requestOptions: { reqData: { path: '/posts' }, resReq: true } }]
  },
  {
    id: 'fetch-comments',
    requests: [{ id: 'get-comments', requestOptions: { reqData: { path: '/comments' }, resReq: true } }]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'parallel-phases',
  concurrentPhaseExecution: true // All 3 phases in parallel
});
```

#### Mixed Phases

Combine sequential and concurrent phases in one workflow.

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'init', // Sequential
    requests: [{ id: 'setup', requestOptions: { reqData: { path: '/init' }, resReq: true } }]
  },
  {
    id: 'fetch-a',
    markConcurrentPhase: true, // Concurrent with next
    requests: [{ id: 'data-a', requestOptions: { reqData: { path: '/a' }, resReq: true } }]
  },
  {
    id: 'fetch-b',
    markConcurrentPhase: true, // Concurrent with fetch-a
    requests: [{ id: 'data-b', requestOptions: { reqData: { path: '/b' }, resReq: true } }]
  },
  {
    id: 'finalize', // Sequential after fetch-a/b complete
    requests: [{ id: 'done', requestOptions: { reqData: { path: '/finalize' }, resReq: true } }]
  }
];

const result = await stableWorkflow(phases, {
  concurrentPhaseExecution: false // Respects markConcurrentPhase per phase
});
```

### Non-Linear Workflows

Use decision hooks to dynamically control phase flow.

#### CONTINUE

Standard flow to next sequential phase.

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'check-status',
    requests: [{ id: 'api', requestOptions: { reqData: { path: '/status' }, resReq: true } }],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  },
  {
    id: 'process', // Executes after check-status
    requests: [{ id: 'process-data', requestOptions: { reqData: { path: '/process' }, resReq: true } }]
  }
];

const result = await stableWorkflow(phases, {
  enableNonLinearExecution: true
});
```

#### SKIP

Skip the next phase; execute the one after.

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'phase-1',
    requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }],
    phaseDecisionHook: async () => ({
      action: PHASE_DECISION_ACTIONS.SKIP
    })
  },
  {
    id: 'phase-2', // Skipped
    requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }]
  },
  {
    id: 'phase-3', // Executes
    requests: [{ id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }]
  }
];

const result = await stableWorkflow(phases, {
  enableNonLinearExecution: true
});

// Execution: phase-1 → phase-3
```

#### JUMP

Jump to a specific phase by ID.

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'phase-1',
    requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }],
    phaseDecisionHook: async () => ({
      action: PHASE_DECISION_ACTIONS.JUMP,
      targetPhaseId: 'recovery'
    })
  },
  {
    id: 'phase-2', // Skipped
    requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }]
  },
  {
    id: 'recovery',
    requests: [{ id: 'recover', requestOptions: { reqData: { path: '/recovery' }, resReq: true } }]
  }
];

const result = await stableWorkflow(phases, {
  enableNonLinearExecution: true
});

// Execution: phase-1 → recovery
```

#### REPLAY

Re-execute current phase; useful for polling.

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'wait-for-job',
    allowReplay: true,
    maxReplayCount: 5,
    requests: [
      {
        id: 'check-job',
        requestOptions: { reqData: { path: '/job/status' }, resReq: true, attempts: 1 }
      }
    ],
    phaseDecisionHook: async ({ phaseResult, executionHistory }) => {
      const lastResponse = phaseResult.responses?.[0];
      if ((lastResponse as any)?.data?.status === 'pending' && executionHistory.length < 5) {
        return { action: PHASE_DECISION_ACTIONS.REPLAY };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  },
  {
    id: 'process-result',
    requests: [{ id: 'process', requestOptions: { reqData: { path: '/process' }, resReq: true } }]
  }
];

const result = await stableWorkflow(phases, {
  enableNonLinearExecution: true,
  maxWorkflowIterations: 100
});

// Polls up to 5 times before continuing
```

#### TERMINATE

Stop workflow early.

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'validate',
    requests: [{ id: 'validate-input', requestOptions: { reqData: { path: '/validate' }, resReq: true } }],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      if (!phaseResult.success) {
        return { action: PHASE_DECISION_ACTIONS.TERMINATE };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  },
  {
    id: 'phase-2', // Won't execute if validation fails
    requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }]
  }
];

const result = await stableWorkflow(phases, {
  enableNonLinearExecution: true
});

console.log(result.terminatedEarly); // true if TERMINATE triggered
```

### Branched Workflows

Execute multiple independent branches with shared state.

```typescript
import { stableWorkflow } from '@emmvish/stable-request';
import type { STABLE_WORKFLOW_BRANCH } from '@emmvish/stable-request';

const branches: STABLE_WORKFLOW_BRANCH[] = [
  {
    id: 'branch-payment',
    phases: [
      {
        id: 'process-payment',
        requests: [
          {
            id: 'charge-card',
            requestOptions: {
              reqData: { path: '/payment/charge' },
              resReq: true
            }
          }
        ]
      }
    ]
  },
  {
    id: 'branch-notification',
    phases: [
      {
        id: 'send-email',
        requests: [
          {
            id: 'send',
            requestOptions: {
              reqData: { path: '/notify/email' },
              resReq: false
            }
          }
        ]
      }
    ]
  }
];

const result = await stableWorkflow([], {
  workflowId: 'checkout',
  enableBranchExecution: true,
  branches,
  sharedBuffer: { orderId: '12345' },
  markConcurrentBranch: true // Branches run in parallel
});

// Both branches access/modify sharedBuffer
```

## Graph-based Workflow Patterns

**Key responsibilities:**
- Define phases as DAG nodes with explicit dependency edges
- Execute independent phases in parallel automatically
- Support parallel groups, merge points, and conditional routing
- Validate graph structure (cycle detection, reachability, orphan detection)
- Provide deterministic execution order
- Offer higher parallelism than phased workflows for complex topologies

### Graph-Based Workflows with Mixed Items

For complex topologies with explicit dependencies, use DAG execution mixing requests and functions.

```typescript
import { stableWorkflowGraph, WorkflowGraphBuilder, RequestOrFunction } from '@emmvish/stable-request';
import type { API_GATEWAY_ITEM } from '@emmvish/stable-request';

// Request types
interface PostsRequest {}
interface PostsResponse { posts: Array<{ id: number; title: string }> };

interface UsersRequest {}
interface UsersResponse { users: Array<{ id: number; name: string }> };

// Function types
type AggregateArgs = [PostsResponse, UsersResponse];
type AggregateResult = {
  combined: Array<{ userId: number; userName: string; postCount: number }>;
};

type AnalyzeArgs = [AggregateResult];
type AnalyzeResult = { totalPosts: number; activeUsers: number };

const graph = new WorkflowGraphBuilder<
  PostsRequest | UsersRequest,
  PostsResponse | UsersResponse,
  AggregateArgs | AnalyzeArgs,
  AggregateResult | AnalyzeResult
>()
  .addPhase('fetch-posts', {
    requests: [{
      id: 'get-posts',
      requestOptions: {
        reqData: { path: '/posts' },
        resReq: true
      }
    }]
  })
  .addPhase('fetch-users', {
    requests: [{
      id: 'get-users',
      requestOptions: {
        reqData: { path: '/users' },
        resReq: true
      }
    }]
  })
  .addParallelGroup('fetch-all', ['fetch-posts', 'fetch-users'])
  .addPhase('aggregate', {
    functions: [{
      id: 'combine-data',
      functionOptions: {
        fn: (posts: PostsResponse, users: UsersResponse): AggregateResult => ({
          combined: users.users.map(user => ({
            userId: user.id,
            userName: user.name,
            postCount: posts.posts.filter(p => p.id === user.id).length
          }))
        }),
        args: [{ posts: [] }, { users: [] }] as AggregateArgs,
        returnResult: true
      }
    }]
  })
  .addPhase('analyze', {
    functions: [{
      id: 'analyze-data',
      functionOptions: {
        fn: (aggregated: AggregateResult): AnalyzeResult => ({
          totalPosts: aggregated.combined.reduce((sum, u) => sum + u.postCount, 0),
          activeUsers: aggregated.combined.filter(u => u.postCount > 0).length
        }),
        args: [{ combined: [] }] as AnalyzeArgs,
        returnResult: true
      }
    }]
  })
  .addMergePoint('sync', ['fetch-all'])
  .connectSequence('fetch-all', 'sync', 'aggregate', 'analyze')
  .setEntryPoint('fetch-all')
  .build();

const result = await stableWorkflowGraph(graph, {
  workflowId: 'data-aggregation'
});

console.log(`Graph workflow success: ${result.success}`);
```

### Parallel Phase Execution

Execute multiple phases concurrently within a group.

```typescript
import { stableWorkflowGraph, WorkflowGraphBuilder } from '@emmvish/stable-request';

const graph = new WorkflowGraphBuilder()
  .addPhase('fetch-users', {
    requests: [{
      id: 'users',
      requestOptions: { reqData: { path: '/users' }, resReq: true }
    }]
  })
  .addPhase('fetch-posts', {
    requests: [{
      id: 'posts',
      requestOptions: { reqData: { path: '/posts' }, resReq: true }
    }]
  })
  .addPhase('fetch-comments', {
    requests: [{
      id: 'comments',
      requestOptions: { reqData: { path: '/comments' }, resReq: true }
    }]
  })
  .addParallelGroup('data-fetch', ['fetch-users', 'fetch-posts', 'fetch-comments'])
  .setEntryPoint('data-fetch')
  .build();

const result = await stableWorkflowGraph(graph, {
  workflowId: 'data-aggregation'
});

// All 3 phases run concurrently
```

### Merge Points

Synchronize multiple predecessor phases.

```typescript
const graph = new WorkflowGraphBuilder()
  .addPhase('fetch-a', {
    requests: [{ id: 'a', requestOptions: { reqData: { path: '/a' }, resReq: true } }]
  })
  .addPhase('fetch-b', {
    requests: [{ id: 'b', requestOptions: { reqData: { path: '/b' }, resReq: true } }]
  })
  .addMergePoint('sync', ['fetch-a', 'fetch-b'])
  .addPhase('aggregate', {
    functions: [{
      id: 'combine',
      functionOptions: {
        fn: () => 'combined',
        args: [],
        returnResult: true
      }
    }]
  })
  .connectSequence('fetch-a', 'sync')
  .connectSequence('fetch-b', 'sync')
  .connectSequence('sync', 'aggregate')
  .setEntryPoint('fetch-a')
  .build();

const result = await stableWorkflowGraph(graph, {
  workflowId: 'parallel-sync'
});

// fetch-a and fetch-b run in parallel
// aggregate waits for both to complete
```

### Linear Helper

Convenience function for sequential phase chains.

```typescript
import { createLinearWorkflowGraph } from '@emmvish/stable-request';

const phases = [
  {
    id: 'init',
    requests: [{ id: 'setup', requestOptions: { reqData: { path: '/init' }, resReq: true } }]
  },
  {
    id: 'process',
    requests: [{ id: 'do-work', requestOptions: { reqData: { path: '/work' }, resReq: true } }]
  },
  {
    id: 'finalize',
    requests: [{ id: 'cleanup', requestOptions: { reqData: { path: '/cleanup' }, resReq: true } }]
  }
];

const graph = createLinearWorkflowGraph(phases);

const result = await stableWorkflowGraph(graph, {
  workflowId: 'linear-workflow'
});
```

---

## Configuration & State

### Config Cascading

Define defaults globally; override at group, phase, branch, or item level.

```typescript
import { stableWorkflow } from '@emmvish/stable-request';
import type { STABLE_WORKFLOW_PHASE } from '@emmvish/stable-request';

const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'phase-1',
    attempts: 5, // Override global attempts for this phase
    wait: 1000,
    requests: [
      {
        id: 'req-1',
        requestOptions: {
          reqData: { path: '/data' },
          resReq: true,
          attempts: 2 // Override phase attempts for this item
        }
      }
    ]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'cascade-demo',
  commonAttempts: 1, // Global default
  commonWait: 500,
  retryStrategy: 'LINEAR' // Global default
  // Final config per item: merge common → phase → request
});
```

Hierarchy: global → group → phase → branch → item. Lower levels override.

### Shared & State Buffers

Pass mutable state across phases, branches, and items.

#### Shared Buffer (Workflow/Gateway)

```typescript
import { stableWorkflow } from '@emmvish/stable-request';
import type { STABLE_WORKFLOW_PHASE } from '@emmvish/stable-request';

const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'fetch',
    requests: [
      {
        id: 'user-data',
        requestOptions: {
          reqData: { path: '/users/1' },
          resReq: true,
          handleSuccessfulAttemptData: ({ successfulAttemptData, stableRequestOptions }) => {
            // Mutate shared buffer
            const sharedBuffer = (stableRequestOptions as any).sharedBuffer;
            sharedBuffer.userId = (successfulAttemptData.data as any).id;
          }
        }
      }
    ]
  },
  {
    id: 'use-shared-data',
    requests: [
      {
        id: 'dependent-call',
        requestOptions: {
          reqData: { path: '/user-posts' },
          resReq: true,
          preExecution: {
            preExecutionHook: async ({ stableRequestOptions, commonBuffer }) => {
              const sharedBuffer = (stableRequestOptions as any).sharedBuffer;
              console.log(`Using userId: ${sharedBuffer.userId}`);
            }
          }
        }
      }
    ]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'shared-state-demo',
  sharedBuffer: {} // Mutable across phases
});
```

#### Common Buffer (Request Level)

```typescript
import { stableRequest } from '@emmvish/stable-request';

const commonBuffer = { transactionId: null };

const result = await stableRequest({
  reqData: { path: '/transaction/start' },
  resReq: true,
  commonBuffer,
  preExecution: {
    preExecutionHook: async ({ commonBuffer, stableRequestOptions }) => {
      // commonBuffer writable here
      commonBuffer.userId = '123';
    }
  },
  handleSuccessfulAttemptData: ({ successfulAttemptData }) => {
    // commonBuffer readable in handlers
    console.log(`Transaction for user ${commonBuffer.userId} done`);
  }
});
```

---

## Hooks & Observability

### Pre-Execution Hooks

Modify config or state before execution.

```typescript
import { stableRequest } from '@emmvish/stable-request';

interface SecureRequest {}
interface SecureResponse {
  data: any;
  token?: string;
}

const result = await stableRequest<SecureRequest, SecureResponse>({
  reqData: { path: '/secure-data' },
  resReq: true,
  preExecution: {
    preExecutionHook: async ({ inputParams, commonBuffer, stableRequestOptions }) => {
      // Dynamically fetch auth token
      const token = await getAuthToken();
      
      // Return partial config override
      return {
        reqData: {
          headers: { Authorization: `Bearer ${token}` }
        }
      };
    },
    preExecutionHookParams: { context: 'auth-fetch' },
    applyPreExecutionConfigOverride: true,
    continueOnPreExecutionHookFailure: false
  }
});
```

### Analysis Hooks

Validate responses and errors.

#### Response Analyzer

```typescript
import { stableRequest } from '@emmvish/stable-request';

interface ResourceRequest {}
interface ApiResponse {
  id: number;
  status: 'active' | 'inactive';
}

const result = await stableRequest<ResourceRequest, ApiResponse>({
  reqData: { path: '/resource' },
  resReq: true,
  responseAnalyzer: ({ data, reqData, trialMode }) => {
    // Return true to accept, false to retry
    if (!data || typeof data !== 'object') return false;
    if (!('id' in data)) return false;
    if ((data as any).status !== 'active') return false;
    return true;
  }
});
```

#### Error Analyzer

Decide whether to suppress error gracefully.

```typescript
import { stableRequest } from '@emmvish/stable-request';

interface FeatureRequest {}
interface FeatureResponse {
  enabled: boolean;
  data?: any;
}

const result = await stableRequest<FeatureRequest, FeatureResponse>({
  reqData: { path: '/optional-feature' },
  resReq: true,
  finalErrorAnalyzer: ({ error, reqData, trialMode }) => {
    // Return true to suppress error and return failure result
    // Return false to throw error
    if (error.code === 'ECONNREFUSED') {
      console.warn('Service unavailable, continuing with fallback');
      return true; // Suppress, don't throw
    }
    return false; // Throw
  }
});

if (result.success) {
  console.log('Got data:', result.data);
} else {
  console.log('Service offline, but we continue');
}
```

### Handler Hooks

Custom logging and processing.

#### Success Handler

```typescript
import { stableRequest } from '@emmvish/stable-request';

interface DataRequest {}
interface DataResponse {
  id: number;
  value: string;
}

const result = await stableRequest<DataRequest, DataResponse>({
  reqData: { path: '/data' },
  resReq: true,
  logAllSuccessfulAttempts: true,
  handleSuccessfulAttemptData: ({
    successfulAttemptData,
    reqData,
    maxSerializableChars,
    executionContext
  }) => {
    // Custom logging, metrics, state updates
    console.log(
      `Success in context ${executionContext.workflowId}`,
      `data:`,
      successfulAttemptData.data
    );
  }
});
```

#### Error Handler

```typescript
const result = await stableRequest<DataRequest, DataResponse>({
  reqData: { path: '/data' },
  resReq: true,
  logAllErrors: true,
  handleErrors: ({ errorLog, reqData, executionContext }) => {
    // Custom error logging, alerting, retry logic
    console.error(
      `Error in ${executionContext.workflowId}:`,
      errorLog.errorMessage,
      `Retryable: ${errorLog.isRetryable}`
    );
  }
});
```

#### Phase Handlers (Workflow)

```typescript
import { stableWorkflow } from '@emmvish/stable-request';
import type { STABLE_WORKFLOW_PHASE } from '@emmvish/stable-request';

const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'phase-1',
    requests: [{ id: 'r1', requestOptions: { reqData: { path: '/data' }, resReq: true } }]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'wf-handlers',
  handlePhaseCompletion: ({ phaseResult, workflowId }) => {
    console.log(`Phase ${phaseResult.phaseId} complete in ${workflowId}`);
  },
  handlePhaseError: ({ phaseResult, error, workflowId }) => {
    console.error(`Phase ${phaseResult.phaseId} failed:`, error);
  },
  handlePhaseDecision: ({ decision, phaseResult }) => {
    console.log(`Phase decision: ${decision.action}`);
  }
});
```

### Decision Hooks

Dynamically determine workflow flow.

```typescript
import { stableWorkflow, PHASE_DECISION_ACTIONS } from '@emmvish/stable-request';
import type { STABLE_WORKFLOW_PHASE } from '@emmvish/stable-request';

const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'fetch-data',
    requests: [{ id: 'api', requestOptions: { reqData: { path: '/data' }, resReq: true } }],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer, executionHistory }) => {
      if (!phaseResult.success) {
        return { action: PHASE_DECISION_ACTIONS.TERMINATE };
      }
      if (phaseResult.responses[0].data?.needsRetry) {
        return { action: PHASE_DECISION_ACTIONS.REPLAY };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  }
];

const result = await stableWorkflow(phases, {
  enableNonLinearExecution: true
});
```

### Metrics & Logging

Automatic metrics collection across all execution modes.

#### Request Metrics

```typescript
import { stableRequest } from '@emmvish/stable-request';

interface DataRequest {}
interface DataResponse { data: any; }

const result = await stableRequest<DataRequest, DataResponse>({
  reqData: { path: '/data' },
  resReq: true,
  attempts: 3
});

console.log(result.metrics); // {
//   totalAttempts: 2,
//   successfulAttempts: 1,
//   failedAttempts: 1,
//   totalExecutionTime: 450,
//   averageAttemptTime: 225,
//   infrastructureMetrics: {
//     circuitBreaker: { /* state, stats, config */ },
//     cache: { /* hits, misses, size */ },
//     rateLimiter: { /* limit, current rate */ },
//     concurrencyLimiter: { /* limit, in-flight */ }
//   },
//   validation: {
//     isValid: true,
//     anomalies: [],
//     validatedAt: '2026-01-20T...'
//   }
// }
```

#### API Gateway Metrics

```typescript
import { stableApiGateway } from '@emmvish/stable-request';
import type { API_GATEWAY_REQUEST } from '@emmvish/stable-request';

interface ApiRequest {}
interface ApiResponse { data: any; }

const requests: API_GATEWAY_REQUEST<ApiRequest, ApiResponse>[] = [
  { id: 'req-1', requestOptions: { reqData: { path: '/data/1' }, resReq: true } },
  { id: 'req-2', requestOptions: { reqData: { path: '/data/2' }, resReq: true } },
  { id: 'req-3', requestOptions: { reqData: { path: '/data/3' }, resReq: true } }
];

const result = await stableApiGateway<ApiRequest, ApiResponse>(requests, {
  concurrentExecution: true,
  maxConcurrentRequests: 5
});

console.log(result.metrics); // {
//   totalRequests: 3,
//   successfulRequests: 3,
//   failedRequests: 0,
//   successRate: 100,
//   failureRate: 0,
//   executionTime: 450,              // Total execution time in ms
//   timestamp: '2026-01-20T...',     // ISO 8601 completion timestamp
//   throughput: 6.67,                // Requests per second
//   averageRequestDuration: 150,     // Average time per request in ms
//   requestGroups: [/* per-group stats */],
//   infrastructureMetrics: {
//     circuitBreaker: { /* state, stats, config */ },
//     cache: { /* hit rate, size, utilization */ },
//     rateLimiter: { /* throttle rate, queue length */ },
//     concurrencyLimiter: { /* utilization, queue */ }
//   },
//   validation: {
//     isValid: true,
//     anomalies: [],
//     validatedAt: '2026-01-20T...'
//   }
// }
```

#### Workflow Metrics

```typescript
import { stableWorkflow } from '@emmvish/stable-request';
import type { STABLE_WORKFLOW_PHASE } from '@emmvish/stable-request';

const phases: STABLE_WORKFLOW_PHASE[] = [
  { id: 'p1', requests: [{ id: 'r1', requestOptions: { reqData: { path: '/a' }, resReq: true } }] },
  { id: 'p2', requests: [{ id: 'r2', requestOptions: { reqData: { path: '/b' }, resReq: true } }] }
];

const result = await stableWorkflow(phases, {
  workflowId: 'wf-metrics'
});

console.log(result); // {
//   workflowId: 'wf-metrics',
//   success: true,
//   totalPhases: 2,
//   completedPhases: 2,
//   totalRequests: 2,
//   successfulRequests: 2,
//   failedRequests: 0,
//   workflowExecutionTime: 1200,
//   phases: [
//     { phaseId: 'p1', success: true, responses: [...], validation: {...}, ... },
//     { phaseId: 'p2', success: true, responses: [...], validation: {...}, ... }
//   ],
//   validation: {
//     isValid: true,
//     anomalies: [],
//     validatedAt: '2026-01-20T...'
//   }
// }
```

#### Structured Error Logs

```typescript
const result = await stableRequest<DataRequest, DataResponse>({
  reqData: { path: '/flaky' },
  resReq: true,
  attempts: 3,
  logAllErrors: true,
  handleErrors: ({ errorLog }) => {
    console.log(errorLog); // {
    //   attempt: '1/3',
    //   type: 'NetworkError',
    //   error: 'ECONNREFUSED',
    //   isRetryable: true,
    //   timestamp: 1234567890
    // }
  }
});

if (result.errorLogs) {
  console.log(`${result.errorLogs.length} errors logged`);
}
```

---

## Advanced Features

### Trial Mode

Dry-run workflows without side effects; simulate failures.

```typescript
import { stableWorkflow } from '@emmvish/stable-request';
import type { STABLE_WORKFLOW_PHASE } from '@emmvish/stable-request';

const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'process',
    requests: [
      {
        id: 'api-call',
        requestOptions: {
          reqData: { path: '/payment/charge' },
          resReq: true,
          trialMode: {
            enabled: true,
            requestFailureProbability: 0.3 // 30% simulated failure rate
          }
        }
      }
    ]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'payment-trial',
  trialMode: {
    enabled: true,
    functionFailureProbability: 0.2
  }
});

// Requests/functions execute but failures are simulated
// Real API calls happen; real side effects occur only if enabled
// Useful for testing retry logic, decision hooks, workflow topology
```

### State Persistence

Persist state across retry attempts for distributed tracing.

```typescript
import { stableRequest } from '@emmvish/stable-request';

interface DataRequest {}
interface DataResponse { data: any; }

const result = await stableRequest<DataRequest, DataResponse>({
  reqData: { path: '/data' },
  resReq: true,
  attempts: 3,
  statePersistence: {
    save: async (state, executionContext) => {
      // Save state to database or distributed cache
      await saveToDatabase({
        key: `${executionContext.workflowId}:${executionContext.requestId}`,
        state
      });
    },
    load: async (executionContext) => {
      // Load state for recovery
      return await loadFromDatabase(
        `${executionContext.workflowId}:${executionContext.requestId}`
      );
    }
  }
});
```

### Mixed Request & Function Phases

Combine API calls and computations in single phases with full type safety.

```typescript
import { stableWorkflow, RequestOrFunction } from '@emmvish/stable-request';
import type { STABLE_WORKFLOW_PHASE, API_GATEWAY_ITEM } from '@emmvish/stable-request';

// Request types
interface ProductRequest {}\ninterface ProductResponse {
  id: number;
  name: string;
  price: number;
}

interface InventoryRequest {}
interface InventoryResponse {
  productId: number;
  stock: number;
}

// Function types
type EnrichArgs = [ProductResponse[], InventoryResponse[]];
type EnrichResult = Array<{
  id: number;
  name: string;
  price: number;
  stock: number;
  inStock: boolean;
}>;

type CalculateArgs = [EnrichResult];
type CalculateResult = {
  totalValue: number;
  lowStockItems: number;
};

type NotifyArgs = [CalculateResult, string];
type NotifyResult = { notified: boolean };

const phase: STABLE_WORKFLOW_PHASE<
  ProductRequest | InventoryRequest,
  ProductResponse | InventoryResponse,
  EnrichArgs | CalculateArgs | NotifyArgs,
  EnrichResult | CalculateResult | NotifyResult
> = {
  id: 'mixed-phase',
  items: [
    {
      type: RequestOrFunction.REQUEST,
      request: {
        id: 'fetch-products',
        requestOptions: {
          reqData: { path: '/products' },
          resReq: true
        }
      }
    },
    {
      type: RequestOrFunction.REQUEST,
      request: {
        id: 'fetch-inventory',
        requestOptions: {
          reqData: { path: '/inventory' },
          resReq: true
        }
      }
    },
    {
      type: RequestOrFunction.FUNCTION,
      function: {
        id: 'enrich-products',
        functionOptions: {
          fn: (products: ProductResponse[], inventory: InventoryResponse[]): EnrichResult => {
            return products.map(product => {
              const inv = inventory.find(i => i.productId === product.id);
              return {
                ...product,
                stock: inv?.stock || 0,
                inStock: (inv?.stock || 0) > 0
              };
            });
          },
          args: [[], []] as EnrichArgs,
          returnResult: true,
          cache: { enabled: true, ttl: 30000 }
        }
      }
    },
    {
      type: RequestOrFunction.FUNCTION,
      function: {
        id: 'calculate-metrics',
        functionOptions: {
          fn: (enriched: EnrichResult): CalculateResult => ({
            totalValue: enriched.reduce((sum, p) => sum + (p.price * p.stock), 0),
            lowStockItems: enriched.filter(p => p.stock < 10 && p.stock > 0).length
          }),
          args: [[]] as CalculateArgs,
          returnResult: true
        }
      }
    },
    {
      type: RequestOrFunction.FUNCTION,
      function: {
        id: 'notify-if-needed',
        functionOptions: {
          fn: async (metrics: CalculateResult, channel: string): Promise<NotifyResult> => {
            if (metrics.lowStockItems > 5) {
              console.log(`Sending alert to ${channel}: ${metrics.lowStockItems} items low`);
              return { notified: true };
            }
            return { notified: false };
          },
          args: [{ totalValue: 0, lowStockItems: 0 }, 'slack'] as NotifyArgs,
          returnResult: true,
          attempts: 3,
          wait: 1000
        }
      }
    }
  ]
};

const result = await stableWorkflow([phase], {
  workflowId: 'mixed-execution',
  sharedBuffer: {}
});
```

---

## Best Practices

### 1. Start Conservative, Override When Needed

Define global defaults; override only where necessary.

```typescript
await stableWorkflow(phases, {
  // Global defaults (conservative)
  commonAttempts: 3,
  commonWait: 500,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
  
  // Override for specific phase
  phases: [
    {
      id: 'fast-phase',
      attempts: 1, // Override: no retries
      requests: [...]
    }
  ]
});
```

### 2. Validate Responses

Use analyzers to ensure data shape and freshness.

```typescript
interface DataRequest {}
interface ApiResponse {
  id: number;
  lastUpdated: string;
}

const result = await stableRequest<DataRequest, ApiResponse>({
  reqData: { path: '/data' },
  resReq: true,
  responseAnalyzer: ({ data }) => {
    if (!data || typeof data !== 'object') return false;
    if (!('id' in data && 'lastUpdated' in data)) return false;
    const age = Date.now() - new Date((data as any).lastUpdated).getTime();
    if (age > 60000) return false; // Data older than 1 minute
    return true;
  }
});
```

### 3. Cache Idempotent Reads Aggressively

Reduce latency and load on dependencies.

```typescript
interface UserRequest {}
interface UserResponse {
  id: number;
  name: string;
}

const userCache = new CacheManager({
  enabled: true,
  ttl: 30000, // 30 seconds
  respectCacheControl: true
});

await stableRequest<UserRequest, UserResponse>({
  reqData: { path: '/users/1' },
  resReq: true,
  cache: userCache
});

await stableRequest<UserRequest, UserResponse>({
  reqData: { path: '/users/1' },
  resReq: true,
  cache: userCache // Cached within 30s
});
```

### 4. Use Circuit Breaker for Unstable Services

Protect against cascading failures.

```typescript
interface ServiceRequest {}
interface ServiceResponse { status: string; data: any; }

const unstabledServiceBreaker = new CircuitBreaker({
  failureThresholdPercentage: 40,
  minimumRequests: 5,
  recoveryTimeoutMs: 30000,
  successThresholdPercentage: 80
});

await stableApiGateway<ServiceRequest, ServiceResponse>(requests, {
  circuitBreaker: unstabledServiceBreaker
});
```

### 6. Define Metrics Guardrails for SLA Monitoring

Enforce performance and reliability SLAs with automatic validation.

```typescript
import { stableWorkflow, MetricsGuardrails } from '@emmvish/stable-request';
import type { STABLE_WORKFLOW_PHASE } from '@emmvish/stable-request';

interface ApiRequest {}
interface ApiResponse { data: any; }

const phases: STABLE_WORKFLOW_PHASE<ApiRequest, ApiResponse>[] = [
  {
    id: 'critical-phase',
    requests: [{ id: 'req-1', requestOptions: { reqData: { path: '/critical' }, resReq: true } }],
    metricsGuardrails: {
      phase: {
        executionTime: { max: 3000 },        // SLA: <3s
        requestSuccessRate: { min: 99.5 }    // SLA: 99.5% success
      }
    }
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'sla-monitored',
  metricsGuardrails: {
    workflow: {
      executionTime: { max: 10000 },         // Workflow SLA: <10s
      requestSuccessRate: { min: 99 }        // Workflow SLA: 99% success
    }
  }
});

// Automatic SLA violation detection
if (result.validation && !result.validation.isValid) {
  const criticalAnomalies = result.validation.anomalies.filter(a => a.severity === 'CRITICAL');
  if (criticalAnomalies.length > 0) {
    // Trigger alerts for SLA violations
    console.error('SLA violated:', criticalAnomalies);
  }
}
```

### 6. Apply Rate & Concurrency Limits

Respect external quotas and capacity.

```typescript
interface ApiRequest {}
interface ApiResponse { result: any; }

// API allows 100 req/second, use 80% headroom
const rateLimit = { maxRequests: 80, windowMs: 1000 };

// Database connection pool has 10 slots, use 5
const maxConcurrent = 5;

await stableApiGateway<ApiRequest, ApiResponse>(requests, {
  rateLimit,
  maxConcurrentRequests: maxConcurrent
});
```

### 6. Use Shared Buffers for Cross-Phase Coordination

Avoid global state; pass computed data cleanly.

```typescript
const sharedBuffer = {};

await stableWorkflow(phases, {
  sharedBuffer,
  // Phase 1 writes userId to sharedBuffer
  // Phase 2 reads userId from sharedBuffer
  // Phase 3 uses both
});
```

### 7. Log Selectively with Max Serialization Cap

Prevent noisy logs from large payloads.

```typescript
interface DataRequest {}
interface DataResponse { data: any; }

await stableRequest<DataRequest, DataResponse>({
  reqData: { path: '/data' },
  resReq: true,
  maxSerializableChars: 500, // Truncate logs to 500 chars
  handleSuccessfulAttemptData: ({ successfulAttemptData, maxSerializableChars }) => {
    console.log(safelyStringify(successfulAttemptData, maxSerializableChars));
  }
});
```

### 8. Use Non-Linear Workflows for Polling

REPLAY action simplifies polling logic.

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'wait-for-job',
    allowReplay: true,
    maxReplayCount: 10,
    requests: [
      {
        id: 'check-status',
        requestOptions: {
          reqData: { path: '/jobs/123' },
          resReq: true,
          attempts: 1
        }
      }
    ],
    phaseDecisionHook: async ({ phaseResult }) => {
      const status = (phaseResult.responses[0].data as any)?.status;
      if (status === 'pending') {
        return { action: PHASE_DECISION_ACTIONS.REPLAY };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  }
];

await stableWorkflow(phases, {
  enableNonLinearExecution: true
});
```

### 9. Use Graph Workflows for Complex Parallelism

DAGs make dependencies explicit and enable maximum parallelism.

```typescript
// Clearer than 6 phases with conditional concurrency markers
const graph = new WorkflowGraphBuilder()
  .addParallelGroup('fetch', ['fetch-users', 'fetch-posts', 'fetch-comments'])
  .addMergePoint('sync', ['fetch'])
  .addPhase('aggregate', {...})
  .connectSequence('fetch', 'sync', 'aggregate')
  .build();

await stableWorkflowGraph(graph);
```

### 10. Prefer Dry-Run (Trial Mode) Before Production

Test workflows and retry logic safely.

```typescript
await stableWorkflow(phases, {
  workflowId: 'payment-pipeline',
  trialMode: { enabled: true }, // Dry-run before production
  handlePhaseCompletion: ({ phaseResult }) => {
    console.log(`Trial phase: ${phaseResult.phaseId}, success=${phaseResult.success}`);
  }
});

// If satisfied, deploy with trialMode: { enabled: false }
```

---

## Summary

@emmvish/stable-request provides a unified, type-safe framework for resilient execution:

- **Single calls** via `stableRequest` (APIs) or `stableFunction` (pure functions)
- **Batch orchestration** via `stableApiGateway` (concurrent/sequential mixed items)
- **Phased workflows** via `stableWorkflow` (array-based, non-linear, branched)
- **Graph workflows** via `stableWorkflowGraph` (DAG, explicit parallelism)

All modes inherit robust resilience (retries, jitter, circuit breaking, caching, rate/concurrency limits), config cascading, shared state, hooks, and metrics. Use together or independently; compose freely.

Build resilient, observable, type-safe systems with confidence.
