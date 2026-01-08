# API Reference

Complete API documentation for `@emmvish/stable-request` `v1.7.1`

## Table of Contents

- [Core Functions](#core-functions)
  - [stableRequest](#stablerequest)
  - [stableApiGateway](#stableapigateway)
  - [stableWorkflow](#stableworkflow)
- [Utility Classes](#utility-classes)
  - [CircuitBreaker](#circuitbreaker)
  - [RateLimiter](#ratelimiter)
  - [ConcurrencyLimiter](#concurrencylimiter)
  - [CacheManager](#cachemanager)
- [Type Definitions](#type-definitions)
  - [REQUEST_DATA](#request_data)
  - [STABLE_REQUEST](#stable_request)
  - [API_GATEWAY_OPTIONS](#api_gateway_options)
  - [API_GATEWAY_REQUEST](#api_gateway_request)
  - [API_GATEWAY_RESPONSE](#api_gateway_response)
  - [STABLE_WORKFLOW_OPTIONS](#stable_workflow_options)
  - [STABLE_WORKFLOW_PHASE](#stable_workflow_phase)
  - [STABLE_WORKFLOW_BRANCH](#stable_workflow_branch)
  - [STABLE_WORKFLOW_RESULT](#stable_workflow_result)
  - [Configuration Types](#configuration-types)
  - [State Persistence Types](#state-persistence-types)
  - [Hook Option Types](#hook-option-types)
  - [Decision Types](#decision-types)
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
): Promise<ResponseDataType | false>
```

#### Parameters

**`options`** (`STABLE_REQUEST<RequestDataType, ResponseDataType>`)

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `reqData` | `REQUEST_DATA<RequestDataType>` | ✅ Yes | - | Request configuration including hostname, path, method, headers, body, etc. |
| `resReq` | `boolean` | No | `false` | If `true`, returns the response data. If `false`, returns `true` on success or `false` on failure. |
| `attempts` | `number` | No | `1` | Maximum number of attempts (including the initial request). Must be ≥ 1. |
| `wait` | `number` | No | `0` | Base wait time in milliseconds between retry attempts. |
| `maxAllowedWait` | `number` | No | `Infinity` | Maximum allowed wait time between retries (caps the backoff calculation). |
| `retryStrategy` | `RETRY_STRATEGY_TYPES` | No | `FIXED` | Retry backoff strategy: `FIXED`, `LINEAR`, or `EXPONENTIAL`. |
| `jitter` | `number` | No | `0` | If `non-zero`, applies randomized jitter to retry delays to prevent thundering herd issues. |
| `performAllAttempts` | `boolean` | No | `false` | If `true`, performs all attempts even if one succeeds (useful for testing). |
| `logAllErrors` | `boolean` | No | `false` | If `true`, logs all error attempts to console. |
| `logAllSuccessfulAttempts` | `boolean` | No | `false` | If `true`, logs all successful attempts to console. |
| `maxSerializableChars` | `number` | No | `500` | Maximum characters to include when serializing objects in logs. |
| `trialMode` | `TRIAL_MODE_OPTIONS` | No | `undefined` | Enables trial mode for testing without making real API calls. |
| `responseAnalyzer` | `Function` | No | `undefined` | Custom function to validate response. Returns `true` if response is acceptable, `false` to retry. |
| `handleErrors` | `Function` | No | `undefined` | Custom error handler called for each failed attempt. |
| `handleSuccessfulAttemptData` | `Function` | No | `undefined` | Custom handler called for each successful attempt. |
| `finalErrorAnalyzer` | `Function` | No | `undefined` | Analyzes the final error after all retries exhausted. Return `true` to suppress error (return `false`), `false` to throw. |
| `hookParams` | `HookParams` | No | `{}` | Custom parameters to pass to hook functions. |
| `preExecution` | `RequestPreExecutionOptions` | No | `undefined` | Pre-execution hook configuration for dynamic request modification. |
| `commonBuffer` | `Record<string, any>` | No | `undefined` | Shared buffer for storing/accessing data across requests. |
| `cache` | `CacheConfig` | No | `undefined` | Response caching configuration. |
| `circuitBreaker` | `CircuitBreakerConfig \| CircuitBreaker` | No | `undefined` | Circuit breaker configuration or instance. |

#### Returns

- **`Promise<ResponseDataType>`** - If `resReq: true`, returns the response data
- **`Promise<false>`** - If `resReq: false` and request fails, returns `false`
- **`Promise<true>`** - If `resReq: false` and request succeeds, returns `true`
- **Throws** - If all retry attempts fail and `finalErrorAnalyzer` doesn't suppress the error

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
| `commonWait` | `number` | No | `0` | Default wait time between retries for all requests. |
| `commonMaxAllowedWait` | `number` | No | `Infinity` | Default maximum wait time for all requests. |
| `commonRetryStrategy` | `RETRY_STRATEGY_TYPES` | No | `FIXED` | Default retry strategy for all requests. |
| `commonJitter` | `number` | No | `0` | Default jitter setting for all requests. Randomizes retry delays. |
| `commonResReq` | `boolean` | No | `false` | Default value for `resReq` for all requests. |
| `commonLogAllErrors` | `boolean` | No | `false` | Default logging setting for errors. |
| `commonLogAllSuccessfulAttempts` | `boolean` | No | `false` | Default logging setting for successes. |
| `commonMaxSerializableChars` | `number` | No | `500` | Default max chars for serialization. |
| `commonPerformAllAttempts` | `boolean` | No | `false` | Default `performAllAttempts` for all requests. |
| `commonTrialMode` | `TRIAL_MODE_OPTIONS` | No | `undefined` | Default trial mode configuration. |
| `commonResponseAnalyzer` | `Function` | No | `undefined` | Default response analyzer for all requests. |
| `commonFinalErrorAnalyzer` | `Function` | No | `undefined` | Default final error analyzer for all requests. |
| `commonHandleErrors` | `Function` | No | `undefined` | Default error handler for all requests. |
| `commonHandleSuccessfulAttemptData` | `Function` | No | `undefined` | Default success handler for all requests. |
| `commonPreExecution` | `RequestPreExecutionOptions` | No | `undefined` | Default pre-execution hook configuration. |
| `commonCache` | `CacheConfig` | No | `undefined` | Default cache configuration for all requests. |
| `commonHookParams` | `HookParams` | No | `{}` | Default parameters for hook functions. |
| `requestGroups` | `RequestGroup[]` | No | `[]` | Array of request group configurations for applying settings to specific groups. |
| `sharedBuffer` | `Record<string, any>` | No | `undefined` | Shared buffer accessible by all requests. |
| `maxConcurrentRequests` | `number` | No | `undefined` | Maximum number of concurrent requests (concurrent mode only). |
| `rateLimit` | `RateLimitConfig` | No | `undefined` | Rate limiting configuration. |
| `circuitBreaker` | `CircuitBreakerConfig` | No | `undefined` | Circuit breaker configuration. |

#### Returns

**`Promise<API_GATEWAY_RESPONSE<ResponseDataType>[]>`**

Array of response objects, one per request. See [API_GATEWAY_RESPONSE](#api_gateway_response).

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
| `handlePhaseCompletion` | `Function` | No | `console.log` | Hook called after each phase completes successfully. |
| `handlePhaseError` | `Function` | No | `console.log` | Hook called when a phase encounters an error. |
| `handlePhaseDecision` | `Function` | No | `() => {}` | Hook called when a phase makes a non-linear decision. |
| `handleBranchCompletion` | `Function` | No | `console.log` | Hook called when a branch completes. |
| `handleBranchDecision` | `Function` | No | `undefined` | Hook called when a branch makes a decision. |
| `workflowHookParams` | `WorkflowHookParams` | No | `{}` | Custom parameters passed to workflow-level hooks. |
| `sharedBuffer` | `Record<string, any>` | No | `{}` | Shared buffer accessible across all phases and branches. |
| `maxSerializableChars` | `number` | No | `500` | Maximum characters for serialization in logs. |
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
| `failureThresholdPercentage` | `number` | ✅ Yes | - | Percentage of failures (0-100) that triggers OPEN state. |
| `minimumRequests` | `number` | ✅ Yes | - | Minimum number of requests before evaluating failure threshold. |
| `recoveryTimeoutMs` | `number` | ✅ Yes | - | Time in milliseconds to wait in OPEN state before transitioning to HALF_OPEN. |
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
| `maxRequests` | `number` | ✅ Yes | Maximum number of requests allowed in the time window. |
| `windowMs` | `number` | ✅ Yes | Time window in milliseconds. |

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
| `limit` | `number` | ✅ Yes | Maximum number of concurrent operations. Must be ≥ 1. |

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
const limiter = new ConcurrencyLimiter(3);
const results = await limiter.executeAll([
  () => fetchData(1),
  () => fetchData(2),
  () => fetchData(3),
  () => fetchData(4),
  () => fetchData(5)
]);
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
| `enabled` | `boolean` | ✅ Yes | - | Enable or disable caching. |
| `ttl` | `number` | No | `300000` | Time-to-live in milliseconds (default: 5 minutes). |
| `respectCacheControl` | `boolean` | No | `true` | Respect Cache-Control and Expires headers from responses. |
| `cacheableStatusCodes` | `number[]` | No | `[200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501]` | HTTP status codes that should be cached. |
| `maxSize` | `number` | No | `100` | Maximum number of cached entries. |
| `excludeMethods` | `string[]` | No | `['POST', 'PUT', 'PATCH', 'DELETE']` | HTTP methods to exclude from caching. |
| `keyGenerator` | `Function` | No | `undefined` | Custom function to generate cache keys. |

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

### REQUEST_DATA

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
| `hostname` | `string` | ✅ Yes | - | Target hostname (without protocol). |
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

### STABLE_REQUEST

Complete options for `stableRequest` function. See [stableRequest](#stablerequest) for detailed property descriptions.

---

### API_GATEWAY_OPTIONS

Complete options for `stableApiGateway` function. See [stableApiGateway](#stableapigateway) for detailed property descriptions.

---

### API_GATEWAY_REQUEST

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
| `id` | `string` | ✅ Yes | Unique identifier for this request. |
| `groupId` | `string` | No | Optional group ID for applying group-level configuration. |
| `requestOptions` | `API_GATEWAY_REQUEST_OPTIONS_TYPE` | ✅ Yes | Request options (similar to `STABLE_REQUEST` but `reqData` can be partial). |

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

### STABLE_WORKFLOW_OPTIONS

Complete options for `stableWorkflow` function. See [stableWorkflow](#stableworkflow) for detailed property descriptions.

---

### STABLE_WORKFLOW_PHASE

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
  commonConfig?: Omit<API_GATEWAY_OPTIONS, 'concurrentExecution' | 'stopOnFirstError' | 'requestGroups'>;
  branchId?: string;
}
```

#### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `id` | `string` | No | Auto-generated | Unique identifier for this phase. |
| `requests` | `API_GATEWAY_REQUEST[]` | ✅ Yes | - | Array of requests to execute in this phase. |
| `concurrentExecution` | `boolean` | No | `true` | Execute requests concurrently or sequentially within this phase. |
| `stopOnFirstError` | `boolean` | No | `false` | Stop phase execution on first request error. |
| `markConcurrentPhase` | `boolean` | No | `false` | Mark this phase for concurrent execution in mixed execution mode. |
| `maxConcurrentRequests` | `number` | No | `undefined` | Maximum concurrent requests for this phase. |
| `rateLimit` | `RateLimitConfig` | No | `undefined` | Rate limiting for this phase. |
| `circuitBreaker` | `CircuitBreakerConfig` | No | `undefined` | Circuit breaker for this phase. |
| `maxReplayCount` | `number` | No | `0` | Maximum times this phase can be replayed. |
| `allowReplay` | `boolean` | No | `false` | Allow this phase to be replayed via decision hook. |
| `allowSkip` | `boolean` | No | `true` | Allow this phase to be skipped via decision hook. |
| `phaseDecisionHook` | `Function` | No | `undefined` | Decision hook for non-linear execution (JUMP, SKIP, REPLAY, TERMINATE). |
| `commonConfig` | `Partial<API_GATEWAY_OPTIONS>` | No | `{}` | Phase-level configuration overrides. |

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
  commonConfig?: Omit<API_GATEWAY_OPTIONS, 'concurrentExecution' | 'stopOnFirstError' | 'requestGroups'>;
}
```

#### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `id` | `string` | ✅ Yes | - | Unique identifier for this branch. |
| `phases` | `STABLE_WORKFLOW_PHASE[]` | ✅ Yes | - | Array of phases to execute in this branch. |
| `markConcurrentBranch` | `boolean` | No | `false` | Execute this branch concurrently with other marked branches. |
| `allowReplay` | `boolean` | No | `false` | Allow this branch to be replayed. |
| `maxReplayCount` | `number` | No | `0` | Maximum times this branch can be replayed. |
| `allowSkip` | `boolean` | No | `true` | Allow this branch to be skipped. |
| `branchDecisionHook` | `Function` | No | `undefined` | Decision hook for branch-level decisions. |
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
  groupId: string;
  commonConfig?: Partial<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>>;
}
```

Configuration for a group of requests with shared settings.

#### `TRIAL_MODE_OPTIONS`

```typescript
interface TRIAL_MODE_OPTIONS {
  enabled: boolean;
  reqFailureProbability?: number;    // 0-1, probability of initial failure
  retryFailureProbability?: number;  // 0-1, probability of retry failure
  latencyRange?: { min: number; max: number }; // Simulated latency in ms
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
| `persistenceFunction` | `Function` | Yes | - | Function to handle state loading and storing. Should return state object when loading, or void/Promise<void> when storing. |
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

```typescript
interface ResponseAnalysisHookOptions<RequestDataType = any, ResponseDataType = any> {
  data: ResponseDataType;
  reqData: AxiosRequestConfig<RequestDataType>;
  params?: any;
  trialMode?: TRIAL_MODE_OPTIONS;
  preExecutionResult?: any;
  commonBuffer?: Record<string, any>;
}
```

#### `FinalErrorAnalysisHookOptions`

```typescript
interface FinalErrorAnalysisHookOptions<RequestDataType = any> {
  error: any;
  reqData: AxiosRequestConfig<RequestDataType>;
  params?: any;
  trialMode?: TRIAL_MODE_OPTIONS;
  preExecutionResult?: any;
  commonBuffer?: Record<string, any>;
}
```

#### `HandleErrorHookOptions`

```typescript
interface HandleErrorHookOptions<RequestDataType = any> {
  errorLog: ERROR_LOG;
  reqData: AxiosRequestConfig<RequestDataType>;
  params?: any;
  maxSerializableChars?: number;
  preExecutionResult?: any;
  commonBuffer?: Record<string, any>;
}
```

#### `HandleSuccessfulAttemptDataHookOptions`

```typescript
interface HandleSuccessfulAttemptDataHookOptions<RequestDataType = any, ResponseDataType = any> {
  successfulAttemptData: SUCCESSFUL_ATTEMPT_DATA<ResponseDataType>;
  reqData: AxiosRequestConfig<RequestDataType>;
  params?: any;
  maxSerializableChars?: number;
  preExecutionResult?: any;
  commonBuffer?: Record<string, any>;
}
```

#### `PreExecutionHookOptions`

```typescript
interface PreExecutionHookOptions {
  inputParams?: any;
  commonBuffer?: Record<string, any>;
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
  terminateWorkflow?: boolean; // If true, terminates entire workflow
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

## Additional Types

### `ERROR_LOG`

```typescript
interface ERROR_LOG {
  timestamp: string;
  executionTime: number;
  statusCode: number;
  attempt: string;
  error: string;
  type: 'HTTP_ERROR' | 'INVALID_CONTENT';
  isRetryable: boolean;
}
```

### `SUCCESSFUL_ATTEMPT_DATA`

```typescript
interface SUCCESSFUL_ATTEMPT_DATA<ResponseDataType = any> {
  attempt: string;
  timestamp: string;
  executionTime: number;
  data: ResponseDataType;
  statusCode: number;
}
```

### `STABLE_WORKFLOW_PHASE_RESULT`

```typescript
interface STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType = any> {
  workflowId: string;     // Workflow identifier
  branchId?: string;      // Branch identifier (if phase executed within a branch)
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
}
```

### `PhaseExecutionRecord`

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

### `BranchExecutionResult`

```typescript
interface BranchExecutionResult<ResponseDataType = any> {
  workflowId: string;     // Workflow identifier
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
}
```

### `BranchExecutionRecord`

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

### `RequestPreExecutionOptions`

```typescript
interface RequestPreExecutionOptions {
  preExecutionHook: (options: PreExecutionHookOptions) => any | Promise<any>;
  preExecutionHookParams?: any;
  applyPreExecutionConfigOverride?: boolean;
  continueOnPreExecutionHookFailure?: boolean;
}
```

### `HookParams`

```typescript
interface HookParams {
  responseAnalyzerParams?: any;
  handleSuccessfulAttemptDataParams?: any;
  handleErrorsParams?: any;
  finalErrorAnalyzerParams?: any;
}
```

### `WorkflowHookParams`

```typescript
interface WorkflowHookParams {
  handlePhaseCompletionParams?: any;
  handlePhaseErrorParams?: any;
  handlePhaseDecisionParams?: any;
}
```

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
