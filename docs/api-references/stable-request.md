# Stable Request API Reference

## Table of Contents

1. [Overview](#overview)
2. [Core Interface: STABLE_REQUEST](#core-interface-stable_request)
3. [Result Interface: STABLE_REQUEST_RESULT](#result-interface-stable_request_result)
4. [Hook Interfaces](#hook-interfaces)
5. [Execution Lifecycle](#execution-lifecycle)
6. [Configuration Examples](#configuration-examples)
7. [Advanced Use Cases](#advanced-use-cases)
8. [Best Practices](#best-practices)

---

## Overview

`stableRequest` is a robust HTTP request client that applies resilience patterns (retries, caching, circuit breaking & rate limiting) to HTTP/HTTPS requests. Ot provides production-ready reliability for external API calls with comprehensive observability and error handling.

### Key Features

- ✅ **HTTP/HTTPS Support**: Full support for all HTTP methods (GET, POST, PUT, PATCH, DELETE)
- ✅ **Type-Safe**: Full TypeScript generics for `RequestDataType` and `ResponseDataType`
- ✅ **Retry Logic**: Configurable retry strategies (FIXED, LINEAR, EXPONENTIAL)
- ✅ **Circuit Breaker**: Fail-fast protection with CLOSED → OPEN → HALF_OPEN states
- ✅ **Response Caching**: HTTP response caching with TTL and custom key generation
- ✅ **Rate Limiting**: Sliding-window rate limiter for controlled throughput
- ✅ **Concurrency Control**: Semaphore-based concurrency limiting
- ✅ **Smart Error Detection**: Automatic retry for network errors, 5xx, 429, 408, 503
- ✅ **Response Analysis**: Custom validation of response content for intelligent retries
- ✅ **Observability**: Comprehensive hooks for logging, monitoring, and debugging
- ✅ **State Management**: Shared buffers and state persistence across attempts
- ✅ **Trial Mode**: Dry-run execution without actual HTTP calls

### Function Signature

```typescript
async function stableRequest<RequestDataType = any, ResponseDataType = any>(
  options: STABLE_REQUEST<RequestDataType, ResponseDataType>
): Promise<STABLE_REQUEST_RESULT<ResponseDataType>>
```

---

## Core Interface: STABLE_REQUEST

The main configuration interface for making HTTP requests with resilience patterns.

### Interface Definition

```typescript
interface STABLE_REQUEST<RequestDataType = any, ResponseDataType = any> {
  reqData: REQUEST_DATA<RequestDataType>;
  responseAnalyzer?: (options: ResponseAnalysisHookOptions<RequestDataType, ResponseDataType>) => boolean | Promise<boolean>;
  resReq?: boolean;
  attempts?: number;
  performAllAttempts?: boolean;
  wait?: number;
  maxAllowedWait?: number;
  retryStrategy?: RETRY_STRATEGY_TYPES;
  jitter?: number;
  logAllErrors?: boolean;
  handleErrors?: (options: HandleErrorHookOptions<RequestDataType>) => any | Promise<any>;
  logAllSuccessfulAttempts?: boolean;
  handleSuccessfulAttemptData?: (options: HandleSuccessfulAttemptDataHookOptions<RequestDataType, ResponseDataType>) => any | Promise<any>;
  maxSerializableChars?: number;
  finalErrorAnalyzer?: (options: FinalErrorAnalysisHookOptions<RequestDataType>) => boolean | Promise<boolean>;
  trialMode?: TRIAL_MODE_OPTIONS;
  hookParams?: HookParams;
  preExecution?: RequestPreExecutionOptions;
  commonBuffer?: Record<string, any>;
  cache?: CacheConfig;
  executionContext?: ExecutionContext;
  circuitBreaker?: CircuitBreakerConfig | CircuitBreaker;
  statePersistence?: StatePersistenceConfig;
  metricsGuardrails?: MetricsGuardrails;
  throwOnFailedErrorAnalysis?: boolean;
}
```

### Field Descriptions

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `reqData` | `REQUEST_DATA<RequestDataType>` | **Yes** | - | HTTP request configuration (hostname, method, path, headers, body, etc.). |
| `responseAnalyzer` | `Function` | No | `() => true` | Hook to analyze response data and determine if retry is needed. Return `false` to trigger retry. |
| `resReq` | `boolean` | No | `false` | If `true`, returns the actual response data. If `false`, returns `true` on success. |
| `attempts` | `number` | No | `1` | Maximum number of request attempts (including initial attempt). |
| `performAllAttempts` | `boolean` | No | `false` | If `true`, executes all attempts regardless of success. Returns last successful response. |
| `wait` | `number` | No | `1000` | Base wait time in milliseconds between retries. |
| `maxAllowedWait` | `number` | No | `60000` | Maximum wait time cap in milliseconds (60 seconds). |
| `retryStrategy` | `RETRY_STRATEGIES` | No | `FIXED` | Retry strategy: `FIXED`, `LINEAR`, or `EXPONENTIAL`. |
| `jitter` | `number` | No | `0` | Random jitter in milliseconds to add to wait time (prevents thundering herd). |
| `logAllErrors` | `boolean` | No | `false` | If `true`, logs all errors via `handleErrors` hook. |
| `handleErrors` | `Function` | No | Console logger | Hook called for each error. Receives error log with HTTP status, attempt details. |
| `logAllSuccessfulAttempts` | `boolean` | No | `false` | If `true`, logs all successful attempts via `handleSuccessfulAttemptData` hook. |
| `handleSuccessfulAttemptData` | `Function` | No | Console logger | Hook called for each successful attempt. Receives attempt data with response. |
| `maxSerializableChars` | `number` | No | `1000` | Maximum characters for serializing objects in logs. |
| `finalErrorAnalyzer` | `Function` | No | `() => false` | Hook to analyze final error after all retries. Return `true` to treat as success. |
| `trialMode` | `TRIAL_MODE_OPTIONS` | No | `{ enabled: false }` | Dry-run mode for testing without actual HTTP calls. |
| `hookParams` | `HookParams` | No | `{}` | Parameters to pass to hooks (responseAnalyzerParams, handleErrorsParams, etc.). |
| `preExecution` | `RequestPreExecutionOptions` | No | `undefined` | Hook executed before request for dynamic configuration. |
| `commonBuffer` | `Record<string, any>` | No | `{}` | Shared mutable state accessible in all hooks. |
| `cache` | `CacheConfig` | No | `undefined` | Caching configuration for HTTP responses. |
| `executionContext` | `ExecutionContext` | No | `undefined` | Context metadata (workflowId, phaseId, requestId) for tracing. |
| `circuitBreaker` | `CircuitBreakerConfig \| CircuitBreaker` | No | `undefined` | Circuit breaker configuration or instance. |
| `statePersistence` | `StatePersistenceConfig` | No | `undefined` | State persistence configuration for external storage. `persistenceFunction` receives `persistenceStage` (`PersistenceStage.BEFORE_HOOK` \| `PersistenceStage.AFTER_HOOK`). |
| `metricsGuardrails` | `MetricsGuardrails` | No | `undefined` | Metrics validation guardrails with min/max thresholds for request metrics (see `MetricsGuardrailsRequest`, `MetricsGuardrailsInfrastructure`, `MetricsGuardrailsCommon`). |
| `throwOnFailedErrorAnalysis` | `boolean` | No | `false` | If `true`, throws when `finalErrorAnalyzer` returns `false`. Otherwise returns a failed result with metrics. |

### REQUEST_DATA Interface

Configuration for the HTTP request:

```typescript
interface REQUEST_DATA<RequestDataType = any> {
  hostname: string;                         // Required: API hostname (e.g., "api.example.com")
  protocol?: 'http' | 'https';              // Default: 'https'
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; // Default: 'GET'
  path?: `/${string}`;                      // API path (e.g., "/users/123")
  port?: number;                            // Port number (default: 80 for http, 443 for https)
  headers?: Record<string, any>;            // HTTP headers
  body?: RequestDataType;                   // Request body (for POST, PUT, PATCH)
  query?: Record<string, any>;              // Query parameters (converted to ?key=value)
  timeout?: number;                         // Request timeout in milliseconds
  signal?: AbortSignal;                     // AbortController signal for cancellation
}
```

---

## Result Interface: STABLE_REQUEST_RESULT

The result object returned by `stableRequest`.

### Interface Definition

```typescript
interface STABLE_REQUEST_RESULT<ResponseDataType = any> {
  success: boolean;
  data?: ResponseDataType;
  error?: string;
  errorLogs?: ERROR_LOG[];
  successfulAttempts?: SUCCESSFUL_ATTEMPT_DATA<ResponseDataType>[];
  metrics?: StableRequestMetrics;
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Indicates if request succeeded. |
| `data` | `ResponseDataType?` | Response data (if `resReq: true`). Otherwise `true` on success. |
| `error` | `string?` | Error message if request failed. |
| `errorLogs` | `ERROR_LOG[]?` | Array of all error logs from failed attempts. |
| `successfulAttempts` | `SUCCESSFUL_ATTEMPT_DATA<ResponseDataType>[]?` | Array of all successful attempt data (if `logAllSuccessfulAttempts: true`). |
| `metrics` | `StableRequestMetrics?` | Execution metrics including attempts, timing, infrastructure stats, and validation results. |
| `metrics.validation` | `MetricsValidationResult?` | Validation results when `metricsGuardrails` are configured. |

### Supporting Interfaces

#### ERROR_LOG

```typescript
interface ERROR_LOG {
  timestamp: string;       // ISO 8601 timestamp
  executionTime: number;   // Execution time in milliseconds
  statusCode: number;      // HTTP status code (0 for network errors)
  attempt: string;         // Format: "1/3" (current/total)
  error: string;           // Error message
  type: 'HTTP_ERROR' | 'INVALID_CONTENT';  // Error classification
  isRetryable: boolean;    // Whether the error allows retry
}
```

**Automatically Retryable HTTP Status Codes:**
- `408` Request Timeout
- `429` Too Many Requests
- `500` Internal Server Error
- `502` Bad Gateway
- `503` Service Unavailable
- `504` Gateway Timeout
- Network errors (ECONNRESET, ETIMEDOUT, etc.)

#### SUCCESSFUL_ATTEMPT_DATA

```typescript
interface SUCCESSFUL_ATTEMPT_DATA<ResponseDataType = any> {
  attempt: string;         // Format: "1/3"
  timestamp: string;       // ISO 8601 timestamp
  executionTime: number;   // Execution time in milliseconds
  data: ResponseDataType;  // Response data
  statusCode: number;      // HTTP status code (e.g., 200, 201)
}
```

---

## Hook Interfaces

### 1. RequestPreExecutionOptions

Executed before request for dynamic configuration.

```typescript
interface RequestPreExecutionOptions<RequestDataType = any, ResponseDataType = any> {
  preExecutionHook: (options: PreExecutionHookOptions<RequestDataType, ResponseDataType>) => any | Promise<any>;
  preExecutionHookParams?: any;
  applyPreExecutionConfigOverride?: boolean;
  continueOnPreExecutionHookFailure?: boolean;
}
```

**PreExecutionHookOptions:**

| Field | Type | Description |
|-------|------|-------------|
| `inputParams` | `any?` | Parameters from `preExecutionHookParams`. |
| `commonBuffer` | `Record<string, any>?` | Shared mutable state. |
| `stableRequestOptions` | `STABLE_REQUEST<RequestDataType, ResponseDataType>` | Full request configuration. |

**Usage:**
- Inject authentication tokens dynamically
- Modify request headers/body based on external state
- Load configuration from external sources
- Return partial `STABLE_REQUEST` object to override configuration (if `applyPreExecutionConfigOverride: true`)

**Example:**
```typescript
preExecution: {
  preExecutionHook: async ({ inputParams, commonBuffer }) => {
    // Fetch fresh auth token
    const token = await getAuthToken();
    
    // Modify request headers
    return {
      reqData: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    };
  },
  applyPreExecutionConfigOverride: true
}
```

---

### 2. ResponseAnalysisHookOptions

Analyze response data to determine success/failure.

```typescript
interface ResponseAnalysisHookOptions<RequestDataType = any, ResponseDataType = any> {
  reqData: AxiosRequestConfig<RequestDataType>;
  data: ResponseDataType;
  trialMode?: TRIAL_MODE_OPTIONS;
  params?: any;
  preExecutionResult?: any;
  commonBuffer?: Record<string, any>;
  executionContext?: ExecutionContext;
}
```

**Return Value:**
- `true`: Success (stop retrying)
- `false`: Failure (trigger retry if attempts remain)

**Example:**
```typescript
responseAnalyzer: ({ data }) => {
  // Retry if response indicates rate limiting
  if (data?.status === 'rate_limited') {
    return false;
  }
  
  // Retry if response data is incomplete
  if (!data?.id || !data?.email) {
    return false;
  }
  
  return true;
}
```

---

### 3. HandleErrorHookOptions

Called for each error when `logAllErrors: true`.

```typescript
interface HandleErrorHookOptions<RequestDataType = any> {
  reqData: AxiosRequestConfig<RequestDataType>;
  errorLog: ERROR_LOG;
  params?: any;
  maxSerializableChars?: number;
  preExecutionResult?: any;
  commonBuffer?: Record<string, any>;
  executionContext?: ExecutionContext;
}
```

**Use Cases:**
- Log to external monitoring systems (Datadog, Sentry, CloudWatch)
- Trigger alerts for critical errors
- Store error history in database
- Update metrics dashboards

**Example:**
```typescript
handleErrors: async ({ reqData, errorLog, executionContext }) => {
  await fetch('https://monitoring.example.com/errors', {
    method: 'POST',
    body: JSON.stringify({
      service: 'api-gateway',
      endpoint: reqData.url,
      statusCode: errorLog.statusCode,
      error: errorLog.error,
      attempt: errorLog.attempt,
      context: executionContext
    })
  });
}
```

---

### 4. HandleSuccessfulAttemptDataHookOptions

Called for each successful attempt when `logAllSuccessfulAttempts: true`.

```typescript
interface HandleSuccessfulAttemptDataHookOptions<RequestDataType = any, ResponseDataType = any> {
  reqData: AxiosRequestConfig<RequestDataType>;
  successfulAttemptData: SUCCESSFUL_ATTEMPT_DATA<ResponseDataType>;
  params?: any;
  maxSerializableChars?: number;
  preExecutionResult?: any;
  commonBuffer?: Record<string, any>;
  executionContext?: ExecutionContext;
}
```

**Use Cases:**
- Track success metrics
- Log successful operations for audit
- Store responses in buffer for downstream requests
- Update dashboards with success rates

**Example:**
```typescript
handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
  // Store response in buffer for next request
  commonBuffer.userData = successfulAttemptData.data;
  
  // Log success metrics
  console.info(`Request succeeded on attempt ${successfulAttemptData.attempt}`);
  console.info(`Execution time: ${successfulAttemptData.executionTime}ms`);
}
```

---

### 5. FinalErrorAnalysisHookOptions

Analyze final error after all retries exhausted.

```typescript
interface FinalErrorAnalysisHookOptions<RequestDataType = any> {
  reqData: AxiosRequestConfig<RequestDataType>;
  error: any;
  trialMode?: TRIAL_MODE_OPTIONS;
  params?: any;
  preExecutionResult?: any;
  commonBuffer?: Record<string, any>;
  executionContext?: ExecutionContext;
}
```

**Return Value:**
- `true`: Treat as success (return result with `success: false` but no throw)
- `false`: Re-throw error (default)

**Example:**
```typescript
finalErrorAnalyzer: ({ error }) => {
  // Treat 404 as acceptable failure
  if (error.message.includes('404')) {
    return true; // Don't throw
  }
  
  // Treat timeout as acceptable failure
  if (error.message.includes('timeout')) {
    return true;
  }
  
  return false; // Re-throw
}
```

---

### 6. HookParams

Container for parameters passed to hooks.

```typescript
interface HookParams {
  responseAnalyzerParams?: any;
  handleSuccessfulAttemptDataParams?: any;
  handleErrorsParams?: any;
  finalErrorAnalyzerParams?: any;
}
```

**Usage:**
```typescript
stableRequest({
  reqData: { hostname: 'api.example.com', path: '/users' },
  hookParams: {
    responseAnalyzerParams: { minItems: 5 },
    handleErrorsParams: { alertEmail: 'admin@example.com' }
  },
  responseAnalyzer: ({ data, params }) => {
    // Access params.minItems here
    return Array.isArray(data) && data.length >= params.minItems;
  }
});
```

---

## Execution Lifecycle

The following diagram illustrates the complete lifecycle of a `stableRequest` execution:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INITIALIZATION                                               │
│    - Validate trialMode probabilities                           │
│    - Initialize circuit breaker (if configured)                 │
│    - Initialize cache manager (if caching enabled)              │
│    - Convert reqData to Axios config                            │
│    - Initialize metrics collection                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 2. PRE-EXECUTION HOOK (Optional)                                │
│    - Execute preExecutionHook with context                      │
│    - Load state from statePersistence (if configured)           │
│    - Apply configuration overrides (if enabled)                 │
│    - Continue on failure (if continueOnPreExecutionHookFailure) │
│    - Common uses: Inject auth tokens, modify headers/body       │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 3. ATTEMPT LOOP (Do-While: attempts > 0)                        │
│    ┌────────────────────────────────────────────────────┐       │
│    │ 3a. Circuit Breaker Check (if configured)          │       │
│    │     - Check canExecute() for CLOSED/HALF_OPEN      │       │
│    │     - Throw CircuitBreakerOpenError if OPEN        │       │
│    │     - Skip check if trackIndividualAttempts=false  │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 3b. HTTP Request Execution (reqFn)                 │       │
│    │     - Check cache first (if enabled)               │       │
│    │     - If cache hit: Return immediately             │       │
│    │     - If cache miss:                               │       │
│    │       • Build Axios request config                 │       │
│    │       • Execute HTTP request (or simulate in trial)│       │
│    │       • Capture response/error                     │       │
│    │       • Classify as retryable/non-retryable        │       │
│    │       • Store in cache (if enabled)                │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 3c. Circuit Breaker Update (on error)              │       │
│    │     - If error and trackIndividualAttempts:        │       │
│    │       • recordAttemptFailure()                     │       │
│    │       • Check if state changed to OPEN             │       │
│    │       • Throw if opened (blocks further retries)   │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 3d. Response Analysis (if HTTP 2xx/3xx)            │       │
│    │     - Execute responseAnalyzer hook                │       │
│    │     - Determine if retry needed:                   │       │
│    │       • true: Success, stop retrying               │       │
│    │       • false: Content invalid, retry needed       │       │
│    │     - On analyzer error: Retry                     │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 3e. Circuit Breaker Update (on response)           │       │
│    │     - If success: recordAttemptSuccess()           │       │
│    │     - If failure/retry: recordAttemptFailure()     │       │
│    │     - Check if state changed to OPEN               │       │
│    │     - Throw if opened (blocks further retries)     │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 3f. Error Logging (if logAllErrors: true)          │       │
│    │     - Create error log entry (HTTP or INVALID)     │       │
│    │     - Add to errorLogs array                       │       │
│    │     - Execute handleErrors hook                    │       │
│    │     - Store state (if statePersistence configured) │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 3g. Success Logging (if logAllSuccessfulAttempts)  │       │
│    │     - Create success log entry                     │       │
│    │     - Add to successfulAttemptsList                │       │
│    │     - Execute handleSuccessfulAttemptData hook     │       │
│    │     - Store state (if statePersistence configured) │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 3h. Retry Decision                                 │       │
│    │     - If performAllAttempts: Continue              │       │
│    │     - If retry needed and attempts remain:         │       │
│    │       • Calculate delay (strategy + jitter)        │       │
│    │       • Cap delay at maxAllowedWait                │       │
│    │       • Sleep for delay duration                   │       │
│    │       • Loop back to 3a                            │       │
│    │     - Else: Exit loop                              │       │
│    └────────────────────────────────────────────────────┘       │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 4. RESULT BUILDING                                              │
│    ┌────────────────────────────────────────────────────┐       │
│    │ 4a. If performAllAttempts && hadAtLeastOneSuccess  │       │
│    │     - Return last successful response              │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 4b. If HTTP 2xx/3xx (Normal Success)               │       │
│    │     - Return result with response data             │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 4c. If All Attempts Failed                         │       │
│    │     - Throw error with request details             │       │
│    │     - Jump to error handling (5)                   │       │
│    └────────────────────────────────────────────────────┘       │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 5. ERROR HANDLING (Catch Block)                                 │
│    ┌────────────────────────────────────────────────────┐       │
│    │ 5a. Execute finalErrorAnalyzer                     │       │
│    │     - Analyze final error                          │       │
│    │     - Return boolean decision                      │       │
│    │     - Store state (if statePersistence configured) │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 5b. Decision Based on Analysis                     │       │
│    │     - If true: Return failure result (no throw)    │       │
│    │     - If false: Re-throw error                     │       │
│    └────────────────────────────────────────────────────┘       │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 6. RETURN RESULT                                                │
│    - Includes success flag                                      │
│    - Includes response data (if resReq: true)                   │
│    - Includes error logs                                        │
│    - Includes successful attempts                               │
│    - Includes comprehensive metrics                             │
│    - Includes infrastructure metrics (circuit breaker, cache)   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Lifecycle Points

1. **Pre-Execution**: State loading, dynamic configuration injection
2. **Per-Attempt**: Circuit breaker check, HTTP execution, cache check, response analysis
3. **Post-Attempt**: Error/success logging, state persistence
4. **Between Attempts**: Delay calculation with retry strategy and jitter
5. **Post-Execution**: Final error analysis, metrics aggregation
6. **Return**: Comprehensive result with logs, metrics, and infrastructure stats

### Automatic Retry Logic

The library automatically retries on:
- **Network Errors**: ECONNRESET, ETIMEDOUT, ENOTFOUND, ECONNREFUSED
- **HTTP 408**: Request Timeout
- **HTTP 429**: Too Many Requests
- **HTTP 5xx**: Server errors (500, 502, 503, 504)

Non-retryable errors (immediate failure):
- **HTTP 4xx**: Client errors (except 408, 429)
- **AbortError**: Request cancelled by user
- **Circuit Breaker Open**: When circuit breaker is in OPEN state

---

## Configuration Examples

### Example 1: Basic HTTP Request with Retry

```typescript
import { stableRequest, RETRY_STRATEGIES, REQUEST_METHODS, VALID_REQUEST_PROTOCOLS } from '@emmvish/stable-request';

const result = await stableRequest<never, { id: number; name: string }>({
  reqData: {
    hostname: 'api.example.com',
    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
    method: REQUEST_METHODS.GET,
    path: '/users/123',
    headers: {
      'Content-Type': 'application/json'
    }
  },
  resReq: true,
  attempts: 3,
  wait: 500,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
  jitter: 100
});

if (result.success) {
  console.log('User:', result.data);
} else {
  console.error('Failed:', result.error);
}
```

### Example 2: POST Request with Body

```typescript
import { stableRequest, REQUEST_METHODS } from '@emmvish/stable-request';

const result = await stableRequest<{ name: string; email: string }, { id: number }>({
  reqData: {
    hostname: 'api.example.com',
    method: REQUEST_METHODS.POST,
    path: '/users',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token123'
    },
    body: {
      name: 'John Doe',
      email: 'john@example.com'
    }
  },
  resReq: true,
  attempts: 3,
  wait: 1000,
  logAllErrors: true,
  handleErrors: ({ errorLog }) => {
    console.error(`Attempt ${errorLog.attempt} failed:`, errorLog.error);
  }
});

console.log('Created user ID:', result.data?.id);
```

### Example 3: Request with Response Validation

```typescript
import { stableRequest } from '@emmvish/stable-request';

interface UserResponse {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

const result = await stableRequest<never, UserResponse>({
  reqData: {
    hostname: 'api.example.com',
    path: '/users/123'
  },
  resReq: true,
  attempts: 3,
  wait: 500,
  responseAnalyzer: ({ data }) => {
    // Retry if response is incomplete
    if (!data?.id || !data?.email) {
      console.log('Incomplete response, retrying...');
      return false;
    }
    
    // Retry if user is inactive
    if (!data.isActive) {
      console.log('User inactive, retrying...');
      return false;
    }
    
    return true;
  }
});

if (result.success) {
  console.log('Valid user:', result.data);
}
```

### Example 4: Request with Circuit Breaker

```typescript
import { stableRequest, CircuitBreaker } from '@emmvish/stable-request';

// Shared circuit breaker for all requests to same service
const breaker = new CircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 5,
  recoveryTimeoutMs: 30000,
  trackIndividualAttempts: true
});

// Multiple requests share the circuit breaker
for (let i = 0; i < 10; i++) {
  try {
    const result = await stableRequest({
      reqData: {
        hostname: 'unreliable-api.example.com',
        path: `/data/${i}`
      },
      resReq: true,
      attempts: 3,
      wait: 500,
      circuitBreaker: breaker
    });
    
    console.log(`Request ${i} succeeded:`, result.data);
  } catch (e) {
    console.error(`Request ${i} failed:`, e.message);
  }
}

console.log('Circuit breaker state:', breaker.getState().state);
```

### Example 5: Request with Caching

```typescript
import { stableRequest } from '@emmvish/stable-request';

const result = await stableRequest<never, { items: any[] }>({
  reqData: {
    hostname: 'api.example.com',
    path: '/products'
  },
  resReq: true,
  cache: {
    enabled: true,
    ttl: 300000, // 5 minutes
    keyGenerator: (reqData) => `products_list`
  }
});

// Second call with same key returns cached result
const cachedResult = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/products'
  },
  resReq: true,
  cache: { enabled: true, ttl: 300000 }
});

console.log('Cache hit:', cachedResult.metrics?.infrastructureMetrics?.cache?.hitRate);
```

### Example 6: Request with Pre-Execution Hook

```typescript
import { stableRequest } from '@emmvish/stable-request';

const getAuthToken = async (): Promise<string> => {
  // Fetch dynamic auth token
  return `Bearer ${Date.now()}`;
};

const result = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/protected/data'
  },
  resReq: true,
  preExecution: {
    preExecutionHook: async ({ stableRequestOptions, commonBuffer }) => {
      // Fetch fresh token before request
      const token = await getAuthToken();
      
      // Store in buffer for other requests
      commonBuffer.authToken = token;
      
      // Override request configuration
      return {
        reqData: {
          headers: {
            Authorization: token
          }
        }
      };
    },
    applyPreExecutionConfigOverride: true
  }
});
```

### Example 7: Request with Query Parameters

```typescript
import { stableRequest } from '@emmvish/stable-request';

const result = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/search',
    query: {
      q: 'javascript',
      limit: 10,
      offset: 0,
      sort: 'relevance'
    }
  },
  resReq: true,
  attempts: 2
});

// Requests: https://api.example.com/search?q=javascript&limit=10&offset=0&sort=relevance
```

### Example 8: Request with State Persistence

```typescript
import { stableRequest } from '@emmvish/stable-request';

const externalStorage = new Map<string, any>();

const result = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/data'
  },
  resReq: true,
  attempts: 3,
  wait: 1000,
  logAllErrors: true,
  logAllSuccessfulAttempts: true,
  statePersistence: {
    enabled: true,
    stateStore: {
      saveState: async (key, value) => {
        externalStorage.set(key, value);
      },
      loadState: async (key) => {
        return externalStorage.get(key);
      }
    },
    loadBeforeHooks: true,
    storeAfterHooks: true
  }
});

console.log('Persisted states:', Array.from(externalStorage.keys()));
```

### Example 9: Request with Trial Mode

```typescript
import { stableRequest } from '@emmvish/stable-request';

const result = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/critical-operation'
  },
  resReq: true,
  attempts: 3,
  wait: 500,
  trialMode: {
    enabled: true,
    reqFailureProbability: 0.3,      // 30% chance initial request fails
    retryFailureProbability: 0.2     // 20% chance each retry fails
  }
});

// In trial mode:
// - No actual HTTP requests
// - Simulates successes/failures based on probabilities
// - Tests retry logic safely
// - Validates hooks and configuration

console.log('Trial result:', result);
```

### Example 10: Request with Timeout and AbortSignal

```typescript
import { stableRequest } from '@emmvish/stable-request';

const controller = new AbortController();

// Auto-abort after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const result = await stableRequest({
    reqData: {
      hostname: 'slow-api.example.com',
      path: '/data',
      timeout: 3000,           // 3 second timeout per attempt
      signal: controller.signal // Manual cancellation control
    },
    resReq: true,
    attempts: 3,
    wait: 1000
  });
  
  console.log('Success:', result.data);
} catch (e) {
  if (e.name === 'AbortError') {
    console.log('Request was cancelled');
  } else {
    console.error('Request failed:', e.message);
  }
}
```

---

## Advanced Use Cases

### Use Case 1: API with Rate Limiting

```typescript
import { stableRequest } from '@emmvish/stable-request';

// Handles HTTP 429 responses automatically
const result = await stableRequest({
  reqData: {
    hostname: 'rate-limited-api.example.com',
    path: '/data'
  },
  resReq: true,
  attempts: 5,
  wait: 1000,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
  jitter: 500,
  maxAllowedWait: 30000,  // Cap at 30 seconds
  responseAnalyzer: ({ data }) => {
    // Also retry on API-specific rate limit indicators
    if (data?.error === 'rate_limit_exceeded') {
      return false;
    }
    return true;
  }
});
```

### Use Case 2: Chained Requests with Buffer Passing

```typescript
import { stableRequest } from '@emmvish/stable-request';

const sharedBuffer: Record<string, any> = {};

// Step 1: Fetch user
const step1 = await stableRequest<never, { id: number; accountId: string }>({
  reqData: {
    hostname: 'api.example.com',
    path: '/users/123'
  },
  resReq: true,
  commonBuffer: sharedBuffer,
  logAllSuccessfulAttempts: true,
  handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
    // Store for next request
    commonBuffer.accountId = successfulAttemptData.data.accountId;
  }
});

// Step 2: Fetch account (uses buffer from step 1)
const step2 = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: `/accounts/${sharedBuffer.accountId}`
  },
  resReq: true,
  commonBuffer: sharedBuffer
});

console.log('Account data:', step2.data);
```

### Use Case 3: Parallel Requests with Shared Circuit Breaker

```typescript
import { stableRequest, CircuitBreaker } from '@emmvish/stable-request';

const breaker = new CircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 10,
  recoveryTimeoutMs: 60000
});

const userIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const results = await Promise.allSettled(
  userIds.map(id =>
    stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: `/users/${id}`
      },
      resReq: true,
      attempts: 3,
      wait: 500,
      circuitBreaker: breaker
    })
  )
);

const succeeded = results.filter(r => r.status === 'fulfilled').length;
console.log(`${succeeded}/${userIds.length} requests succeeded`);
console.log('Circuit breaker state:', breaker.getState());
```

### Use Case 4: Webhook with Retry and Error Analysis

```typescript
import { stableRequest, REQUEST_METHODS } from '@emmvish/stable-request';

interface WebhookPayload {
  event: string;
  data: Record<string, any>;
}

const sendWebhook = async (payload: WebhookPayload) => {
  return stableRequest<WebhookPayload, { received: boolean }>({
    reqData: {
      hostname: 'webhook.example.com',
      method: REQUEST_METHODS.POST,
      path: '/events',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.WEBHOOK_SECRET
      },
      body: payload
    },
    resReq: true,
    attempts: 5,
    wait: 2000,
    retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
    maxAllowedWait: 60000,
    logAllErrors: true,
    handleErrors: async ({ errorLog, reqData }) => {
      // Log to error tracking service
      await logToSentry({
        error: errorLog.error,
        context: {
          attempt: errorLog.attempt,
          statusCode: errorLog.statusCode,
          endpoint: reqData.url
        }
      });
    },
    finalErrorAnalyzer: ({ error }) => {
      // Treat 410 Gone as acceptable (endpoint disabled)
      if (error.message.includes('410')) {
        return true;
      }
      return false;
    }
  });
};
```

### Use Case 5: GraphQL Request

```typescript
import { stableRequest, REQUEST_METHODS } from '@emmvish/stable-request';

interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

const executeGraphQL = async <T>(query: string, variables?: Record<string, any>) => {
  return stableRequest<GraphQLRequest, GraphQLResponse<T>>({
    reqData: {
      hostname: 'api.example.com',
      method: REQUEST_METHODS.POST,
      path: '/graphql',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_TOKEN}`
      },
      body: {
        query,
        variables
      }
    },
    resReq: true,
    attempts: 3,
    wait: 500,
    responseAnalyzer: ({ data }) => {
      // Retry on GraphQL errors
      if (data?.errors && data.errors.length > 0) {
        return false;
      }
      // Retry on null data
      if (!data?.data) {
        return false;
      }
      return true;
    }
  });
};

const result = await executeGraphQL<{ user: { id: number; name: string } }>(
  `query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
    }
  }`,
  { id: 123 }
);
```

### Use Case 6: File Upload with Progress Tracking

```typescript
import { stableRequest, REQUEST_METHODS } from '@emmvish/stable-request';
import FormData from 'form-data';

const uploadFile = async (file: Buffer, filename: string) => {
  const form = new FormData();
  form.append('file', file, filename);
  
  return stableRequest({
    reqData: {
      hostname: 'upload.example.com',
      method: REQUEST_METHODS.POST,
      path: '/files',
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${process.env.API_TOKEN}`
      },
      body: form as any
    },
    resReq: true,
    attempts: 3,
    wait: 2000,
    logAllErrors: true,
    logAllSuccessfulAttempts: true,
    handleSuccessfulAttemptData: ({ successfulAttemptData }) => {
      console.log(`Upload succeeded on attempt ${successfulAttemptData.attempt}`);
      console.log(`Upload time: ${successfulAttemptData.executionTime}ms`);
    }
  });
};
```

---

## Best Practices

1. **Always Set resReq: true** when you need the response data
   ```typescript
   const result = await stableRequest({
     reqData: { hostname: 'api.example.com', path: '/data' },
     resReq: true  // Get actual response data
   });
   ```

2. **Use Response Analyzer** for domain-specific validation
   ```typescript
   responseAnalyzer: ({ data }) => {
     // Validate response structure
     return data?.status === 'success' && data?.items?.length > 0;
   }
   ```

3. **Implement Error Handling** for production monitoring
   ```typescript
   logAllErrors: true,
   handleErrors: async ({ errorLog }) => {
     await logToMonitoring({
       error: errorLog.error,
       statusCode: errorLog.statusCode,
       attempt: errorLog.attempt
     });
   }
   ```

4. **Share Circuit Breakers** across related requests
   ```typescript
   const apiBreaker = new CircuitBreaker({ /* config */ });
   
   // Use same breaker for all requests to same API
   await stableRequest({ circuitBreaker: apiBreaker, /* ... */ });
   ```

5. **Use Caching** for idempotent GET requests
   ```typescript
   cache: {
     enabled: true,
     ttl: 300000, // 5 minutes
     keyGenerator: (reqData) => `${reqData.url}_${JSON.stringify(reqData.query)}`
   }
   ```

6. **Apply Jitter** to prevent thundering herd
   ```typescript
   wait: 1000,
   retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
   jitter: 500  // Add random 0-500ms jitter
   ```

7. **Set Timeouts** for all external requests
   ```typescript
   reqData: {
     hostname: 'api.example.com',
     timeout: 5000  // 5 second timeout
   }
   ```

8. **Use Pre-Execution Hooks** for dynamic auth tokens
   ```typescript
   preExecution: {
     preExecutionHook: async () => {
       const token = await getAuthToken();
       return {
         reqData: { headers: { Authorization: token } }
       };
     },
     applyPreExecutionConfigOverride: true
   }
   ```

9. **Test with Trial Mode** before production
   ```typescript
   trialMode: {
     enabled: true,
     reqFailureProbability: 0.2,
     retryFailureProbability: 0.1
   }
   ```

10. **Add Execution Context** for distributed tracing
    ```typescript
    executionContext: {
      workflowId: 'wf-123',
      requestId: 'req-456'
    }
    ```

11. **Configure Metrics Guardrails** for validation
    ```typescript
    metricsGuardrails: {
      request: {
        totalAttempts: { max: 5 },
        failedAttempts: { max: 2 },
        totalExecutionTime: { max: 5000 }
      }
    }
    ```

---

## Metrics Guardrails and Validation

Metrics guardrails allow you to define validation rules for request execution metrics. If metrics fall outside specified thresholds, validation results are included in the response.

### Configuring Metrics Guardrails

```typescript
const result = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/users'
  },
  attempts: 5,
  metricsGuardrails: {
    request: {
      totalAttempts: { max: 5 },
      successfulAttempts: { min: 1 },
      failedAttempts: { max: 3 },
      totalExecutionTime: { max: 10000 },
      averageAttemptTime: { max: 2000 }
    }
  }
});
```

### Available Request Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `totalAttempts` | `number` | Total number of attempts made |
| `successfulAttempts` | `number` | Number of successful attempts |
| `failedAttempts` | `number` | Number of failed attempts |
| `totalExecutionTime` | `number` | Total execution time in milliseconds |
| `averageAttemptTime` | `number` | Average time per attempt in milliseconds |

### Guardrail Configuration

Each metric can have:
- **`min`**: Minimum acceptable value
- **`max`**: Maximum acceptable value
- **`expected`**: Expected value (requires `tolerance`)
- **`tolerance`**: Acceptable deviation percentage from expected value

```typescript
metricsGuardrails: {
  request: {
    totalAttempts: { max: 5 },                    // Must not exceed 5
    successfulAttempts: { min: 1 },               // Must be at least 1
    totalExecutionTime: { expected: 1000, tolerance: 20 }  // 800-1200ms range
  }
}
```

### Checking Validation Results

```typescript
const result = await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  attempts: 3,
  metricsGuardrails: {
    request: {
      totalAttempts: { max: 2 },
      failedAttempts: { max: 0 }
    }
  }
});

if (result.metrics?.validation) {
  console.log('Validation Status:', result.metrics.validation.isValid);
  
  if (!result.metrics.validation.isValid) {
    console.log('Anomalies Detected:');
    result.metrics.validation.anomalies.forEach(anomaly => {
      console.log(`- ${anomaly.metricName}: ${anomaly.reason}`);
      console.log(`  Value: ${anomaly.metricValue}, Severity: ${anomaly.severity}`);
    });
  }
}
```

### MetricsValidationResult Interface

```typescript
interface MetricsValidationResult {
  isValid: boolean;                    // Overall validation status
  anomalies: MetricAnomaly[];          // Array of detected violations
  validatedAt: string;                 // ISO 8601 timestamp
}

interface MetricAnomaly {
  metricName: string;                  // Name of the metric
  metricValue: number;                 // Actual value
  guardrail: MetricGuardrail;          // Guardrail that was violated
  severity: 'critical' | 'warning' | 'info';  // Anomaly severity
  reason: string;                      // Human-readable explanation
  violationType: 'above_max' | 'below_min' | 'outside_tolerance';
}
```

### Severity Levels

Anomalies are automatically classified by severity based on deviation magnitude:

- **CRITICAL**: Deviation > 50% from threshold
- **WARNING**: Deviation 10-50% from threshold  
- **INFO**: Deviation < 10% from threshold

### Use Cases

1. **SLA Monitoring**: Ensure requests meet performance requirements
   ```typescript
   metricsGuardrails: {
     request: {
       totalExecutionTime: { max: 3000 },  // 3-second SLA
       successfulAttempts: { min: 1 }
     }
   }
   ```

2. **Error Rate Tracking**: Alert on excessive failures
   ```typescript
   metricsGuardrails: {
     request: {
       failedAttempts: { max: 2 },         // Max 2 failures
       successfulAttempts: { min: 1 }      // Must succeed at least once
     }
   }
   ```

3. **Performance Baselines**: Detect performance degradation
   ```typescript
   metricsGuardrails: {
     request: {
       averageAttemptTime: { expected: 500, tolerance: 30 }  // 350-650ms
     }
   }
   ```

---

## Support

For issues, questions, or contributions:

- **GitHub**: [https://github.com/emmvish/stable-request](https://github.com/emmvish/stable-request)
- **NPM**: [https://www.npmjs.com/package/@emmvish/stable-request](https://www.npmjs.com/package/@emmvish/stable-request)
- **Issues**: [https://github.com/emmvish/stable-request/issues](https://github.com/emmvish/stable-request/issues)
