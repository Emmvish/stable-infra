# API Reference

Complete API documentation for `@emmvish/stable-request` `v1.8.0`

## Table of Contents

- [Core Functions](#core-functions)
  - [stableRequest](#stablerequest)
  - [stableApiGateway](#stableapigateway)
  - [stableWorkflow](#stableworkflow)
- [Utility Classes](#utility-classes)
  - [CircuitBreaker](#circuitbreaker)
  - [RateLimiter](#ratelimiter)
  - [ConcurrencyLimiter](#concurrencylimiter)
  - [MetricsAggregator](#metricsaggregator)
  - [CacheManager](#cachemanager)
- [Type Definitions](#type-definitions)
  - [REQUEST_DATA](#request_data)
  - [STABLE_REQUEST](#stable_request)
  - [API_GATEWAY_OPTIONS](#api_gateway_options)
  - [API_GATEWAY_REQUEST](#api_gateway_request)
  - [API_GATEWAY_RESPONSE](#api_gateway_response)
  - [API_GATEWAY_RESULT](#api_gateway_result)
  - [STABLE_WORKFLOW_OPTIONS](#stable_workflow_options)
  - [STABLE_WORKFLOW_PHASE](#stable_workflow_phase)
  - [STABLE_WORKFLOW_BRANCH](#stable_workflow_branch)
  - [STABLE_WORKFLOW_RESULT](#stable_workflow_result)
  - [Configuration Types](#configuration-types)
  - [State Persistence Types](#state-persistence-types)
  - [Hook Option Types](#hook-option-types)
  - [Decision Types](#decision-types)
- [Metrics and Observability Types](#metrics-and-observability-types)
  - [STABLE_REQUEST_RESULT](#stable_request_result)
  - [WorkflowMetrics](#workflowmetrics)
  - [Infrastructure Metrics](#infrastructure-metrics)
- [Enums](#enums)
  - [REQUEST_METHODS](#request_methods)
  - [RETRY_STRATEGIES](#retry_strategies)
  - [PHASE_DECISION_ACTIONS](#phase_decision_actions)
  - [CircuitBreakerState](#circuitbreakerstate)
  - [VALID_REQUEST_PROTOCOLS](#valid_request_protocols)
  - [RESPONSE_ERRORS](#response_errors)
- [Utility Functions](#utility-functions)

---

## Core Functions

### stableRequest

Execute a single HTTP request with built-in retry logic, circuit breaker, caching, and observability hooks.

```typescript
function stableRequest<RequestDataType = any, ResponseDataType = any>(
  options: STABLE_REQUEST<RequestDataType, ResponseDataType>
): Promise<STABLE_REQUEST_RESULT<ResponseDataType>>
```

#### Parameters

**`options`** (`STABLE_REQUEST<RequestDataType, ResponseDataType>`)

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `reqData` | `REQUEST_DATA<RequestDataType>` | Yes | - | Request configuration including hostname, path, method, headers, body, etc. |
| `resReq` | `boolean` | No | `false` | If `true`, returns the response data. If `false`, returns `true` on success or `false` on failure. |
| `attempts` | `number` | No | `1` | Maximum number of attempts (including the initial request). Must be ≥ 1. |
| `wait` | `number` | No | `1000` | Base wait time in milliseconds between retry attempts. |
| `maxAllowedWait` | `number` | No | `60000` | Maximum allowed wait time between retries (caps the backoff calculation). |
| `retryStrategy` | `RETRY_STRATEGY_TYPES` | No | `FIXED` | Retry backoff strategy: `FIXED`, `LINEAR`, or `EXPONENTIAL`. |
| `jitter` | `number` | No | `0` | If `non-zero`, applies randomized jitter to retry delays to prevent thundering herd issues. |
| `performAllAttempts` | `boolean` | No | `false` | If `true`, performs all attempts even if one succeeds (useful for testing). |
| `logAllErrors` | `boolean` | No | `false` | If `true`, logs all error attempts to console. |
| `logAllSuccessfulAttempts` | `boolean` | No | `false` | If `true`, logs all successful attempts to console. |
| `maxSerializableChars` | `number` | No | `1000` | Maximum characters to include when serializing objects in logs. |
| `trialMode` | `TRIAL_MODE_OPTIONS` | No | `undefined` | Enables trial mode for testing without making real API calls. |
| `responseAnalyzer` | `(options: ResponseAnalysisHookOptions) => boolean \| Promise<boolean>` | No | `undefined` | Custom function to validate response. Returns `true` if response is acceptable, `false` to retry. |
| `handleErrors` | `(options: HandleErrorHookOptions) => any \| Promise<any>` | No | `undefined` | Custom error handler called for each failed attempt. |
| `handleSuccessfulAttemptData` | `(options: HandleSuccessfulAttemptDataHookOptions) => any \| Promise<any>` | No | `undefined` | Custom handler called for each successful attempt. |
| `finalErrorAnalyzer` | `(options: FinalErrorAnalysisHookOptions) => boolean \| Promise<boolean>` | No | `undefined` | Analyzes the final error after all retries exhausted. Return `true` to suppress error (return `false`), `false` to throw. |
| `hookParams` | `HookParams` | No | `{}` | Custom parameters to pass to hook functions. |
| `preExecution` | `RequestPreExecutionOptions` | No | `undefined` | Pre-execution hook configuration for dynamic request modification. |
| `commonBuffer` | `Record<string, any>` | No | `undefined` | Shared buffer for storing/accessing data across requests. |
| `cache` | `CacheConfig` | No | `undefined` | Response caching configuration. |
| `circuitBreaker` | `CircuitBreakerConfig \| CircuitBreaker` | No | `undefined` | Circuit breaker configuration or instance. |
| `statePersistence` | `StatePersistenceConfig` | No | `undefined` | State persistence configuration. |
| `executionContext` | `ExecutionContext` | No | `undefined` | Execution context information (workflowId, phaseId, branchId, requestId). |

#### Returns

**`Promise<STABLE_REQUEST_RESULT<ResponseDataType>>`**

Returns a comprehensive result object containing:

| Property | Type | Description |
|----------|------|-------------|
| `success` | `boolean` | `true` if request succeeded, `false` if failed |
| `data` | `ResponseDataType` | Response data (when `resReq: true` and successful) |
| `error` | `string` | Error message (when request failed) |
| `errorLogs` | `ERROR_LOG[]` | Array of all failed attempt details |
| `successfulAttempts` | `SUCCESSFUL_ATTEMPT_DATA<ResponseDataType>[]` | Array of all successful attempt details |
| `metrics` | `object` | Computed execution metrics (see below) |

**Metrics Object Structure:**

| Property | Type | Description |
|----------|------|-------------|
| `totalAttempts` | `number` | Total number of attempts made |
| `successfulAttempts` | `number` | Number of successful attempts |
| `failedAttempts` | `number` | Number of failed attempts |
| `totalExecutionTime` | `number` | Total execution time in milliseconds |
| `averageAttemptTime` | `number` | Average time per attempt in milliseconds |
| `infrastructureMetrics` | `object` | Circuit breaker and cache metrics (if used) |

**Note:** The function no longer throws errors by default. Check `result.success` to determine if the request succeeded. Use `finalErrorAnalyzer` to customize error handling behavior.

#### Example

```typescript
import { stableRequest, RETRY_STRATEGIE, REQUEST_METHODS } from '@emmvish/stable-request';

const userData = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/users/123',
    method: REQUEST_METHODS.GET,
    headers: { 'Authorization': 'Bearer token' }
  },
  resReq: true,
  attempts: 3,
  wait: 1000,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
  jitter: 0.5,              // Enable jitter to avoid thundering herd
  responseAnalyzer: async ({ data }) => {
    return data.status === 'success';
  },
  handleErrors: async ({ errorLog }) => {
    console.error('Request failed:', errorLog);
  }
});
```

---

### stableApiGateway

Execute multiple HTTP requests either sequentially or concurrently with unified configuration and request grouping support.

```typescript
function stableApiGateway<RequestDataType = any, ResponseDataType = any>(
  requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[],
  options: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>
): Promise<API_GATEWAY_RESPONSE<ResponseDataType>[]>
```

#### Parameters

**`requests`** (`API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[]`)

Array of request objects to execute. See [API_GATEWAY_REQUEST](#api_gateway_request).

**`options`** (`API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>`)

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `concurrentExecution` | `boolean` | No | `true` | If `true`, executes all requests concurrently. If `false`, executes sequentially. |
| `stopOnFirstError` | `boolean` | No | `false` | If `true` (sequential mode), stops executing remaining requests after first error. In concurrent mode, stops launching new requests after detecting an error. |
| `commonRequestData` | `Partial<REQUEST_DATA>` | No | `{}` | Common request configuration applied to all requests (hostname, headers, etc.). |
| `commonAttempts` | `number` | No | `1` | Default number of retry attempts for all requests. |
| `commonWait` | `number` | No | `1000` | Default wait time between retries for all requests. |
| `commonMaxAllowedWait` | `number` | No | `60000` | Default maximum wait time for all requests. |
| `commonRetryStrategy` | `RETRY_STRATEGY_TYPES` | No | `FIXED` | Default retry strategy for all requests. |
| `commonJitter` | `number` | No | `0` | Default jitter setting for all requests. Randomizes retry delays. |
| `commonResReq` | `boolean` | No | `false` | Default value for `resReq` for all requests. |
| `commonLogAllErrors` | `boolean` | No | `false` | Default logging setting for errors. |
| `commonLogAllSuccessfulAttempts` | `boolean` | No | `false` | Default logging setting for successes. |
| `commonMaxSerializableChars` | `number` | No | `1000` | Default max chars for serialization. |
| `commonPerformAllAttempts` | `boolean` | No | `false` | Default `performAllAttempts` for all requests. |
| `commonTrialMode` | `TRIAL_MODE_OPTIONS` | No | `undefined` | Default trial mode configuration. |
| `commonResponseAnalyzer` | `(options: ResponseAnalysisHookOptions) => boolean \| Promise<boolean>` | No | `undefined` | Default response analyzer for all requests. |
| `commonFinalErrorAnalyzer` | `(options: FinalErrorAnalysisHookOptions) => boolean \| Promise<boolean>` | No | `undefined` | Default final error analyzer for all requests. |
| `commonHandleErrors` | `(options: HandleErrorHookOptions) => any \| Promise<any>` | No | `undefined` | Default error handler for all requests. |
| `commonHandleSuccessfulAttemptData` | `(options: HandleSuccessfulAttemptDataHookOptions) => any \| Promise<any>` | No | `undefined` | Default success handler for all requests. |
| `commonPreExecution` | `RequestPreExecutionOptions` | No | `undefined` | Default pre-execution hook configuration. |
| `commonCache` | `CacheConfig` | No | `undefined` | Default cache configuration for all requests. |
| `commonStatePersistence` | `StatePersistenceConfig` | No | `undefined` | Default state persistence configuration for all requests. |
| `commonHookParams` | `HookParams` | No | `{}` | Default parameters for hook functions. |
| `requestGroups` | `RequestGroup[]` | No | `[]` | Array of request group configurations for applying settings to specific groups. |
| `sharedBuffer` | `Record<string, any>` | No | `undefined` | Shared buffer accessible by all requests. |
| `maxConcurrentRequests` | `number` | No | `undefined` | Maximum number of concurrent requests (concurrent mode only). |
| `rateLimit` | `RateLimitConfig` | No | `undefined` | Rate limiting configuration. |
| `circuitBreaker` | `CircuitBreakerConfig` | No | `undefined` | Circuit breaker configuration. |
| `executionContext` | `Partial<ExecutionContext>` | No | `undefined` | Partial execution context information. |

#### Returns

**`Promise<API_GATEWAY_RESULT<ResponseDataType>>`**

An array of response objects (extends `API_GATEWAY_RESPONSE<ResponseDataType>[]`) with an attached `metrics` property containing:

| Property | Type | Description |
|----------|------|-------------|
| `totalRequests` | `number` | Total number of requests executed |
| `successfulRequests` | `number` | Number of successful requests |
| `failedRequests` | `number` | Number of failed requests |
| `successRate` | `number` | Success rate as percentage (0-100) |
| `failureRate` | `number` | Failure rate as percentage (0-100) |
| `requestGroups` | `RequestGroupMetrics[]` | Metrics for each request group |
| `infrastructureMetrics` | `object` | Circuit breaker, cache, rate limiter, and concurrency limiter metrics (when used) |

**Request Group Metrics:**

Each group contains:
- `groupId`: Group identifier
- `totalRequests`: Requests in this group
- `successfulRequests`: Successful requests in group
- `failedRequests`: Failed requests in group
- `successRate`: Group success rate (%)
- `failureRate`: Group failure rate (%)
- `requestIds`: Array of request IDs in this group

**Infrastructure Metrics:**

When circuit breaker, cache, rate limiter, or concurrency limiter are used, detailed metrics are included:
- `circuitBreaker`: State, failure percentage, recovery attempts, etc.
- `cache`: Hit rate, cache size, network requests saved, etc.
- `rateLimiter`: Throttled requests, peak request rate, etc.
- `concurrencyLimiter`: Peak concurrency, queue metrics, etc.

See [API_GATEWAY_RESULT](#api_gateway_result) for complete structure.

#### Example

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

const requests = [
  { 
    id: 'users', 
    requestOptions: { 
      reqData: { path: '/users' }, 
      resReq: true 
    } 
  },
  { 
    id: 'orders', 
    groupId: 'critical',
    requestOptions: { 
      reqData: { path: '/orders' }, 
      resReq: true 
    } 
  }
];

const results = await stableApiGateway(requests, {
  concurrentExecution: true,
  commonRequestData: { 
    hostname: 'api.example.com',
    headers: { 'X-API-Key': 'secret' }
  },
  commonAttempts: 2,
  requestGroups: [
    {
      groupId: 'critical',
      commonAttempts: 5,
      commonWait: 1000
    }
  ]
});
```

---

### stableWorkflow

Orchestrate complex multi-phase API workflows with support for sequential phases, concurrent phases, mixed execution, non-linear workflows, and branching.

```typescript
function stableWorkflow<RequestDataType = any, ResponseDataType = any>(
  phases: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>[],
  options: STABLE_WORKFLOW_OPTIONS<RequestDataType, ResponseDataType>
): Promise<STABLE_WORKFLOW_RESULT<ResponseDataType>>
```

#### Parameters

**`phases`** (`STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>[]`)

Array of workflow phases to execute. See [STABLE_WORKFLOW_PHASE](#stable_workflow_phase).

**`options`** (`STABLE_WORKFLOW_OPTIONS<RequestDataType, ResponseDataType>`)

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `workflowId` | `string` | No | `'workflow-{timestamp}'` | Unique identifier for this workflow execution. |
| `concurrentPhaseExecution` | `boolean` | No | `false` | If `true`, all phases execute concurrently. If `false`, phases execute sequentially. |
| `stopOnFirstPhaseError` | `boolean` | No | `false` | If `true`, stops workflow execution after first phase error. |
| `logPhaseResults` | `boolean` | No | `false` | If `true`, logs each phase result to console. |
| `enableMixedExecution` | `boolean` | No | `false` | Enables mixed execution mode where phases can be marked for concurrent execution using `markConcurrentPhase`. |
| `enableNonLinearExecution` | `boolean` | No | `false` | Enables non-linear execution with phase decision hooks (JUMP, SKIP, REPLAY, TERMINATE). |
| `enableBranchExecution` | `boolean` | No | `false` | Enables branch-based workflow execution. |
| `branches` | `STABLE_WORKFLOW_BRANCH[]` | No | `[]` | Array of workflow branches (when `enableBranchExecution: true`). |
| `maxWorkflowIterations` | `number` | No | `1000` | Maximum total phase executions to prevent infinite loops in non-linear workflows. |
| `handlePhaseCompletion` | `(options: HandlePhaseCompletionHookOptions) => any \| Promise<any>` | No | `console.log` | Hook called after each phase completes successfully. |
| `handlePhaseError` | `(options: HandlePhaseErrorHookOptions) => any \| Promise<any>` | No | `console.log` | Hook called when a phase encounters an error. |
| `handlePhaseDecision` | `(options: HandlePhaseDecisionHookOptions) => any \| Promise<any>` | No | `() => {}` | Hook called when a phase makes a non-linear decision. |
| `handleBranchCompletion` | `(options: { workflowId: string, branchId: string, branchResults: STABLE_WORKFLOW_PHASE_RESULT[], success: boolean, maxSerializableChars?: number }) => any \| Promise<any>` | No | `console.log` | Hook called when a branch completes. |
| `handleBranchDecision` | `(decision: BranchExecutionDecision, branchResult: BranchExecutionResult, maxSerializableChars?: number) => any \| Promise<any>` | No | `undefined` | Hook called when a branch makes a decision. |
| `workflowHookParams` | `WorkflowHookParams` | No | `{}` | Custom parameters passed to workflow-level hooks. |
| `sharedBuffer` | `Record<string, any>` | No | `{}` | Shared buffer accessible across all phases and branches. |
| `maxSerializableChars` | `number` | No | `1000` | Maximum characters for serialization in logs. |
| **All `API_GATEWAY_OPTIONS`** | - | No | - | All options from `stableApiGateway` (common config for all phases). |

#### Returns

**`Promise<STABLE_WORKFLOW_RESULT<ResponseDataType>>`**

Comprehensive workflow execution result. See [STABLE_WORKFLOW_RESULT](#stable_workflow_result).

#### Example

```typescript
import { stableWorkflow, PHASE_DECISION_ACTIONS, REQUEST_METHODS } from '@emmvish/stable-request';

const phases = [
  {
    id: 'authentication',
    requests: [
      { 
        id: 'login', 
        requestOptions: { 
          reqData: { path: '/auth/login', method: REQUEST_METHODS.POST }, 
          resReq: true 
        } 
      }
    ]
  },
  {
    id: 'fetch-data',
    concurrentExecution: true,
    requests: [
      { id: 'users', requestOptions: { reqData: { path: '/users' }, resReq: true } },
      { id: 'orders', requestOptions: { reqData: { path: '/orders' }, resReq: true } }
    ]
  },
  {
    id: 'process-results',
    requests: [
      { 
        id: 'analytics', 
        requestOptions: { 
          reqData: { path: '/analytics', method: REQUEST_METHODS.POST }, 
          resReq: false 
        } 
      }
    ],
    phaseDecisionHook: async ({ phaseResult }) => {
      if (phaseResult.success) {
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      }
      return { action: PHASE_DECISION_ACTIONS.REPLAY };
    }
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'user-workflow',
  commonRequestData: { hostname: 'api.example.com' },
  commonAttempts: 3,
  enableNonLinearExecution: true,
  stopOnFirstPhaseError: true,
  handlePhaseCompletion: async ({ phaseResult }) => {
    console.log(`Phase ${phaseResult.phaseId} completed`);
  }
});

console.log(`Success: ${result.success}`);
console.log(`Total requests: ${result.totalRequests}`);
console.log(`Execution time: ${result.executionTime}ms`);
```

---

## Utility Classes

### CircuitBreaker

Implements the circuit breaker pattern to prevent cascade failures and system overload.

```typescript
class CircuitBreaker {
  constructor(config: CircuitBreakerConfig)
  
  async canExecute(): Promise<boolean>
  recordSuccess(): void
  recordFailure(): void
  recordAttemptSuccess(): void
  recordAttemptFailure(): void
  getState(): CircuitBreakerStateInfo
  reset(): void
}
```

#### Constructor Parameters

**`config`** (`CircuitBreakerConfig`)

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `failureThresholdPercentage` | `number` | Yes | - | Percentage of failures (0-100) that triggers OPEN state. |
| `minimumRequests` | `number` | Yes | - | Minimum number of requests before evaluating failure threshold. |
| `recoveryTimeoutMs` | `number` | Yes | - | Time in milliseconds to wait in OPEN state before transitioning to HALF_OPEN. |
| `successThresholdPercentage` | `number` | No | `50` | Percentage of successes needed in HALF_OPEN to return to CLOSED. |
| `halfOpenMaxRequests` | `number` | No | `5` | Maximum number of requests allowed in HALF_OPEN state. |
| `trackIndividualAttempts` | `boolean` | No | `false` | If `true`, tracks individual retry attempts. If `false`, tracks request-level success/failure. |

#### Methods

##### `canExecute()`

Check if a request can be executed based on the current circuit breaker state.

**Returns:** `Promise<boolean>` - `true` if request can proceed, `false` if circuit is open.

##### `recordSuccess()`

Record a successful request completion (not individual attempt).

##### `recordFailure()`

Record a failed request (after all retry attempts exhausted).

##### `recordAttemptSuccess()`

Record a successful individual attempt.

##### `recordAttemptFailure()`

Record a failed individual attempt.

##### `getState()`

Get the current state and statistics of the circuit breaker.

**Returns:** Object with:
- `state`: `'CLOSED' | 'OPEN' | 'HALF_OPEN'`
- `totalRequests`: `number`
- `failedRequests`: `number`
- `successfulRequests`: `number`
- `failureRate`: `number`
- `halfOpenRequests`: `number`
- `halfOpenSuccesses`: `number`
- `halfOpenFailures`: `number`

##### `reset()`

Reset the circuit breaker to initial state (CLOSED with all counters at 0).

#### Example

```typescript
import { CircuitBreaker } from '@emmvish/stable-request';

const breaker = new CircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 5,
  recoveryTimeoutMs: 60000,
  successThresholdPercentage: 70,
  halfOpenMaxRequests: 3
});

// Use with stableRequest
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  circuitBreaker: breaker,
  attempts: 3
});

// Check state
const state = breaker.getState();
console.log(`Circuit breaker state: ${state.state}`);
console.log(`Failure rate: ${state.failureRate}%`);
```

---

### RateLimiter

Token bucket-based rate limiter to control request rates.

```typescript
class RateLimiter {
  constructor(maxRequests: number, windowMs: number)
  
  async execute<T>(fn: () => Promise<T>): Promise<T>
  async executeAll<T>(fns: Array<() => Promise<T>>): Promise<T[]>
  getState(): RateLimiterState
}
```

#### Constructor Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `maxRequests` | `number` | Yes | Maximum number of requests allowed in the time window. |
| `windowMs` | `number` | Yes | Time window in milliseconds. |

#### Methods

##### `execute<T>(fn)`

Execute a function with rate limiting.

**Parameters:**
- `fn`: `() => Promise<T>` - Async function to execute

**Returns:** `Promise<T>` - Result of the function

##### `executeAll<T>(fns)`

Execute multiple functions with rate limiting.

**Parameters:**
- `fns`: `Array<() => Promise<T>>` - Array of async functions

**Returns:** `Promise<T[]>` - Array of results

##### `getState()`

Get current rate limiter state.

**Returns:** Object with:
- `availableTokens`: `number` - Current available tokens
- `queueLength`: `number` - Number of queued requests
- `maxRequests`: `number` - Maximum requests per window
- `windowMs`: `number` - Time window in milliseconds

#### Example

```typescript
import { RateLimiter } from '@emmvish/stable-request';

const limiter = new RateLimiter(100, 60000); // 100 requests per minute

await stableApiGateway(requests, {
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000
  }
});

// Or use standalone
const result = await limiter.execute(async () => {
  return await fetch('https://api.example.com/data');
});
```

---

### ConcurrencyLimiter

Limits the number of concurrent operations.

```typescript
class ConcurrencyLimiter {
  constructor(limit: number)
  
  async execute<T>(fn: () => Promise<T>): Promise<T>
  async executeAll<T>(fns: Array<() => Promise<T>>): Promise<T[]>
}
```

#### Constructor Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | `number` | Yes | Maximum number of concurrent operations. Must be ≥ 1. |

#### Methods

##### `execute<T>(fn)`

Execute a function with concurrency limiting.

**Parameters:**
- `fn`: `() => Promise<T>` - Async function to execute

**Returns:** `Promise<T>` - Result of the function

##### `executeAll<T>(fns)`

Execute multiple functions with concurrency limiting.

**Parameters:**
- `fns`: `Array<() => Promise<T>>` - Array of async functions

**Returns:** `Promise<T[]>` - Array of results

#### Example

```typescript
import { ConcurrencyLimiter } from '@emmvish/stable-request';

const limiter = new ConcurrencyLimiter(5); // Max 5 concurrent operations

await stableWorkflow(phases, {
  maxConcurrentRequests: 5
});

// Or use standalone
const results = await limiter.executeAll([
  () => fetchUser(1),
  () => fetchUser(2),
  () => fetchUser(3),
  () => fetchUser(4),
  () => fetchUser(5),
  () => fetchUser(6) // Will wait for one of above to complete
]);
```

---

### MetricsAggregator

Utility class for extracting and computing metrics from workflow results, phases, branches, and infrastructure components.

```typescript
class MetricsAggregator {
  static extractWorkflowMetrics<T>(result: STABLE_WORKFLOW_RESULT<T>): WorkflowMetrics
  static extractBranchMetrics<T>(branch: BranchExecutionResult<T>): BranchMetrics
  static extractPhaseMetrics<T>(phase: STABLE_WORKFLOW_PHASE_RESULT<T>): PhaseMetrics
  static extractRequestGroupMetrics<T>(responses: API_GATEWAY_RESPONSE<T>[]): RequestGroupMetrics[]
  static extractRequestMetrics<T>(responses: API_GATEWAY_RESPONSE<T>[]): RequestMetrics[]
  static extractCircuitBreakerMetrics(circuitBreaker: CircuitBreaker): CircuitBreakerDashboardMetrics
  static extractCacheMetrics(cache: CacheManager): CacheDashboardMetrics
  static extractRateLimiterMetrics(rateLimiter: RateLimiter): RateLimiterDashboardMetrics
  static extractConcurrencyLimiterMetrics(limiter: ConcurrencyLimiter): ConcurrencyLimiterDashboardMetrics
  static aggregateSystemMetrics<T>(
    workflowResult: STABLE_WORKFLOW_RESULT<T>,
    circuitBreaker?: CircuitBreaker,
    cache?: CacheManager,
    rateLimiter?: RateLimiter,
    concurrencyLimiter?: ConcurrencyLimiter
  ): SystemMetrics
}
```

#### Methods

##### `extractWorkflowMetrics(result)`

Extracts comprehensive metrics from a workflow result.

**Parameters:**
- `result`: `STABLE_WORKFLOW_RESULT<T>` - Workflow execution result

**Returns:** `WorkflowMetrics` with:
- `workflowId`, `success`, `executionTime`, `timestamp`
- `totalPhases`, `completedPhases`, `skippedPhases`, `failedPhases`, `phaseCompletionRate`
- `totalRequests`, `successfulRequests`, `failedRequests`, `requestSuccessRate`, `requestFailureRate`
- `throughput` (requests/second), `averagePhaseExecutionTime`
- `totalPhaseReplays`, `totalPhaseSkips`, `terminatedEarly`, `terminationReason`
- `totalBranches`, `completedBranches`, `failedBranches`, `branchSuccessRate` (if applicable)

##### `extractBranchMetrics(branch)`

Extracts metrics from a branch execution result.

**Parameters:**
- `branch`: `BranchExecutionResult<T>` - Branch execution result

**Returns:** `BranchMetrics` with:
- `branchId`, `branchIndex`, `executionNumber`, `success`, `executionTime`, `skipped`
- `totalPhases`, `completedPhases`, `failedPhases`, `phaseCompletionRate`
- `totalRequests`, `successfulRequests`, `failedRequests`, `requestSuccessRate`
- `hasDecision`, `decisionAction`, `error`

##### `extractPhaseMetrics(phase)`

Extracts metrics from a phase execution result.

**Parameters:**
- `phase`: `STABLE_WORKFLOW_PHASE_RESULT<T>` - Phase execution result

**Returns:** `PhaseMetrics` with:
- `phaseId`, `phaseIndex`, `workflowId`, `branchId`, `executionNumber`
- `success`, `skipped`, `executionTime`, `timestamp`
- `totalRequests`, `successfulRequests`, `failedRequests`, `requestSuccessRate`, `requestFailureRate`
- `hasDecision`, `decisionAction`, `targetPhaseId`, `replayCount`, `error`

##### `extractRequestGroupMetrics(responses)`

Extracts metrics for each request group from API gateway responses.

**Parameters:**
- `responses`: `API_GATEWAY_RESPONSE<T>[]` - Array of API responses

**Returns:** `RequestGroupMetrics[]` - Array of metrics per group, each containing:
- `groupId`: Group identifier
- `totalRequests`, `successfulRequests`, `failedRequests`
- `successRate`, `failureRate` (percentages)
- `requestIds`: Array of request IDs in this group

##### `extractRequestMetrics(responses)`

Extracts individual metrics for each request.

**Parameters:**
- `responses`: `API_GATEWAY_RESPONSE<T>[]` - Array of API responses

**Returns:** `RequestMetrics[]` - Array of metrics per request, each containing:
- `requestId`: Request identifier
- `groupId`: Group identifier (if assigned)
- `success`: Success status
- `hasError`: Whether request had an error
- `errorMessage`: Error message (if failed)

##### `extractCircuitBreakerMetrics(circuitBreaker)`

Extracts comprehensive metrics from a circuit breaker instance.

**Parameters:**
- `circuitBreaker`: `CircuitBreaker` - Circuit breaker instance

**Returns:** `CircuitBreakerDashboardMetrics` with:
- `state`: Current state (CLOSED | OPEN | HALF_OPEN)
- `isHealthy`, `isCurrentlyOpen`
- `totalRequests`, `successfulRequests`, `failedRequests`, `failurePercentage`
- `stateTransitions`, `openCount`, `totalOpenDuration`, `averageOpenDuration`
- `lastStateChangeTime`, `timeSinceLastStateChange`
- `openUntil`, `timeUntilRecovery`
- `recoveryAttempts`, `successfulRecoveries`, `failedRecoveries`, `recoverySuccessRate`
- `config`: Circuit breaker configuration

##### `extractCacheMetrics(cache)`

Extracts comprehensive metrics from a cache manager instance.

**Parameters:**
- `cache`: `CacheManager` - Cache manager instance

**Returns:** `CacheDashboardMetrics` with:
- `isEnabled`, `currentSize`, `maxSize`, `validEntries`, `expiredEntries`, `utilizationPercentage`
- `totalRequests`, `hits`, `misses`, `hitRate`, `missRate`
- `sets`, `evictions`, `expirations`
- `averageGetTime`, `averageSetTime`
- `averageCacheAge`, `oldestEntryAge`, `newestEntryAge`
- `networkRequestsSaved`, `cacheEfficiency`

##### `extractRateLimiterMetrics(rateLimiter)`

Extracts comprehensive metrics from a rate limiter instance.

**Parameters:**
- `rateLimiter`: `RateLimiter` - Rate limiter instance

**Returns:** `RateLimiterDashboardMetrics` with:
- `maxRequests`, `windowMs`
- `availableTokens`, `queueLength`, `requestsInCurrentWindow`
- `totalRequests`, `completedRequests`, `throttledRequests`, `throttleRate`
- `currentRequestRate`, `peakRequestRate`, `averageRequestRate`
- `peakQueueLength`, `averageQueueWaitTime`
- `isThrottling`, `utilizationPercentage`

##### `extractConcurrencyLimiterMetrics(limiter)`

Extracts comprehensive metrics from a concurrency limiter instance.

**Parameters:**
- `limiter`: `ConcurrencyLimiter` - Concurrency limiter instance

**Returns:** `ConcurrencyLimiterDashboardMetrics` with:
- `limit`, `running`, `queueLength`, `utilizationPercentage`
- `totalRequests`, `completedRequests`, `failedRequests`, `queuedRequests`, `successRate`
- `peakConcurrency`, `averageConcurrency`, `concurrencyUtilization`
- `peakQueueLength`, `averageQueueWaitTime`, `averageExecutionTime`
- `isAtCapacity`, `hasQueuedRequests`

##### `aggregateSystemMetrics(workflowResult, ...)`

Aggregates all metrics from a workflow and its infrastructure components into a single comprehensive view.

**Parameters:**
- `workflowResult`: `STABLE_WORKFLOW_RESULT<T>` - Workflow execution result
- `circuitBreaker`: `CircuitBreaker` (optional) - Circuit breaker instance
- `cache`: `CacheManager` (optional) - Cache manager instance
- `rateLimiter`: `RateLimiter` (optional) - Rate limiter instance
- `concurrencyLimiter`: `ConcurrencyLimiter` (optional) - Concurrency limiter instance

**Returns:** `SystemMetrics` containing:
- `workflow`: WorkflowMetrics
- `branches`: BranchMetrics[]
- `phases`: PhaseMetrics[]
- `requestGroups`: RequestGroupMetrics[]
- `requests`: RequestMetrics[]
- `circuitBreaker`: CircuitBreakerDashboardMetrics (if provided)
- `cache`: CacheDashboardMetrics (if provided)
- `rateLimiter`: RateLimiterDashboardMetrics (if provided)
- `concurrencyLimiter`: ConcurrencyLimiterDashboardMetrics (if provided)

#### Example

```typescript
import { MetricsAggregator, stableWorkflow } from '@emmvish/stable-request';

// Execute workflow
const result = await stableWorkflow(phases, options);

// Extract metrics at different levels
const workflowMetrics = MetricsAggregator.extractWorkflowMetrics(result);
console.log('Throughput:', workflowMetrics.throughput, 'req/s');
console.log('Success Rate:', workflowMetrics.requestSuccessRate, '%');

// Extract per-phase metrics
result.phases.forEach(phase => {
  const metrics = MetricsAggregator.extractPhaseMetrics(phase);
  console.log(`Phase ${metrics.phaseId}:`, {
    executionTime: metrics.executionTime,
    successRate: metrics.requestSuccessRate
  });
});

// Extract request group metrics
const requestGroups = MetricsAggregator.extractRequestGroupMetrics(
  result.phases.flatMap(p => p.responses)
);
requestGroups.forEach(group => {
  console.log(`Group ${group.groupId}: ${group.successRate}% success`);
});

// Get complete system view
const systemMetrics = MetricsAggregator.aggregateSystemMetrics(
  result,
  circuitBreaker,
  cache,
  rateLimiter,
  concurrencyLimiter
);

console.log('Complete System Metrics:', JSON.stringify(systemMetrics, null, 2));
```

---

### CacheManager

Manages HTTP response caching with TTL support and cache-control header respect.

```typescript
class CacheManager {
  constructor(config: CacheConfig)
  
  get<T>(reqConfig: AxiosRequestConfig): CachedResponse<T> | null
  set<T>(reqConfig: AxiosRequestConfig, response: any): void
  delete(reqConfig: AxiosRequestConfig): boolean
  clearAll(): void
  getStats(): CacheStats
}
```

#### Constructor Parameters

**`config`** (`CacheConfig`)

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `enabled` | `boolean` | Yes | - | Enable or disable caching. |
| `ttl` | `number` | No | `300000` | Time-to-live in milliseconds (default: 5 minutes). |
| `respectCacheControl` | `boolean` | No | `true` | Respect Cache-Control and Expires headers from responses. |
| `cacheableStatusCodes` | `number[]` | No | `[200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501]` | HTTP status codes that should be cached. |
| `maxSize` | `number` | No | `100` | Maximum number of cached entries. |
| `excludeMethods` | `string[]` | No | `['POST', 'PUT', 'PATCH', 'DELETE']` | HTTP methods to exclude from caching. |
| `keyGenerator` | `(config: AxiosRequestConfig) => string` | No | `undefined` | Custom function to generate cache keys. |

#### Methods

##### `get<T>(reqConfig)`

Retrieve a cached response.

**Parameters:**
- `reqConfig`: `AxiosRequestConfig` - Request configuration

**Returns:** `CachedResponse<T> | null` - Cached response or `null` if not found or expired

##### `set<T>(reqConfig, response)`

Store a response in the cache.

**Parameters:**
- `reqConfig`: `AxiosRequestConfig` - Request configuration
- `response`: `any` - Response to cache

##### `delete(reqConfig)`

Delete a cached entry.

**Parameters:**
- `reqConfig`: `AxiosRequestConfig` - Request configuration

**Returns:** `boolean` - `true` if entry was deleted, `false` if not found

##### `clearAll()`

Clear all cached entries.

##### `getStats()`

Get cache statistics.

**Returns:** Object with:
- `size`: `number` - Total cache entries
- `validEntries`: `number` - Non-expired entries
- `expiredEntries`: `number` - Expired entries

#### Global Cache Functions

```typescript
import { 
  getGlobalCacheManager, 
  resetGlobalCacheManager 
} from '@emmvish/stable-request';

const cacheManager = getGlobalCacheManager();
const stats = cacheManager.getStats();

resetGlobalCacheManager(); // Create new global instance
```

#### Example

```typescript
import { stableRequest } from '@emmvish/stable-request';

await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/static-data' },
  resReq: true,
  cache: {
    enabled: true,
    ttl: 300000, // 5 minutes
    respectCacheControl: true,
    cacheableStatusCodes: [200, 304],
    keyGenerator: (config) => {
      return `custom-${config.url}`;
    }
  }
});
```

---

## Type Definitions

Complete type definitions for all configuration options, request/response structures, and workflow components.

---

### Core Request/Response Types

#### REQUEST_DATA

Configuration for a single HTTP request.

```typescript
interface REQUEST_DATA<RequestDataType = any> {
  hostname: string;
  protocol?: 'http' | 'https';
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path?: `/${string}`;
  port?: number;
  headers?: Record<string, any>;
  body?: RequestDataType;
  query?: Record<string, any>;
  timeout?: number;
  signal?: AbortSignal;
}
```

#### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `hostname` | `string` | Yes | - | Target hostname (without protocol). |
| `protocol` | `'http' \| 'https'` | No | `'https'` | Request protocol. |
| `method` | `'GET' \| 'POST' \| 'PUT' \| 'PATCH' \| 'DELETE'` | No | `'GET'` | HTTP method. |
| `path` | `` `/${string}` `` | No | `'/'` | Request path (must start with `/`). |
| `port` | `number` | No | `443` (https) / `80` (http) | Port number. |
| `headers` | `Record<string, any>` | No | `{}` | Request headers. |
| `body` | `RequestDataType` | No | `undefined` | Request body (automatically serialized). |
| `query` | `Record<string, any>` | No | `{}` | Query parameters. |
| `timeout` | `number` | No | `0` (no timeout) | Request timeout in milliseconds. |
| `signal` | `AbortSignal` | No | `undefined` | AbortSignal for request cancellation. |

---

#### STABLE_REQUEST

Complete configuration options for the `stableRequest` function.

```typescript
interface STABLE_REQUEST<RequestDataType = any, ResponseDataType = any> {
  reqData: REQUEST_DATA<RequestDataType>;
  resReq?: boolean;
  attempts?: number;
  wait?: number;
  maxAllowedWait?: number;
  retryStrategy?: RETRY_STRATEGY_TYPES;
  jitter?: number;
  performAllAttempts?: boolean;
  logAllErrors?: boolean;
  logAllSuccessfulAttempts?: boolean;
  maxSerializableChars?: number;
  trialMode?: TRIAL_MODE_OPTIONS;
  responseAnalyzer?: (options: ResponseAnalysisHookOptions) => boolean | Promise<boolean>;
  handleErrors?: (options: HandleErrorHookOptions) => any | Promise<any>;
  handleSuccessfulAttemptData?: (options: HandleSuccessfulAttemptDataHookOptions) => any | Promise<any>;
  finalErrorAnalyzer?: (options: FinalErrorAnalysisHookOptions) => boolean | Promise<boolean>;
  hookParams?: HookParams;
  preExecution?: RequestPreExecutionOptions;
  commonBuffer?: Record<string, any>;
  cache?: CacheConfig;
  circuitBreaker?: CircuitBreakerConfig | CircuitBreaker;
  statePersistence?: StatePersistenceConfig;
  executionContext?: ExecutionContext;
}
```

See [stableRequest](#stablerequest) for detailed property descriptions.

---

#### API_GATEWAY_OPTIONS

Complete configuration options for the `stableApiGateway` function, including all common request settings and execution control.

```typescript
interface API_GATEWAY_OPTIONS<RequestDataType = any, ResponseDataType = any> {
  concurrentExecution?: boolean;
  stopOnFirstError?: boolean;
  commonRequestData?: Partial<REQUEST_DATA<RequestDataType>>;
  commonAttempts?: number;
  commonWait?: number;
  commonMaxAllowedWait?: number;
  commonRetryStrategy?: RETRY_STRATEGY_TYPES;
  commonJitter?: number;
  commonResReq?: boolean;
  commonLogAllErrors?: boolean;
  commonLogAllSuccessfulAttempts?: boolean;
  commonMaxSerializableChars?: number;
  commonPerformAllAttempts?: boolean;
  commonTrialMode?: TRIAL_MODE_OPTIONS;
  commonResponseAnalyzer?: (options: ResponseAnalysisHookOptions) => boolean | Promise<boolean>;
  commonFinalErrorAnalyzer?: (options: FinalErrorAnalysisHookOptions) => boolean | Promise<boolean>;
  commonHandleErrors?: (options: HandleErrorHookOptions) => any | Promise<any>;
  commonHandleSuccessfulAttemptData?: (options: HandleSuccessfulAttemptDataHookOptions) => any | Promise<any>;
  commonPreExecution?: RequestPreExecutionOptions;
  commonCache?: CacheConfig;
  commonStatePersistence?: StatePersistenceConfig;
  commonHookParams?: HookParams;
  requestGroups?: RequestGroup[];
  sharedBuffer?: Record<string, any>;
  maxConcurrentRequests?: number;
  rateLimit?: RateLimitConfig;
  circuitBreaker?: CircuitBreakerConfig;
  executionContext?: Partial<ExecutionContext>;
}
```

See [stableApiGateway](#stableapigateway) for detailed property descriptions.

---

#### API_GATEWAY_REQUEST

Individual request configuration for API Gateway.

```typescript
interface API_GATEWAY_REQUEST<RequestDataType = any, ResponseDataType = any> {
  id: string;
  groupId?: string;
  requestOptions: API_GATEWAY_REQUEST_OPTIONS_TYPE<RequestDataType, ResponseDataType>;
}
```

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier for this request. |
| `groupId` | `string` | No | Optional group ID for applying group-level configuration. |
| `requestOptions` | `API_GATEWAY_REQUEST_OPTIONS_TYPE` | Yes | Request options (similar to `STABLE_REQUEST` but `reqData` can be partial). |

---

### API_GATEWAY_RESPONSE

Response object returned for each request in API Gateway.

```typescript
interface API_GATEWAY_RESPONSE<ResponseDataType = any> {
  requestId: string;
  groupId?: string;
  success: boolean;
  data?: ResponseDataType;
  error?: string;
}
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `requestId` | `string` | ID of the request this response corresponds to. |
| `groupId` | `string` | Group ID if request was part of a group. |
| `success` | `boolean` | `true` if request succeeded, `false` if failed. |
| `data` | `ResponseDataType` | Response data (if `resReq: true` and successful). |
| `error` | `string` | Error message (if failed). |

---

### API_GATEWAY_RESULT

Extended response array returned by `stableApiGateway` with attached metrics property.

```typescript
interface API_GATEWAY_RESULT<ResponseDataType = any> extends Array<API_GATEWAY_RESPONSE<ResponseDataType>> {
  metrics?: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    failureRate: number;
    requestGroups?: RequestGroupMetrics[];
    infrastructureMetrics?: {
      circuitBreaker?: CircuitBreakerDashboardMetrics;
      cache?: CacheDashboardMetrics;
      rateLimiter?: RateLimiterDashboardMetrics;
      concurrencyLimiter?: ConcurrencyLimiterDashboardMetrics;
    };
  };
}
```

#### Properties

The result extends `Array<API_GATEWAY_RESPONSE>`, so it includes all array methods and individual response objects. Additionally:

| Property | Type | Description |
|----------|------|-------------|
| `metrics` | `object` | Computed API gateway execution metrics. |
| `metrics.totalRequests` | `number` | Total number of requests executed. |
| `metrics.successfulRequests` | `number` | Number of successful requests. |
| `metrics.failedRequests` | `number` | Number of failed requests. |
| `metrics.successRate` | `number` | Success rate as percentage (0-100). |
| `metrics.failureRate` | `number` | Failure rate as percentage (0-100). |
| `metrics.requestGroups` | `RequestGroupMetrics[]` | Per-group metrics (if request groups used). |
| `metrics.infrastructureMetrics` | `object` | Infrastructure metrics (if components used). |

---

### Workflow Types

#### STABLE_WORKFLOW_OPTIONS

Complete configuration options for the `stableWorkflow` function, extending `API_GATEWAY_OPTIONS` with workflow-specific settings.

```typescript
interface STABLE_WORKFLOW_OPTIONS<RequestDataType = any, ResponseDataType = any> 
  extends Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, 
    'concurrentExecution' | 'stopOnFirstError'> {
  workflowId?: string;
  concurrentPhaseExecution?: boolean;
  stopOnFirstPhaseError?: boolean;
  logPhaseResults?: boolean;
  enableMixedExecution?: boolean;
  enableNonLinearExecution?: boolean;
  enableBranchExecution?: boolean;
  branches?: STABLE_WORKFLOW_BRANCH[];
  maxWorkflowIterations?: number;
  handlePhaseCompletion?: (options: HandlePhaseCompletionHookOptions) => any | Promise<any>;
  handlePhaseError?: (options: HandlePhaseErrorHookOptions) => any | Promise<any>;
  handlePhaseDecision?: (options: HandlePhaseDecisionHookOptions) => any | Promise<any>;
  handleBranchCompletion?: (options: HandleBranchCompletionHookOptions) => any | Promise<any>;
  handleBranchDecision?: (decision: BranchExecutionDecision, branchResult: BranchExecutionResult, maxSerializableChars?: number) => any | Promise<any>;
  maxSerializableChars?: number;
  workflowHookParams?: WorkflowHookParams;
  statePersistence?: StatePersistenceConfig;
}
```

See [stableWorkflow](#stableworkflow) for detailed property descriptions.

---

#### STABLE_WORKFLOW_PHASE

Configuration for a single workflow phase.

```typescript
interface STABLE_WORKFLOW_PHASE<RequestDataType = any, ResponseDataType = any> {
  id?: string;
  requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[];
  concurrentExecution?: boolean;
  stopOnFirstError?: boolean;
  markConcurrentPhase?: boolean;
  maxConcurrentRequests?: number;
  rateLimit?: RateLimitConfig;
  circuitBreaker?: CircuitBreakerConfig;
  maxReplayCount?: number;
  allowReplay?: boolean;
  allowSkip?: boolean;
  phaseDecisionHook?: (options: PhaseDecisionHookOptions) => PhaseExecutionDecision | Promise<PhaseExecutionDecision>;
  commonConfig?: Omit<API_GATEWAY_OPTIONS, 'concurrentExecution' | 'stopOnFirstError' | 'requestGroups' | 'maxConcurrentRequests' | 'rateLimit' | 'circuitBreaker'>;
  branchId?: string;
  statePersistence?: StatePersistenceConfig;
}
```

#### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `id` | `string` | No | Auto-generated | Unique identifier for this phase. |
| `requests` | `API_GATEWAY_REQUEST[]` | Yes | - | Array of requests to execute in this phase. |
| `concurrentExecution` | `boolean` | No | `true` | Execute requests concurrently or sequentially within this phase. |
| `stopOnFirstError` | `boolean` | No | `false` | Stop phase execution on first request error. |
| `markConcurrentPhase` | `boolean` | No | `false` | Mark this phase for concurrent execution in mixed execution mode. |
| `maxConcurrentRequests` | `number` | No | `undefined` | Maximum concurrent requests for this phase. |
| `rateLimit` | `RateLimitConfig` | No | `undefined` | Rate limiting for this phase. |
| `circuitBreaker` | `CircuitBreakerConfig` | No | `undefined` | Circuit breaker for this phase. |
| `maxReplayCount` | `number` | No | `0` | Maximum times this phase can be replayed. |
| `allowReplay` | `boolean` | No | `false` | Allow this phase to be replayed via decision hook. |
| `allowSkip` | `boolean` | No | `true` | Allow this phase to be skipped via decision hook. |
| `phaseDecisionHook` | `(options: PhaseDecisionHookOptions) => PhaseExecutionDecision \| Promise<PhaseExecutionDecision>` | No | `undefined` | Decision hook for non-linear execution (JUMP, SKIP, REPLAY, TERMINATE). |
| `commonConfig` | `Partial<API_GATEWAY_OPTIONS>` | No | `{}` | Phase-level configuration overrides. |
| `statePersistence` | `StatePersistenceConfig` | No | `undefined` | State persistence configuration for this phase. |
| `branchId` | `string` | No | `undefined` | Branch identifier if this phase belongs to a branch. |

---

### STABLE_WORKFLOW_BRANCH

Configuration for a workflow branch.

```typescript
interface STABLE_WORKFLOW_BRANCH<RequestDataType = any, ResponseDataType = any> {
  id: string;
  phases: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>[];
  markConcurrentBranch?: boolean;
  allowReplay?: boolean;
  maxReplayCount?: number;
  allowSkip?: boolean;
  branchDecisionHook?: (options: BranchDecisionHookOptions) => BranchExecutionDecision | Promise<BranchExecutionDecision>;
  statePersistence?: StatePersistenceConfig;
  commonConfig?: Omit<API_GATEWAY_OPTIONS, 'concurrentExecution' | 'stopOnFirstError' | 'requestGroups' | 'maxConcurrentRequests' | 'rateLimit' | 'circuitBreaker'>;
}
```

#### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `id` | `string` | Yes | - | Unique identifier for this branch. |
| `phases` | `STABLE_WORKFLOW_PHASE[]` | Yes | - | Array of phases to execute in this branch. |
| `markConcurrentBranch` | `boolean` | No | `false` | Execute this branch concurrently with other marked branches. |
| `allowReplay` | `boolean` | No | `false` | Allow this branch to be replayed. |
| `maxReplayCount` | `number` | No | `0` | Maximum times this branch can be replayed. |
| `allowSkip` | `boolean` | No | `true` | Allow this branch to be skipped. |
| `branchDecisionHook` | `(options: BranchDecisionHookOptions) => BranchExecutionDecision \| Promise<BranchExecutionDecision>` | No | `undefined` | Decision hook for branch-level decisions. |
| `statePersistence` | `StatePersistenceConfig` | No | `undefined` | State persistence configuration for this branch. |
| `commonConfig` | `Partial<API_GATEWAY_OPTIONS>` | No | `{}` | Branch-level configuration overrides. |

---

### STABLE_WORKFLOW_RESULT

Result object returned by `stableWorkflow`.

```typescript
interface STABLE_WORKFLOW_RESULT<ResponseDataType = any> {
  workflowId: string;
  success: boolean;
  executionTime: number;
  timestamp: string;
  totalPhases: number;
  completedPhases: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  phases: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
  executionHistory: PhaseExecutionRecord[];
  branches?: BranchExecutionResult<ResponseDataType>[];
  branchExecutionHistory?: BranchExecutionRecord[];
  terminatedEarly?: boolean;
  terminationReason?: string;
  error?: string;
  metrics?: WorkflowMetrics;
  requestGroupMetrics?: RequestGroupMetrics[];
  infrastructureMetrics?: {
    circuitBreaker?: CircuitBreakerDashboardMetrics;
    cache?: CacheDashboardMetrics;
    rateLimiter?: RateLimiterDashboardMetrics;
    concurrencyLimiter?: ConcurrencyLimiterDashboardMetrics;
  };
}
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `workflowId` | `string` | Workflow identifier. |
| `success` | `boolean` | `true` if all phases succeeded, `false` otherwise. |
| `executionTime` | `number` | Total execution time in milliseconds. |
| `timestamp` | `string` | ISO timestamp when workflow started. |
| `totalPhases` | `number` | Total number of phases defined. |
| `completedPhases` | `number` | Number of phases that completed. |
| `totalRequests` | `number` | Total number of requests across all phases. |
| `successfulRequests` | `number` | Number of successful requests. |
| `failedRequests` | `number` | Number of failed requests. |
| `phases` | `STABLE_WORKFLOW_PHASE_RESULT[]` | Detailed results for each phase. |
| `executionHistory` | `PhaseExecutionRecord[]` | Execution history (for non-linear workflows). |
| `branches` | `BranchExecutionResult[]` | Branch execution results (if branch execution enabled). |
| `branchExecutionHistory` | `BranchExecutionRecord[]` | Branch execution history. |
| `terminatedEarly` | `boolean` | `true` if workflow terminated early. |
| `terminationReason` | `string` | Reason for early termination. |
| `error` | `string` | Error message if workflow failed. |
| `metrics` | `WorkflowMetrics` | Computed workflow-level metrics. |
| `requestGroupMetrics` | `RequestGroupMetrics[]` | Metrics for each request group. |
| `infrastructureMetrics` | `object` | Infrastructure component metrics (circuit breaker, cache, etc.). |

---

### Result Types

Types representing the results returned by workflow execution functions.

#### STABLE_WORKFLOW_PHASE_RESULT

Detailed result for a single phase execution within a workflow.

```typescript
interface STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType = any> {
  workflowId: string;
  branchId?: string;
  phaseId: string;
  phaseIndex: number;
  success: boolean;
  executionTime: number;
  timestamp: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  responses: API_GATEWAY_RESPONSE<ResponseDataType>[];
  executionNumber?: number;
  skipped?: boolean;
  decision?: PhaseExecutionDecision;
  error?: string;
  metrics?: PhaseMetrics;
  infrastructureMetrics?: {
    circuitBreaker?: CircuitBreakerDashboardMetrics;
    cache?: CacheDashboardMetrics;
    rateLimiter?: RateLimiterDashboardMetrics;
    concurrencyLimiter?: ConcurrencyLimiterDashboardMetrics;
  };
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `workflowId` | `string` | Parent workflow identifier. |
| `branchId` | `string` | Parent branch identifier (if phase executed within a branch). |
| `phaseId` | `string` | Unique phase identifier. |
| `phaseIndex` | `number` | Zero-based index of this phase in the workflow. |
| `success` | `boolean` | Whether all requests in the phase succeeded. |
| `executionTime` | `number` | Total phase execution time in milliseconds. |
| `timestamp` | `string` | ISO timestamp when phase started. |
| `totalRequests` | `number` | Total number of requests in this phase. |
| `successfulRequests` | `number` | Number of successful requests. |
| `failedRequests` | `number` | Number of failed requests. |
| `responses` | `API_GATEWAY_RESPONSE[]` | Array of individual request responses. |
| `executionNumber` | `number` | Execution count (increments with each replay). |
| `skipped` | `boolean` | Whether this phase was skipped. |
| `decision` | `PhaseExecutionDecision` | Decision made by phase (for non-linear workflows). |
| `error` | `string` | Error message if phase failed. |
| `metrics` | `PhaseMetrics` | Computed phase-level metrics. |
| `infrastructureMetrics` | `object` | Infrastructure component metrics. |

---

#### PhaseExecutionRecord

Execution history record for phase tracking in non-linear workflows.

```typescript
interface PhaseExecutionRecord {
  phaseId: string;
  phaseIndex: number;
  executionNumber: number;
  timestamp: string;
  success: boolean;
  executionTime: number;
  decision?: PhaseExecutionDecision;
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `phaseId` | `string` | Phase identifier. |
| `phaseIndex` | `number` | Zero-based phase index. |
| `executionNumber` | `number` | Execution count (for phase replays). |
| `timestamp` | `string` | ISO timestamp of execution. |
| `success` | `boolean` | Execution success status. |
| `executionTime` | `number` | Execution time in milliseconds. |
| `decision` | `PhaseExecutionDecision` | Decision made during this execution. |

---

#### BranchExecutionResult

Complete result for a branch execution in branch-based workflows.

```typescript
interface BranchExecutionResult<ResponseDataType = any> {
  workflowId: string;
  branchId: string;
  branchIndex: number;
  success: boolean;
  executionTime: number;
  completedPhases: number;
  phaseResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
  decision?: BranchExecutionDecision;
  executionNumber: number;
  skipped?: boolean;
  error?: string;
  metrics?: BranchMetrics;
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `workflowId` | `string` | Parent workflow identifier. |
| `branchId` | `string` | Unique branch identifier. |
| `branchIndex` | `number` | Zero-based branch index. |
| `success` | `boolean` | Whether all phases in branch succeeded. |
| `executionTime` | `number` | Total branch execution time in milliseconds. |
| `completedPhases` | `number` | Number of phases completed in this branch. |
| `phaseResults` | `STABLE_WORKFLOW_PHASE_RESULT[]` | Results for each phase in the branch. |
| `decision` | `BranchExecutionDecision` | Decision made by branch. |
| `executionNumber` | `number` | Execution count (for branch replays). |
| `skipped` | `boolean` | Whether this branch was skipped. |
| `error` | `string` | Error message if branch failed. |
| `metrics` | `BranchMetrics` | Computed branch-level metrics. |

---

#### BranchExecutionRecord

Execution history record for branch tracking.

```typescript
interface BranchExecutionRecord {
  branchId: string;
  branchIndex: number;
  executionNumber: number;
  timestamp: string;
  success: boolean;
  executionTime: number;
  decision?: BranchExecutionDecision;
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `branchId` | `string` | Branch identifier. |
| `branchIndex` | `number` | Zero-based branch index. |
| `executionNumber` | `number` | Execution count (for branch replays). |
| `timestamp` | `string` | ISO timestamp of execution. |
| `success` | `boolean` | Execution success status. |
| `executionTime` | `number` | Execution time in milliseconds. |
| `decision` | `BranchExecutionDecision` | Decision made during this execution. |

---

### Configuration Types

#### `RateLimitConfig`

```typescript
interface RateLimitConfig {
  maxRequests: number;  // Maximum requests allowed
  windowMs: number;     // Time window in milliseconds
}
```

#### `CircuitBreakerConfig`

See [CircuitBreaker constructor parameters](#constructor-parameters).

#### `CacheConfig`

See [CacheManager constructor parameters](#constructor-parameters-3).

#### `RequestGroup`

```typescript
interface RequestGroup<RequestDataType = any, ResponseDataType = any> {
  id: string;
  commonConfig?: Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, "concurrentExecution" | "stopOnFirstError" | "requestGroups" | "maxConcurrentRequests" | "rateLimit" | "circuitBreaker">;
}
```

Configuration for a group of requests with shared settings.

#### `TRIAL_MODE_OPTIONS`

```typescript
interface TRIAL_MODE_OPTIONS {
  enabled: boolean;
  reqFailureProbability?: number;    // 0-1, probability of initial failure
  retryFailureProbability?: number;  // 0-1, probability of retry failure
}
```

#### `ExecutionContext`

```typescript
interface ExecutionContext {
  workflowId?: string;   // Workflow identifier
  branchId?: string;     // Branch identifier (if executing within a branch)
  phaseId?: string;      // Phase identifier (if executing within a phase)
  requestId?: string;    // Request identifier (if executing a specific request)
}
```

Execution context information passed through the request chain. Used for logging and traceability. All fields are optional and populated based on execution level.

#### `RequestPreExecutionOptions`

Configuration for pre-execution hooks that run before request execution.

```typescript
interface RequestPreExecutionOptions {
  preExecutionHook: (options: PreExecutionHookOptions) => any | Promise<any>;
  preExecutionHookParams?: any;
  applyPreExecutionConfigOverride?: boolean;
  continueOnPreExecutionHookFailure?: boolean;
}
```

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `preExecutionHook` | `(options: PreExecutionHookOptions) => any \| Promise<any>` | Yes | - | Hook function executed before the request. Can modify request configuration dynamically. |
| `preExecutionHookParams` | `any` | No | `undefined` | Custom parameters passed to the pre-execution hook. |
| `applyPreExecutionConfigOverride` | `boolean` | No | `false` | If `true`, applies configuration returned by hook to override request settings. |
| `continueOnPreExecutionHookFailure` | `boolean` | No | `false` | If `true`, continues execution even if pre-execution hook fails. |

---

### State Persistence Types

State persistence enables workflows to save and restore their state to external storage systems (databases, Redis, file systems). This is crucial for workflow recovery, distributed execution, and audit trails.

#### `StatePersistenceConfig`

Configuration for state persistence behavior.

```typescript
interface StatePersistenceConfig {
  persistenceFunction: (options: StatePersistenceOptions) => Promise<Record<string, any>> | Record<string, any>;
  persistenceParams?: any;
  loadBeforeHooks?: boolean;
  storeAfterHooks?: boolean;
}
```

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `persistenceFunction` | `(options: StatePersistenceOptions) => Promise<Record<string, any>> \| Record<string, any>` | Yes | - | Function to handle state loading and storing. Should return state object when loading, or void/Promise<void> when storing. |
| `persistenceParams` | `any` | No | `undefined` | Custom parameters passed to the persistence function (e.g., database connection, Redis client). |
| `loadBeforeHooks` | `boolean` | No | `false` | If `true`, loads state from persistence before executing hooks/phases. |
| `storeAfterHooks` | `boolean` | No | `false` | If `true`, stores state to persistence after executing hooks/phases. |

**Persistence Function Behavior:**
- **Loading Mode:** Called with `buffer` as empty object `{}`. Should return the loaded state as `Record<string, any>`.
- **Storing Mode:** Called with populated `buffer` containing current state. Should store the buffer and return void.

#### `StatePersistenceOptions`

Options passed to the persistence function.

```typescript
interface StatePersistenceOptions {
  executionContext: ExecutionContext;
  params?: any;
  buffer: Record<string, any>;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `executionContext` | `ExecutionContext` | Contains `workflowId`, `phaseId`, `branchId`, `requestId` for creating unique state keys. |
| `params` | `any` | Custom parameters from `persistenceParams` config (e.g., `{ db, collection }`). |
| `buffer` | `Record<string, any>` | The shared buffer/state to be persisted or populated with loaded state. |

#### Usage Levels

State persistence can be configured at multiple levels:

1. **Workflow Level:** `commonStatePersistence` in `STABLE_WORKFLOW_OPTIONS`
2. **Phase Level:** `statePersistence` in `STABLE_WORKFLOW_PHASE`
3. **Branch Level:** `statePersistence` in `STABLE_WORKFLOW_BRANCH`
4. **Request Level:** `statePersistence` in `STABLE_REQUEST`

**Example - Database Persistence:**

```typescript
import { stableWorkflow } from '@emmvish/stable-request';

const persistToMongo = async ({ executionContext, params, buffer }) => {
  const { workflowId, phaseId } = executionContext;
  const { db, collection } = params;
  
  const query = { workflowId, phaseId };
  
  if (Object.keys(buffer).length > 0) {
    // Store mode
    await db.collection(collection).updateOne(
      query,
      { $set: { state: buffer, updatedAt: new Date() } },
      { upsert: true }
    );
    console.log(`State persisted for workflow ${workflowId}, phase ${phaseId}`);
  } else {
    // Load mode
    const doc = await db.collection(collection).findOne(query);
    return doc?.state || {};
  }
};

const result = await stableWorkflow(phases, {
  workflowId: 'data-pipeline-123',
  commonStatePersistence: {
    persistenceFunction: persistToMongo,
    persistenceParams: { 
      db: mongoClient.db('workflows'),
      collection: 'workflow_state'
    },
    loadBeforeHooks: true,
    storeAfterHooks: true
  },
  sharedBuffer: {}
});
```

**Example - Redis Persistence:**

```typescript
import Redis from 'ioredis';

const redis = new Redis();

const persistToRedis = async ({ executionContext, params, buffer }) => {
  const { workflowId, phaseId, branchId } = executionContext;
  const { ttl = 86400 } = params; // 24 hours default
  
  const key = `workflow:${workflowId}:${branchId || 'main'}:${phaseId || 'global'}`;
  
  if (Object.keys(buffer).length > 0) {
    // Store with TTL
    await redis.setex(key, ttl, JSON.stringify(buffer));
  } else {
    // Load
    const data = await redis.get(key);
    return data ? JSON.parse(data) : {};
  }
};

const phases = [
  {
    id: 'data-processing',
    requests: [...],
    statePersistence: {
      persistenceFunction: persistToRedis,
      persistenceParams: { ttl: 3600 },
      loadBeforeHooks: true,
      storeAfterHooks: true
    }
  }
];
```

**Example - File System Persistence:**

```typescript
import fs from 'fs/promises';
import path from 'path';

const persistToFile = async ({ executionContext, params, buffer }) => {
  const { workflowId, phaseId } = executionContext;
  const { directory = './workflow-state' } = params;
  
  await fs.mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${workflowId}-${phaseId}.json`);
  
  if (Object.keys(buffer).length > 0) {
    // Store
    await fs.writeFile(filePath, JSON.stringify(buffer, null, 2));
  } else {
    // Load
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {}; // File doesn't exist yet
    }
  }
};
```

---

### Hook Option Types

#### `ResponseAnalysisHookOptions`

Options passed to the `responseAnalyzer` hook function. This interface extends from base hook options and includes all inherited properties.

```typescript
interface ResponseAnalysisHookOptions<RequestDataType = any, ResponseDataType = any> {
  data: ResponseDataType;
  reqData: AxiosRequestConfig<RequestDataType>;
  params?: any;
  trialMode?: TRIAL_MODE_OPTIONS;
  preExecutionResult?: any;
  executionContext?: ExecutionContext;
  commonBuffer?: Record<string, any>;
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `data` | `ResponseDataType` | Response data returned from the request. |
| `reqData` | `AxiosRequestConfig<RequestDataType>` | Axios request configuration. |
| `params` | `any` | Custom parameters from `hookParams.responseAnalyzerParams`. |
| `trialMode` | `TRIAL_MODE_OPTIONS` | Trial mode configuration (if enabled). |
| `preExecutionResult` | `any` | Result from pre-execution hook (if used). |
| `executionContext` | `ExecutionContext` | Execution context (workflowId, phaseId, etc.). |
| `commonBuffer` | `Record<string, any>` | Shared buffer for state management. |

#### `FinalErrorAnalysisHookOptions`

Options passed to the `finalErrorAnalyzer` hook function after all retry attempts are exhausted.

```typescript
interface FinalErrorAnalysisHookOptions<RequestDataType = any> {
  // Own properties
  error: any;
  
  // Inherited from AnalysisHookOptions and ObservabilityHooksOptions
  reqData: AxiosRequestConfig<RequestDataType>;
  params?: any;
  trialMode?: TRIAL_MODE_OPTIONS;
  preExecutionResult?: any;
  executionContext?: ExecutionContext;
  commonBuffer?: Record<string, any>;
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `error` | `any` | The final error after all retry attempts failed. |
| `reqData` | `AxiosRequestConfig<RequestDataType>` | Axios request configuration. |
| `params` | `any` | Custom parameters from `hookParams.finalErrorAnalyzerParams`. |
| `trialMode` | `TRIAL_MODE_OPTIONS` | Trial mode configuration (if enabled). |
| `preExecutionResult` | `any` | Result from pre-execution hook (if used). |
| `executionContext` | `ExecutionContext` | Execution context (workflowId, phaseId, etc.). |
| `commonBuffer` | `Record<string, any>` | Shared buffer for state management. |

#### `HandleErrorHookOptions`

Options passed to the `handleErrors` hook function for each failed attempt.

```typescript
interface HandleErrorHookOptions<RequestDataType = any> {
  errorLog: ERROR_LOG;
  reqData: AxiosRequestConfig<RequestDataType>;
  params?: any;
  maxSerializableChars?: number;
  preExecutionResult?: any;
  executionContext?: ExecutionContext;
  commonBuffer?: Record<string, any>;
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|  
| `errorLog` | `ERROR_LOG` | Structured error log with timestamp, attempt number, error message, etc. |
| `reqData` | `AxiosRequestConfig<RequestDataType>` | Axios request configuration. |
| `params` | `any` | Custom parameters from `hookParams.handleErrorsParams`. |
| `maxSerializableChars` | `number` | Maximum characters for serialization in logs. |
| `preExecutionResult` | `any` | Result from pre-execution hook (if used). |
| `executionContext` | `ExecutionContext` | Execution context (workflowId, phaseId, etc.). |
| `commonBuffer` | `Record<string, any>` | Shared buffer for state management. |

#### `HandleSuccessfulAttemptDataHookOptions`

Options passed to the `handleSuccessfulAttemptData` hook function for each successful attempt.

```typescript
interface HandleSuccessfulAttemptDataHookOptions<RequestDataType = any, ResponseDataType = any> {
  successfulAttemptData: SUCCESSFUL_ATTEMPT_DATA<ResponseDataType>;
  reqData: AxiosRequestConfig<RequestDataType>;
  params?: any;
  maxSerializableChars?: number;
  preExecutionResult?: any;
  executionContext?: ExecutionContext;
  commonBuffer?: Record<string, any>;
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `successfulAttemptData` | `SUCCESSFUL_ATTEMPT_DATA<ResponseDataType>` | Structured success log with attempt number, timestamp, data, etc. |
| `reqData` | `AxiosRequestConfig<RequestDataType>` | Axios request configuration. |
| `params` | `any` | Custom parameters from `hookParams.handleSuccessfulAttemptDataParams`. |
| `maxSerializableChars` | `number` | Maximum characters for serialization in logs. |
| `preExecutionResult` | `any` | Result from pre-execution hook (if used). |
| `executionContext` | `ExecutionContext` | Execution context (workflowId, phaseId, etc.). |
| `commonBuffer` | `Record<string, any>` | Shared buffer for state management. |

#### `PreExecutionHookOptions`

```typescript
interface PreExecutionHookOptions<RequestDataType = any, ResponseDataType = any> {
  inputParams?: any;
  commonBuffer?: Record<string, any>;
  stableRequestOptions: STABLE_REQUEST<RequestDataType, ResponseDataType>;
}
```

#### `HandlePhaseCompletionHookOptions`

```typescript
interface HandlePhaseCompletionHookOptions<ResponseDataType = any> {
  workflowId: string;
  branchId?: string;  // Present if phase executed within a branch
  phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>;
  maxSerializableChars?: number;
  params?: any;
  sharedBuffer?: Record<string, any>;
}
```

#### `HandlePhaseErrorHookOptions`

Extends `HandlePhaseCompletionHookOptions` with additional `error` property.

#### `HandleBranchCompletionHookOptions`

Options passed to the `handleBranchCompletion` hook function when a branch completes execution.

```typescript
interface HandleBranchCompletionHookOptions<ResponseDataType = any> {
  workflowId: string;
  branchId: string;
  branchResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
  success: boolean;
  maxSerializableChars?: number;
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `workflowId` | `string` | Unique identifier of the workflow. |
| `branchId` | `string` | Unique identifier of the completed branch. |
| `branchResults` | `STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[]` | Array of phase results from this branch execution. |
| `success` | `boolean` | Whether the branch completed successfully. |
| `maxSerializableChars` | `number` | Maximum characters for serialization in logs. |

#### `HandlePhaseDecisionHookOptions`

Options passed to the `handlePhaseDecision` hook function when a phase makes a non-linear execution decision.

```typescript
interface HandlePhaseDecisionHookOptions<ResponseDataType = any> {
  decision: PhaseExecutionDecision;
  phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>;
  maxSerializableChars?: number;
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `decision` | `PhaseExecutionDecision` | The decision made by the phase (CONTINUE, JUMP, SKIP, REPLAY, TERMINATE). |
| `phaseResult` | `STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>` | The complete result of the phase that made the decision. |
| `maxSerializableChars` | `number` | Maximum characters for serialization in logs. |

#### `PhaseDecisionHookOptions`

```typescript
interface PhaseDecisionHookOptions<ResponseDataType = any> {
  workflowId: string;
  branchId?: string;  // Present if phase executed within a branch
  phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>;
  phaseId: string;
  phaseIndex: number;
  executionHistory: PhaseExecutionRecord[];
  sharedBuffer?: Record<string, any>;
  params?: any;
  concurrentPhaseResults?: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
}
```

#### `BranchDecisionHookOptions`

```typescript
interface BranchDecisionHookOptions<ResponseDataType = any> {
  workflowId: string;
  branchResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
  branchId: string;
  branchIndex: number;
  executionNumber: number;
  executionHistory: PhaseExecutionRecord[];
  branchExecutionHistory: BranchExecutionRecord[];
  sharedBuffer?: Record<string, any>;
  params?: any;
  concurrentBranchResults?: BranchExecutionResult<ResponseDataType>[];
}
```

#### `HookParams`

Custom parameters passed to request-level hook functions.

```typescript
interface HookParams {
  responseAnalyzerParams?: any;
  handleSuccessfulAttemptDataParams?: any;
  handleErrorsParams?: any;
  finalErrorAnalyzerParams?: any;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `responseAnalyzerParams` | `any` | Custom parameters passed to `responseAnalyzer` hook. |
| `handleSuccessfulAttemptDataParams` | `any` | Custom parameters passed to `handleSuccessfulAttemptData` hook. |
| `handleErrorsParams` | `any` | Custom parameters passed to `handleErrors` hook. |
| `finalErrorAnalyzerParams` | `any` | Custom parameters passed to `finalErrorAnalyzer` hook. |

#### `WorkflowHookParams`

Custom parameters passed to workflow-level hook functions.

```typescript
interface WorkflowHookParams {
  handlePhaseCompletionParams?: any;
  handlePhaseErrorParams?: any;
  handlePhaseDecisionParams?: any;
  handleBranchDecisionParams?: any;
  statePersistence?: StatePersistenceConfig;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `handlePhaseCompletionParams` | `any` | Custom parameters passed to `handlePhaseCompletion` hook. |
| `handlePhaseErrorParams` | `any` | Custom parameters passed to `handlePhaseError` hook. |
| `handlePhaseDecisionParams` | `any` | Custom parameters passed to `handlePhaseDecision` hook. |
| `handleBranchDecisionParams` | `any` | Custom parameters passed to `handleBranchDecision` hook. |
| `statePersistence` | `StatePersistenceConfig` | State persistence configuration for workflow hooks. |

---

### Decision Types

#### `PhaseExecutionDecision`

```typescript
interface PhaseExecutionDecision {
  action: PHASE_DECISION_ACTIONS;
  targetPhaseId?: string;      // Required for JUMP and SKIP actions
  replayCount?: number;
  metadata?: Record<string, any>;
}
```

#### `BranchExecutionDecision`

```typescript
interface BranchExecutionDecision {
  action: PHASE_DECISION_ACTIONS;
  targetBranchId?: string;     // Required for JUMP action
  metadata?: Record<string, any>;
}
```

---

## Enums

### REQUEST_METHODS

```typescript
enum REQUEST_METHODS {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE'
}
```

### RETRY_STRATEGIES

```typescript
enum RETRY_STRATEGIES {
  FIXED = 'FIXED',         // Constant wait time
  LINEAR = 'LINEAR',       // Linearly increasing: wait * attempt
  EXPONENTIAL = 'EXPONENTIAL' // Exponentially increasing: wait * (2 ^ attempt)
}
```

### PHASE_DECISION_ACTIONS

```typescript
enum PHASE_DECISION_ACTIONS {
  CONTINUE = 'CONTINUE',   // Proceed to next phase
  JUMP = 'JUMP',          // Jump to specific phase
  SKIP = 'SKIP',          // Skip to specific phase or end
  REPLAY = 'REPLAY',      // Re-execute current phase
  TERMINATE = 'TERMINATE' // Stop workflow immediately
}
```

### CircuitBreakerState

```typescript
enum CircuitBreakerState {
  CLOSED = 'CLOSED',       // Normal operation
  OPEN = 'OPEN',          // Failing, blocking requests
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}
```

### VALID_REQUEST_PROTOCOLS

```typescript
enum VALID_REQUEST_PROTOCOLS {
  HTTP = 'http',
  HTTPS = 'https'
}
```

### RESPONSE_ERRORS

```typescript
enum RESPONSE_ERRORS {
  HTTP_ERROR = 'HTTP_ERROR',
  INVALID_CONTENT = 'INVALID_CONTENT'
}
```

---

## Utility Functions

### Global Cache Management

```typescript
import { 
  getGlobalCacheManager, 
  resetGlobalCacheManager 
} from '@emmvish/stable-request';

// Get the global cache manager instance
const cacheManager = getGlobalCacheManager();

// Reset the global cache (creates new instance)
resetGlobalCacheManager();
```

**`getGlobalCacheManager()`**

Returns the global `CacheManager` instance shared across all `stableRequest` calls.

**`resetGlobalCacheManager()`**

Resets the global cache manager by creating a new instance, clearing all cached data.

---

### Global Circuit Breaker Management

```typescript
import { 
  getGlobalCircuitBreaker, 
  resetGlobalCircuitBreaker 
} from '@emmvish/stable-request';

// Get the global circuit breaker instance
const circuitBreaker = getGlobalCircuitBreaker();

// Check circuit breaker state
const state = circuitBreaker.getState();
console.log(`Circuit state: ${state.state}`);
console.log(`Failure rate: ${state.failureRate}%`);

// Reset the global circuit breaker (creates new instance with default config)
resetGlobalCircuitBreaker();
```

**`getGlobalCircuitBreaker()`**

Returns the global `CircuitBreaker` instance shared across all `stableRequest` calls when no specific circuit breaker is configured.

**`resetGlobalCircuitBreaker()`**

Resets the global circuit breaker by creating a new instance with default configuration, clearing all state and statistics.

---

### Global Rate Limiter Management

```typescript
import { 
  getGlobalRateLimiter, 
  resetGlobalRateLimiter 
} from '@emmvish/stable-request';

// Get the global rate limiter instance
const rateLimiter = getGlobalRateLimiter();

// Check rate limiter state
const state = rateLimiter.getState();
console.log(`Available tokens: ${state.availableTokens}`);
console.log(`Queue length: ${state.queueLength}`);

// Reset the global rate limiter (creates new instance with default config)
resetGlobalRateLimiter();
```

**`getGlobalRateLimiter()`**

Returns the global `RateLimiter` instance shared across all `stableApiGateway` and `stableWorkflow` calls when no specific rate limiter is configured.

**`resetGlobalRateLimiter()`**

Resets the global rate limiter by creating a new instance with default configuration, clearing all queues and state.

---

### Global Concurrency Limiter Management

```typescript
import { 
  getGlobalConcurrencyLimiter, 
  resetGlobalConcurrencyLimiter 
} from '@emmvish/stable-request';

// Get the global concurrency limiter instance
const concurrencyLimiter = getGlobalConcurrencyLimiter();

// Check how many operations are currently running
const running = concurrencyLimiter.running;
const limit = concurrencyLimiter.limit;
console.log(`Running: ${running}/${limit}`);

// Reset the global concurrency limiter (creates new instance with default config)
resetGlobalConcurrencyLimiter();
```

**`getGlobalConcurrencyLimiter()`**

Returns the global `ConcurrencyLimiter` instance shared across all `stableApiGateway` and `stableWorkflow` calls when no specific concurrency limiter is configured.

**`resetGlobalConcurrencyLimiter()`**

Resets the global concurrency limiter by creating a new instance with default configuration, clearing all queues and state.

---

## Metrics and Observability Types

Comprehensive type definitions for metrics collected at all execution levels, from individual requests to complete workflows.

---

### Request-Level Metrics

#### `STABLE_REQUEST_RESULT`

Result object returned by `stableRequest` with comprehensive metrics.

```typescript
interface STABLE_REQUEST_RESULT<ResponseDataType = any> {
  success: boolean;
  data?: ResponseDataType;
  error?: string;
  errorLogs?: ERROR_LOG[];
  successfulAttempts?: SUCCESSFUL_ATTEMPT_DATA<ResponseDataType>[];
  metrics?: {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    totalExecutionTime: number;
    averageAttemptTime: number;
    infrastructureMetrics?: {
      circuitBreaker?: CircuitBreakerDashboardMetrics;
      cache?: CacheDashboardMetrics;
    };
  };
}
```

| Property | Type | Description |
|----------|------|-------------|
| `success` | `boolean` | `true` if request succeeded, `false` if failed. |
| `data` | `ResponseDataType` | Response data (when `resReq: true` and successful). |
| `error` | `string` | Error message (when request failed). |
| `errorLogs` | `ERROR_LOG[]` | Array of all failed attempt details. |
| `successfulAttempts` | `SUCCESSFUL_ATTEMPT_DATA[]` | Array of all successful attempt details. |
| `metrics.totalAttempts` | `number` | Total number of attempts made. |
| `metrics.successfulAttempts` | `number` | Number of successful attempts. |
| `metrics.failedAttempts` | `number` | Number of failed attempts. |
| `metrics.totalExecutionTime` | `number` | Total execution time in milliseconds. |
| `metrics.averageAttemptTime` | `number` | Average time per attempt in milliseconds. |
| `metrics.infrastructureMetrics` | `object` | Circuit breaker and cache metrics (if used). |

---

### `ERROR_LOG`

Details about a failed attempt.

```typescript
interface ERROR_LOG {
  timestamp: string;
  executionTime: number;
  statusCode: number;
  attempt: string;
  error: string;
  type: RESPONSE_ERROR_TYPES;
  isRetryable: boolean;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `timestamp` | `string` | ISO timestamp when error occurred. |
| `executionTime` | `number` | Attempt execution time in milliseconds. |
| `statusCode` | `number` | HTTP status code. |
| `attempt` | `string` | Attempt identifier (e.g., "2/5"). |
| `error` | `string` | Error message. |
| `type` | `RESPONSE_ERROR_TYPES` | Error type: "HTTP_ERROR" or "INVALID_CONTENT". |
| `isRetryable` | `boolean` | Whether the error is retryable. |

---

### `SUCCESSFUL_ATTEMPT_DATA`

Details about a successful attempt.

```typescript
interface SUCCESSFUL_ATTEMPT_DATA<ResponseDataType = any> {
  attempt: string;
  timestamp: string;
  executionTime: number;
  data: ResponseDataType;
  statusCode: number;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `attempt` | `string` | Attempt identifier (e.g., "3/5"). |
| `timestamp` | `string` | ISO timestamp when attempt succeeded. |
| `executionTime` | `number` | Attempt execution time in milliseconds. |
| `data` | `ResponseDataType` | Response data. |
| `statusCode` | `number` | HTTP status code. |

---

### Workflow-Level Metrics

#### `WorkflowMetrics`

Comprehensive metrics for complete workflow execution, including phase statistics, request aggregates, and performance indicators.

```typescript
interface WorkflowMetrics {
  workflowId: string;
  success: boolean;
  executionTime: number;
  timestamp: string;
  totalPhases: number;
  completedPhases: number;
  skippedPhases: number;
  failedPhases: number;
  phaseCompletionRate: number;
  averagePhaseExecutionTime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestSuccessRate: number;
  requestFailureRate: number;
  terminatedEarly: boolean;
  terminationReason?: string;
  totalPhaseReplays: number;
  totalPhaseSkips: number;
  totalBranches?: number;
  completedBranches?: number;
  failedBranches?: number;
  branchSuccessRate?: number;
  throughput: number;
  averageRequestDuration?: number;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `workflowId` | `string` | Workflow identifier. |
| `success` | `boolean` | Whether workflow completed successfully. |
| `executionTime` | `number` | Total execution time in milliseconds. |
| `timestamp` | `string` | ISO timestamp when workflow started. |
| `totalPhases` | `number` | Total number of phases. |
| `completedPhases` | `number` | Number of completed phases. |
| `skippedPhases` | `number` | Number of skipped phases. |
| `failedPhases` | `number` | Number of failed phases. |
| `phaseCompletionRate` | `number` | Percentage of phases completed (0-100). |
| `averagePhaseExecutionTime` | `number` | Average phase execution time in milliseconds. |
| `totalRequests` | `number` | Total number of requests. |
| `successfulRequests` | `number` | Number of successful requests. |
| `failedRequests` | `number` | Number of failed requests. |
| `requestSuccessRate` | `number` | Request success rate percentage (0-100). |
| `requestFailureRate` | `number` | Request failure rate percentage (0-100). |
| `throughput` | `number` | Requests per second. |
| `terminatedEarly` | `boolean` | Whether workflow terminated early. |
| `terminationReason` | `string` | Reason for early termination (if applicable). |
| `totalPhaseReplays` | `number` | Total number of phase replays. |
| `totalPhaseSkips` | `number` | Total number of phase skips. |
| `totalBranches` | `number` | Total branches (if branch execution enabled). |
| `completedBranches` | `number` | Completed branches (if branch execution enabled). |
| `failedBranches` | `number` | Failed branches (if branch execution enabled). |
| `branchSuccessRate` | `number` | Branch success rate percentage (if applicable). |
| `averageRequestDuration` | `number` | Average request duration in milliseconds. |

---

### `BranchMetrics`

Metrics for individual branch execution.

```typescript
interface BranchMetrics {
  branchId: string;
  branchIndex: number;
  executionNumber: number;
  success: boolean;
  executionTime: number;
  skipped: boolean;
  totalPhases: number;
  completedPhases: number;
  failedPhases: number;
  phaseCompletionRate: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestSuccessRate: number;
  hasDecision: boolean;
  decisionAction?: string;
  error?: string;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `branchId` | `string` | Branch identifier. |
| `branchIndex` | `number` | Zero-based branch index. |
| `executionNumber` | `number` | Execution number (for replays). |
| `success` | `boolean` | Whether branch completed successfully. |
| `executionTime` | `number` | Branch execution time in milliseconds. |
| `skipped` | `boolean` | Whether branch was skipped. |
| `totalPhases` | `number` | Total phases in branch. |
| `completedPhases` | `number` | Completed phases in branch. |
| `failedPhases` | `number` | Failed phases in branch. |
| `phaseCompletionRate` | `number` | Phase completion rate percentage (0-100). |
| `totalRequests` | `number` | Total requests in branch. |
| `successfulRequests` | `number` | Successful requests in branch. |
| `failedRequests` | `number` | Failed requests in branch. |
| `requestSuccessRate` | `number` | Request success rate percentage (0-100). |
| `hasDecision` | `boolean` | Whether branch made a decision. |
| `decisionAction` | `string` | Decision action taken (if any). |
| `error` | `string` | Error message (if branch failed). |

---

### `PhaseMetrics`

Metrics for individual phase execution.

```typescript
interface PhaseMetrics {
  phaseId: string;
  phaseIndex: number;
  workflowId: string;
  branchId?: string;
  executionNumber: number;
  success: boolean;
  skipped: boolean;
  executionTime: number;
  timestamp: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestSuccessRate: number;
  requestFailureRate: number;
  hasDecision: boolean;
  decisionAction?: string;
  targetPhaseId?: string;
  replayCount?: number;
  error?: string;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `phaseId` | `string` | Phase identifier. |
| `phaseIndex` | `number` | Zero-based phase index. |
| `workflowId` | `string` | Parent workflow identifier. |
| `branchId` | `string` | Parent branch identifier (if applicable). |
| `executionNumber` | `number` | Execution number (for replays). |
| `success` | `boolean` | Whether phase completed successfully. |
| `skipped` | `boolean` | Whether phase was skipped. |
| `executionTime` | `number` | Phase execution time in milliseconds. |
| `timestamp` | `string` | ISO timestamp when phase started. |
| `totalRequests` | `number` | Total requests in phase. |
| `successfulRequests` | `number` | Successful requests in phase. |
| `failedRequests` | `number` | Failed requests in phase. |
| `requestSuccessRate` | `number` | Request success rate percentage (0-100). |
| `requestFailureRate` | `number` | Request failure rate percentage (0-100). |
| `hasDecision` | `boolean` | Whether phase made a decision. |
| `decisionAction` | `string` | Decision action taken (if any). |
| `targetPhaseId` | `string` | Target phase ID (for JUMP/SKIP). |
| `replayCount` | `number` | Number of times phase was replayed. |
| `error` | `string` | Error message (if phase failed). |

---

### `RequestGroupMetrics`

Metrics for a group of related requests.

```typescript
interface RequestGroupMetrics {
  groupId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  failureRate: number;
  requestIds: string[];
}
```

| Property | Type | Description |
|----------|------|-------------|
| `groupId` | `string` | Group identifier. |
| `totalRequests` | `number` | Total requests in group. |
| `successfulRequests` | `number` | Successful requests in group. |
| `failedRequests` | `number` | Failed requests in group. |
| `successRate` | `number` | Success rate percentage (0-100). |
| `failureRate` | `number` | Failure rate percentage (0-100). |
| `requestIds` | `string[]` | Array of request IDs in this group. |

---

### `RequestMetrics`

Metrics for an individual request.

```typescript
interface RequestMetrics {
  requestId: string;
  groupId?: string;
  success: boolean;
  hasError: boolean;
  errorMessage?: string;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `requestId` | `string` | Request identifier. |
| `groupId` | `string` | Group identifier (if request belongs to a group). |
| `success` | `boolean` | Whether request succeeded. |
| `hasError` | `boolean` | Whether request encountered an error. |
| `errorMessage` | `string` | Error message (if request failed). |

---

### Infrastructure Metrics

Metrics for infrastructure components (circuit breakers, caches, rate limiters, concurrency limiters).

#### `CircuitBreakerDashboardMetrics`

Comprehensive circuit breaker statistics including state tracking, failure rates, and recovery metrics.

```typescript
interface CircuitBreakerDashboardMetrics {
  state: string;
  isHealthy: boolean;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  failurePercentage: number;
  stateTransitions: number;
  lastStateChangeTime: number;
  timeSinceLastStateChange: number;
  openCount: number;
  totalOpenDuration: number;
  averageOpenDuration: number;
  isCurrentlyOpen: boolean;
  openUntil: number | null;
  timeUntilRecovery: number | null;
  recoveryAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  recoverySuccessRate: number;
  config: {
    failureThresholdPercentage: number;
    minimumRequests: number;
    recoveryTimeoutMs: number;
    successThresholdPercentage: number;
    halfOpenMaxRequests: number;
  };
}
```

| Property | Type | Description |
|----------|------|-------------|
| `state` | `string` | Current circuit state: "CLOSED", "OPEN", or "HALF_OPEN". |
| `isHealthy` | `boolean` | Whether circuit is in healthy state (CLOSED). |
| `totalRequests` | `number` | Total requests processed. |
| `successfulRequests` | `number` | Number of successful requests. |
| `failedRequests` | `number` | Number of failed requests. |
| `failurePercentage` | `number` | Current failure rate percentage (0-100). |
| `stateTransitions` | `number` | Total number of state changes. |
| `lastStateChangeTime` | `number` | Unix timestamp of last state change. |
| `timeSinceLastStateChange` | `number` | Milliseconds since last state change. |
| `openCount` | `number` | Number of times circuit has opened. |
| `totalOpenDuration` | `number` | Total time spent in OPEN state (ms). |
| `averageOpenDuration` | `number` | Average duration per OPEN state (ms). |
| `isCurrentlyOpen` | `boolean` | Whether circuit is currently open. |
| `openUntil` | `number \| null` | Unix timestamp when circuit will close, or null. |
| `timeUntilRecovery` | `number \| null` | Milliseconds until recovery attempt, or null. |
| `recoveryAttempts` | `number` | Total recovery attempts made. |
| `successfulRecoveries` | `number` | Successful recoveries (OPEN → HALF_OPEN → CLOSED). |
| `failedRecoveries` | `number` | Failed recovery attempts. |
| `recoverySuccessRate` | `number` | Recovery success rate percentage (0-100). |
| `config` | `object` | Circuit breaker configuration settings. |

---

### `CacheDashboardMetrics`

Comprehensive cache statistics.

```typescript
interface CacheDashboardMetrics {
  isEnabled: boolean;
  currentSize: number;
  maxSize: number;
  validEntries: number;
  expiredEntries: number;
  utilizationPercentage: number;
  totalRequests: number;
  hits: number;
  misses: number;
  hitRate: number;
  missRate: number;
  sets: number;
  evictions: number;
  expirations: number;
  averageGetTime: number;
  averageSetTime: number;
  averageCacheAge: number;
  oldestEntryAge: number | null;
  newestEntryAge: number | null;
  networkRequestsSaved: number;
  cacheEfficiency: number;
}
```

---

### `RateLimiterDashboardMetrics`

Comprehensive rate limiter statistics.

```typescript
interface RateLimiterDashboardMetrics {
  maxRequests: number;
  windowMs: number;
  availableTokens: number;
  queueLength: number;
  requestsInCurrentWindow: number;
  totalRequests: number;
  completedRequests: number;
  throttledRequests: number;
  throttleRate: number;
  currentRequestRate: number;
  peakRequestRate: number;
  averageRequestRate: number;
  peakQueueLength: number;
  averageQueueWaitTime: number;
  isThrottling: boolean;
  utilizationPercentage: number;
}
```

---

### `ConcurrencyLimiterDashboardMetrics`

Comprehensive concurrency limiter statistics.

```typescript
interface ConcurrencyLimiterDashboardMetrics {
  limit: number;
  running: number;
  queueLength: number;
  utilizationPercentage: number;
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  queuedRequests: number;
  successRate: number;
  peakConcurrency: number;
  averageConcurrency: number;
  concurrencyUtilization: number;
  peakQueueLength: number;
  averageQueueWaitTime: number;
  averageExecutionTime: number;
  isAtCapacity: boolean;
  hasQueuedRequests: boolean;
}
```

---

### `SystemMetrics`

Complete system-wide metrics aggregation.

```typescript
interface SystemMetrics {
  workflow?: WorkflowMetrics;
  branches: BranchMetrics[];
  phases: PhaseMetrics[];
  requestGroups: RequestGroupMetrics[];
  requests: RequestMetrics[];
  circuitBreaker?: CircuitBreakerDashboardMetrics;
  cache?: CacheDashboardMetrics;
  rateLimiter?: RateLimiterDashboardMetrics;
  concurrencyLimiter?: ConcurrencyLimiterDashboardMetrics;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `workflow` | `WorkflowMetrics` | Workflow-level metrics (if applicable). |
| `branches` | `BranchMetrics[]` | Metrics for all branches. |
| `phases` | `PhaseMetrics[]` | Metrics for all phases. |
| `requestGroups` | `RequestGroupMetrics[]` | Metrics for all request groups. |
| `requests` | `RequestMetrics[]` | Metrics for all individual requests. |
| `circuitBreaker` | `CircuitBreakerDashboardMetrics` | Circuit breaker metrics (if used). |
| `cache` | `CacheDashboardMetrics` | Cache metrics (if used). |
| `rateLimiter` | `RateLimiterDashboardMetrics` | Rate limiter metrics (if used). |
| `concurrencyLimiter` | `ConcurrencyLimiterDashboardMetrics` | Concurrency limiter metrics (if used). |

---

## Configuration Priority

Configuration follows a cascading priority system (highest to lowest):

1. **Request-level** - Individual request options
2. **Phase-level** - Phase `commonConfig`
3. **Branch-level** - Branch `commonConfig`
4. **Workflow-level** - Workflow `common*` options
5. **Default values**

Request group configurations are applied at the request level if `groupId` matches.

---

## Notes

- All time values are in milliseconds
- All hooks are async-compatible (can return `Promise`)
- Type parameters `<RequestDataType, ResponseDataType>` are optional and default to `any`
- Most functions support TypeScript generics for type safety
- Shared buffers are mutable objects passed by reference
- Circuit breakers can be shared across multiple requests/workflows
- Cache is global by default but can be customized per request
