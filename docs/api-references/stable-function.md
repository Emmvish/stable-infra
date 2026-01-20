# Stable Function API Reference

## Table of Contents

1. [Overview](#overview)
2. [Core Interface: STABLE_FUNCTION](#core-interface-stable_function)
3. [Result Interface: STABLE_FUNCTION_RESULT](#result-interface-stable_function_result)
4. [Hook Interfaces](#hook-interfaces)
5. [Execution Lifecycle](#execution-lifecycle)
6. [Configuration Examples](#configuration-examples)
7. [Advanced Use Cases](#advanced-use-cases)

---

## Overview

`stableFunction` is a generic function execution wrapper that applies resilience patterns (retries, caching, circuit breaking & rate limiting) to any synchronous or asynchronous function. It provides type-safe execution with full TypeScript generics for arguments and return types.

### Key Features

- ✅ **Type-Safe**: Full TypeScript generics for `TArgs extends any[]` and `TReturn`
- ✅ **Retry Logic**: Configurable retry strategies (FIXED, LINEAR, EXPONENTIAL)
- ✅ **Response Analysis**: Custom validation of response content for intelligent retries
- ✅ **Circuit Breaker**: Fail-fast protection with CLOSED → OPEN → HALF_OPEN states
- ✅ **Caching**: Function result caching with TTL and custom key generation
- ✅ **Rate Limiting**: Sliding-window rate limiter for controlled throughput
- ✅ **Concurrency Control**: Semaphore-based concurrency limiting
- ✅ **Observability**: Comprehensive hooks for logging, monitoring, and debugging
- ✅ **State Management**: Shared buffers and state persistence across attempts
- ✅ **Trial Mode**: Dry-run execution without side effects

### Function Signature

```typescript
async function stableFunction<TArgs extends any[] = any[], TReturn = any>(
  options: STABLE_FUNCTION<TArgs, TReturn>
): Promise<STABLE_FUNCTION_RESULT<TReturn>>
```

---

## Core Interface: STABLE_FUNCTION

The main configuration interface for executing functions with resilience patterns.

### Interface Definition

```typescript
interface STABLE_FUNCTION<TArgs extends any[] = any[], TReturn = any> {
  fn: (...args: TArgs) => TReturn | Promise<TReturn>;
  args: TArgs;
  responseAnalyzer?: (options: FunctionResponseAnalysisHookOptions<TArgs, TReturn>) => boolean | Promise<boolean>;
  returnResult?: boolean;
  attempts?: number;
  performAllAttempts?: boolean;
  wait?: number;
  maxAllowedWait?: number;
  retryStrategy?: RETRY_STRATEGY_TYPES;
  jitter?: number;
  logAllErrors?: boolean;
  handleErrors?: (options: HandleFunctionErrorHookOptions<TArgs>) => any | Promise<any>;
  logAllSuccessfulAttempts?: boolean;
  handleSuccessfulAttemptData?: (options: HandleSuccessfulFunctionAttemptDataHookOptions<TArgs, TReturn>) => any | Promise<any>;
  maxSerializableChars?: number;
  finalErrorAnalyzer?: (options: FinalFunctionErrorAnalysisHookOptions<TArgs>) => boolean | Promise<boolean>;
  trialMode?: TRIAL_MODE_OPTIONS;
  hookParams?: FunctionHookParams;
  preExecution?: FunctionPreExecutionOptions<TArgs, TReturn>;
  commonBuffer?: Record<string, any>;
  cache?: FunctionCacheConfig<TArgs, TReturn>;
  executionContext?: ExecutionContext;
  circuitBreaker?: CircuitBreakerConfig | CircuitBreaker;
  statePersistence?: StatePersistenceConfig;
  rateLimit?: RateLimitConfig;
  maxConcurrentRequests?: number;
  metricsGuardrails?: MetricsGuardrails;
}
```

### Field Descriptions

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `fn` | `(...args: TArgs) => TReturn \| Promise<TReturn>` | **Yes** | - | The function to execute. Can be sync or async. |
| `args` | `TArgs` | **Yes** | - | Array of arguments to pass to the function. |
| `responseAnalyzer` | `Function` | No | `() => true` | Hook to analyze function result and determine if retry is needed. Return `false` to trigger retry. |
| `returnResult` | `boolean` | No | `false` | If `true`, returns the actual function result in `data`. If `false`, returns `true` on success. |
| `attempts` | `number` | No | `1` | Maximum number of execution attempts (including initial attempt). |
| `performAllAttempts` | `boolean` | No | `false` | If `true`, executes all attempts regardless of success. Returns last successful result. |
| `wait` | `number` | No | `1000` | Base wait time in milliseconds between retries. |
| `maxAllowedWait` | `number` | No | `60000` | Maximum wait time cap in milliseconds (60 seconds). |
| `retryStrategy` | `RETRY_STRATEGIES` | No | `FIXED` | Retry strategy: `FIXED`, `LINEAR`, or `EXPONENTIAL`. |
| `jitter` | `number` | No | `0` | Random jitter in milliseconds to add to wait time (prevents thundering herd). |
| `logAllErrors` | `boolean` | No | `false` | If `true`, logs all errors via `handleErrors` hook. |
| `handleErrors` | `Function` | No | Console logger | Hook called for each error. Receives error log with attempt details. |
| `logAllSuccessfulAttempts` | `boolean` | No | `false` | If `true`, logs all successful attempts via `handleSuccessfulAttemptData` hook. |
| `handleSuccessfulAttemptData` | `Function` | No | Console logger | Hook called for each successful attempt. Receives attempt data. |
| `maxSerializableChars` | `number` | No | `1000` | Maximum characters for serializing objects in logs. |
| `finalErrorAnalyzer` | `Function` | No | `() => false` | Hook to analyze final error after all retries. Return `true` to treat as success. |
| `trialMode` | `TRIAL_MODE_OPTIONS` | No | `{ enabled: false }` | Dry-run mode for testing without side effects. |
| `hookParams` | `FunctionHookParams` | No | `{}` | Parameters to pass to hooks (responseAnalyzerParams, handleErrorsParams, etc.). |
| `preExecution` | `FunctionPreExecutionOptions` | No | `undefined` | Hook executed before function execution for dynamic configuration. |
| `commonBuffer` | `Record<string, any>` | No | `{}` | Shared mutable state accessible in all hooks. |
| `cache` | `FunctionCacheConfig` | No | `undefined` | Caching configuration for function results. |
| `executionContext` | `ExecutionContext` | No | `undefined` | Context metadata (workflowId, phaseId, etc.) for tracing. |
| `circuitBreaker` | `CircuitBreakerConfig \| CircuitBreaker` | No | `undefined` | Circuit breaker configuration or instance. |
| `statePersistence` | `StatePersistenceConfig` | No | `undefined` | State persistence configuration for external storage. |
| `rateLimit` | `RateLimitConfig` | No | `undefined` | Rate limiting configuration (maxRequests, windowMs). |
| `maxConcurrentRequests` | `number` | No | `undefined` | Maximum number of concurrent executions (semaphore). |
| `metricsGuardrails` | `MetricsGuardrails` | No | `undefined` | Metrics validation guardrails with min/max thresholds for function metrics. |

---

## Result Interface: STABLE_FUNCTION_RESULT

The result object returned by `stableFunction`.

### Interface Definition

```typescript
interface STABLE_FUNCTION_RESULT<TReturn = any> {
  success: boolean;
  data?: TReturn;
  error?: string;
  errorLogs?: FUNCTION_ERROR_LOG[];
  successfulAttempts?: SUCCESSFUL_FUNCTION_ATTEMPT_DATA<TReturn>[];
  metrics?: {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    totalExecutionTime: number;
    averageAttemptTime: number;
    validation?: MetricsValidationResult;
    infrastructureMetrics?: {
      circuitBreaker?: CircuitBreakerDashboardMetrics;
      cache?: CacheDashboardMetrics;
      rateLimiter?: RateLimiterDashboardMetrics;
      concurrencyLimiter?: ConcurrencyLimiterDashboardMetrics;
    };
  };
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Indicates if function execution succeeded. |
| `data` | `TReturn?` | Function result (if `returnResult: true`). Otherwise `true` on success. |
| `error` | `string?` | Error message if execution failed. |
| `errorLogs` | `FUNCTION_ERROR_LOG[]?` | Array of all error logs from failed attempts. |
| `successfulAttempts` | `SUCCESSFUL_FUNCTION_ATTEMPT_DATA<TReturn>[]?` | Array of all successful attempt data (if `logAllSuccessfulAttempts: true`). |
| `metrics` | `Object?` | Execution metrics including attempts, timing, infrastructure stats, and validation results. |
| `metrics.validation` | `MetricsValidationResult?` | Validation results when `metricsGuardrails` are configured. |

### Supporting Interfaces

#### FUNCTION_ERROR_LOG

```typescript
interface FUNCTION_ERROR_LOG {
  timestamp: string;       // ISO 8601 timestamp
  executionTime: number;   // Execution time in milliseconds
  attempt: string;         // Format: "1/3" (current/total)
  error: string;           // Error message
  isRetryable: boolean;    // Whether the error allows retry
}
```

#### SUCCESSFUL_FUNCTION_ATTEMPT_DATA

```typescript
interface SUCCESSFUL_FUNCTION_ATTEMPT_DATA<TReturn = any> {
  attempt: string;         // Format: "1/3"
  timestamp: string;       // ISO 8601 timestamp
  executionTime: number;   // Execution time in milliseconds
  data: TReturn;           // Function result
}
```

---

## Hook Interfaces

### 1. FunctionPreExecutionOptions

Executed before function execution for dynamic configuration.

```typescript
interface FunctionPreExecutionOptions<TArgs extends any[] = any[], TReturn = any> {
  preExecutionHook: (options: FunctionPreExecutionHookOptions<TArgs, TReturn>) => any | Promise<any>;
  preExecutionHookParams?: any;
  applyPreExecutionConfigOverride?: boolean;
  continueOnPreExecutionHookFailure?: boolean;
}
```

**FunctionPreExecutionHookOptions:**

| Field | Type | Description |
|-------|------|-------------|
| `inputParams` | `any?` | Parameters from `preExecutionHookParams`. |
| `commonBuffer` | `Record<string, any>?` | Shared mutable state. |
| `stableFunctionOptions` | `STABLE_FUNCTION<TArgs, TReturn>` | Full function configuration. |

**Usage:**
- Modify function arguments dynamically
- Inject authentication tokens
- Load configuration from external sources
- Return partial `STABLE_FUNCTION` object to override configuration (if `applyPreExecutionConfigOverride: true`)

---

### 2. FunctionResponseAnalysisHookOptions

Analyze function result to determine success/failure.

```typescript
interface FunctionResponseAnalysisHookOptions<TArgs extends any[] = any[], TReturn = any> {
  fn: (...args: TArgs) => any;
  args: TArgs;
  data: TReturn;
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
  // Retry if result is null or undefined
  return data != null;
}
```

---

### 3. HandleFunctionErrorHookOptions

Called for each error when `logAllErrors: true`.

```typescript
interface HandleFunctionErrorHookOptions<TArgs extends any[] = any[]> {
  fn: (...args: TArgs) => any;
  args: TArgs;
  errorLog: FUNCTION_ERROR_LOG;
  params?: any;
  maxSerializableChars?: number;
  preExecutionResult?: any;
  commonBuffer?: Record<string, any>;
  executionContext?: ExecutionContext;
}
```

**Use Cases:**
- Log to external monitoring systems (Datadog, Sentry)
- Trigger alerts for critical errors
- Store error history in database
- Update metrics dashboards

---

### 4. HandleSuccessfulFunctionAttemptDataHookOptions

Called for each successful attempt when `logAllSuccessfulAttempts: true`.

```typescript
interface HandleSuccessfulFunctionAttemptDataHookOptions<TArgs extends any[] = any[], TReturn = any> {
  fn: (...args: TArgs) => any;
  args: TArgs;
  successfulAttemptData: SUCCESSFUL_FUNCTION_ATTEMPT_DATA<TReturn>;
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
- Store results in buffer for downstream functions
- Update dashboards with success rates

---

### 5. FinalFunctionErrorAnalysisHookOptions

Analyze final error after all retries exhausted.

```typescript
interface FinalFunctionErrorAnalysisHookOptions<TArgs extends any[] = any[]> {
  fn: (...args: TArgs) => any;
  args: TArgs;
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
  // Treat timeout errors as acceptable failures
  if (error.message.includes('timeout')) {
    return true; // Don't throw
  }
  return false; // Re-throw
}
```

---

### 6. FunctionHookParams

Container for parameters passed to hooks.

```typescript
interface FunctionHookParams {
  responseAnalyzerParams?: any;
  handleSuccessfulAttemptDataParams?: any;
  handleErrorsParams?: any;
  finalErrorAnalyzerParams?: any;
}
```

**Usage:**
```typescript
stableFunction({
  fn: myFunction,
  args: [arg1, arg2],
  hookParams: {
    responseAnalyzerParams: { threshold: 100 },
    handleErrorsParams: { alertEmail: 'admin@example.com' }
  },
  responseAnalyzer: ({ data, params }) => {
    // Access params.threshold here
    return data > params.threshold;
  }
});
```

---

## Execution Lifecycle

The following diagram illustrates the complete lifecycle of a `stableFunction` execution:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INITIALIZATION                                               │
│    - Validate trialMode probabilities                           │
│    - Initialize circuit breaker (if configured)                 │
│    - Initialize rate limiter (if configured)                    │
│    - Initialize concurrency limiter (if configured)             │
│    - Initialize metrics collection                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 2. PRE-EXECUTION HOOK (Optional)                                │
│    - Execute preExecutionHook with context                      │
│    - Load state from statePersistence (if configured)           │
│    - Apply configuration overrides (if enabled)                 │
│    - Continue on failure (if continueOnPreExecutionHookFailure) │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 3. ATTEMPT LOOP (Do-While: attempts > 0)                        │
│    ┌────────────────────────────────────────────────────┐       │
│    │ 3a. Circuit Breaker Check                          │       │
│    │     - Check canExecute() if configured             │       │
│    │     - Throw CircuitBreakerOpenError if OPEN        │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 3b. Rate Limiting & Concurrency Control            │       │
│    │     - Acquire rate limit token                     │       │
│    │     - Acquire concurrency semaphore                │       │
│    │     - Execute function (fnExec)                    │       │
│    │     - Check cache (if enabled)                     │       │
│    │     - Release concurrency semaphore                │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 3c. Cache Check                                    │       │
│    │     - If cache hit: Return immediately             │       │
│    │     - If cache miss: Continue to response analysis │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 3d. Response Analysis (if res.ok)                  │       │
│    │     - Execute responseAnalyzer hook                │       │
│    │     - Determine if retry needed:                   │       │
│    │       • true: Success, stop retrying               │       │
│    │       • false: Retry needed                        │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 3e. Circuit Breaker Update                         │       │
│    │     - Record success/failure                       │       │
│    │     - Check if state changed to OPEN               │       │
│    │     - Throw if opened (blocks further retries)     │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 3f. Error Logging (if logAllErrors: true)          │       │
│    │     - Create error log entry                       │       │
│    │     - Execute handleErrors hook                    │       │
│    │     - Store state (if statePersistence configured) │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 3g. Success Logging (if logAllSuccessfulAttempts)  │       │
│    │     - Create success log entry                     │       │
│    │     - Execute handleSuccessfulAttemptData hook     │       │
│    │     - Store in successfulAttemptsList              │       │
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
│    │     - Return last successful result                │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 4b. If res.ok (Normal Success)                     │       │
│    │     - Return result with data                      │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 4c. If All Attempts Failed                         │       │
│    │     - Throw error                                  │       │
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
│    - Includes data (if returnResult: true)                      │
│    - Includes error logs                                        │
│    - Includes successful attempts                               │
│    - Includes comprehensive metrics                             │
│    - Includes infrastructure metrics (CB, cache, rate, conc.)   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Lifecycle Points

1. **Pre-Execution**: State loading, dynamic configuration
2. **Per-Attempt**: Circuit breaker check, rate limiting, execution, analysis
3. **Post-Attempt**: Error/success logging, state persistence
4. **Between Attempts**: Delay calculation with retry strategy and jitter
5. **Post-Execution**: Final error analysis, metrics aggregation
6. **Return**: Comprehensive result with logs, metrics, and infrastructure stats

---

## Configuration Examples

### Example 1: Basic Function with Retry

```typescript
import { stableFunction, RETRY_STRATEGIES } from '@emmvish/stable-request';

const fetchData = async (userId: number): Promise<{ name: string; email: string }> => {
  const response = await fetch(`https://api.example.com/users/${userId}`);
  return response.json();
};

const result = await stableFunction<[number], { name: string; email: string }>({
  fn: fetchData,
  args: [123],
  returnResult: true,
  attempts: 3,
  wait: 500,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
  jitter: 100,
  responseAnalyzer: ({ data }) => {
    // Retry if data is incomplete
    return data?.name != null && data?.email != null;
  }
});

if (result.success) {
  console.log('User:', result.data);
} else {
  console.error('Failed after 3 attempts:', result.error);
}
```

### Example 2: Function with Caching

```typescript
import { stableFunction } from '@emmvish/stable-request';

const expensiveCalculation = (a: number, b: number): number => {
  // Simulate expensive operation
  let result = 0;
  for (let i = 0; i < 1000000; i++) {
    result += a * b;
  }
  return result;
};

const result = await stableFunction<[number, number], number>({
  fn: expensiveCalculation,
  args: [5, 10],
  returnResult: true,
  cache: {
    enabled: true,
    ttl: 60000, // 1 minute
    keyGenerator: (fn, args) => `calc_${args[0]}_${args[1]}`
  }
});

// Second call with same args returns cached result instantly
const cachedResult = await stableFunction<[number, number], number>({
  fn: expensiveCalculation,
  args: [5, 10],
  returnResult: true,
  cache: { enabled: true, ttl: 60000 }
});

console.log('Cache hit:', cachedResult.metrics?.infrastructureMetrics?.cache?.hitRate);
```

### Example 3: Function with Circuit Breaker

```typescript
import { stableFunction, CircuitBreaker } from '@emmvish/stable-request';

const breaker = new CircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 5,
  recoveryTimeoutMs: 30000
});

const unreliableService = async (data: string): Promise<string> => {
  // Simulates unreliable service
  if (Math.random() < 0.6) {
    throw new Error('Service unavailable');
  }
  return `Processed: ${data}`;
};

// Multiple calls share the same circuit breaker
for (let i = 0; i < 10; i++) {
  try {
    const result = await stableFunction<[string], string>({
      fn: unreliableService,
      args: [`data-${i}`],
      returnResult: true,
      attempts: 2,
      circuitBreaker: breaker,
      handleErrors: ({ errorLog }) => {
        console.log(`Attempt ${errorLog.attempt} failed`);
      }
    });
    
    if (result.success) {
      console.log('Success:', result.data);
    }
  } catch (e) {
    console.log('Circuit breaker blocked or all attempts failed');
  }
}

// Check circuit breaker state
console.log('CB State:', breaker.getState().state); // OPEN, CLOSED, or HALF_OPEN
```

### Example 4: Function with Rate Limiting and Concurrency

```typescript
import { stableFunction } from '@emmvish/stable-request';

const processItem = async (itemId: number): Promise<{ processed: boolean }> => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 100));
  return { processed: true };
};

// Process 20 items with rate and concurrency limits
const results = await Promise.all(
  Array.from({ length: 20 }, (_, i) => 
    stableFunction<[number], { processed: boolean }>({
      fn: processItem,
      args: [i],
      returnResult: true,
      rateLimit: {
        maxRequests: 5,    // Max 5 requests
        windowMs: 1000     // per second
      },
      maxConcurrentRequests: 3 // Max 3 simultaneous executions
    })
  )
);

const successCount = results.filter(r => r.success).length;
console.log(`Processed ${successCount}/20 items`);
console.log('Rate limiter stats:', results[0].metrics?.infrastructureMetrics?.rateLimiter);
```

### Example 5: Function with Pre-Execution Hook

```typescript
import { stableFunction } from '@emmvish/stable-request';

interface ApiConfig {
  baseUrl: string;
  apiKey: string;
}

const getAuthToken = async (): Promise<string> => {
  // Fetch dynamic auth token
  return `Bearer token-${Date.now()}`;
};

const apiCall = async (url: string, token: string): Promise<any> => {
  const response = await fetch(url, {
    headers: { 'Authorization': token }
  });
  return response.json();
};

const result = await stableFunction<[string, string], any>({
  fn: apiCall,
  args: ['https://api.example.com/data', ''], // Token placeholder
  returnResult: true,
  attempts: 3,
  preExecution: {
    preExecutionHook: async ({ stableFunctionOptions, commonBuffer }) => {
      // Fetch token dynamically before execution
      const token = await getAuthToken();
      
      // Store in buffer for access in other hooks
      commonBuffer!.authToken = token;
      
      // Override args with actual token
      return {
        args: ['https://api.example.com/data', token]
      };
    },
    applyPreExecutionConfigOverride: true,
    continueOnPreExecutionHookFailure: false
  }
});

console.log('Result:', result.data);
```

### Example 6: Function with Observability Hooks

```typescript
import { stableFunction } from '@emmvish/stable-request';

const dataProcessor = async (data: any[]): Promise<{ count: number }> => {
  if (data.length === 0) {
    throw new Error('Empty data');
  }
  return { count: data.length };
};

const result = await stableFunction<[any[]], { count: number }>({
  fn: dataProcessor,
  args: [[1, 2, 3]],
  returnResult: true,
  attempts: 3,
  wait: 500,
  
  logAllErrors: true,
  handleErrors: ({ errorLog, fn, args, executionContext }) => {
    // Send to monitoring system
    console.error(`[ERROR] ${fn.name} - Attempt ${errorLog.attempt}`, {
      error: errorLog.error,
      args,
      timestamp: errorLog.timestamp,
      isRetryable: errorLog.isRetryable,
      workflowId: executionContext?.workflowId
    });
    
    // Could trigger alerts, store in database, etc.
  },
  
  logAllSuccessfulAttempts: true,
  handleSuccessfulAttemptData: ({ successfulAttemptData, fn }) => {
    // Track success metrics
    console.log(`[SUCCESS] ${fn.name} - Attempt ${successfulAttemptData.attempt}`, {
      executionTime: successfulAttemptData.executionTime,
      timestamp: successfulAttemptData.timestamp,
      result: successfulAttemptData.data
    });
  },
  
  responseAnalyzer: ({ data, params }) => {
    // Custom validation
    const isValid = data?.count > 0;
    console.log(`[ANALYSIS] Result validation: ${isValid}`);
    return isValid;
  },
  
  finalErrorAnalyzer: ({ error, fn }) => {
    console.log(`[FINAL ERROR] ${fn.name} failed:`, error.message);
    // Return false to re-throw, true to suppress
    return false;
  },
  
  executionContext: {
    workflowId: 'workflow-123',
    phaseId: 'phase-1'
  }
});

console.log('Metrics:', result.metrics);
```

### Example 7: Function with State Persistence

```typescript
import { stableFunction } from '@emmvish/stable-request';

const externalStorage = new Map<string, any>();

const batchProcessor = async (items: any[]): Promise<{ processed: number }> => {
  // Simulate processing that might fail
  if (Math.random() < 0.3) {
    throw new Error('Processing failed');
  }
  return { processed: items.length };
};

const result = await stableFunction<[any[]], { processed: number }>({
  fn: batchProcessor,
  args: [Array(100).fill({ id: 1 })],
  returnResult: true,
  attempts: 5,
  wait: 1000,
  
  commonBuffer: {
    processedCount: 0,
    lastCheckpoint: null
  },
  
  statePersistence: {
    persistenceFunction: async ({ executionContext, buffer, params }) => {
      const key = `fn_${executionContext.workflowId}_state`;
      
      if (params?.operation === 'load') {
        const state = externalStorage.get(key);
        console.log('[LOAD] Restored state:', state);
        return state || buffer;
      } else {
        // Save state
        externalStorage.set(key, buffer);
        console.log('[SAVE] Persisted state:', buffer);
        return buffer;
      }
    },
    persistenceParams: { operation: 'save' },
    loadBeforeHooks: true,
    storeAfterHooks: true
  },
  
  handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
    // Update persisted state
    commonBuffer!.processedCount += successfulAttemptData.data.processed;
    commonBuffer!.lastCheckpoint = successfulAttemptData.timestamp;
  },
  
  executionContext: {
    workflowId: 'batch-job-456'
  }
});

console.log('Processed:', result.data);
console.log('Persisted states:', Array.from(externalStorage.keys()));
```

### Example 8: Function with Trial Mode

```typescript
import { stableFunction } from '@emmvish/stable-request';

const criticalOperation = async (value: number): Promise<number> => {
  // This won't actually execute in trial mode
  console.log('Executing critical operation');
  return value * 2;
};

const result = await stableFunction<[number], number>({
  fn: criticalOperation,
  args: [50],
  returnResult: true,
  attempts: 3,
  wait: 500,
  
  trialMode: {
    enabled: true,
    reqFailureProbability: 0.4,      // 40% chance of failure
    retryFailureProbability: 0.9     // 90% chance retries fail
  },
  
  handleErrors: ({ errorLog }) => {
    console.log('[TRIAL] Simulated error:', errorLog.error);
  },
  
  handleSuccessfulAttemptData: ({ successfulAttemptData }) => {
    console.log('[TRIAL] Simulated success:', successfulAttemptData.data);
  }
});

// In trial mode:
// - No actual function execution
// - Simulates successes/failures based on probabilities
// - Tests retry logic safely
// - Validates hooks and configuration

console.log('Trial result:', result);
```

---

## Advanced Use Cases

### Use Case 1: Database Transaction with Retry

```typescript
import { stableFunction } from '@emmvish/stable-request';

interface Transaction {
  execute: () => Promise<void>;
  rollback: () => Promise<void>;
}

const performTransaction = async (tx: Transaction): Promise<boolean> => {
  try {
    await tx.execute();
    return true;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

const result = await stableFunction<[Transaction], boolean>({
  fn: performTransaction,
  args: [myTransaction],
  returnResult: true,
  attempts: 3,
  wait: 1000,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
  
  responseAnalyzer: ({ data }) => {
    // Only retry if transaction explicitly failed
    return data === true;
  },
  
  handleErrors: ({ errorLog, args }) => {
    console.error('Transaction failed:', errorLog);
    // Could implement compensation logic here
  }
});
```

### Use Case 2: Function Chain with Buffer Passing

```typescript
import { stableFunction } from '@emmvish/stable-request';

const sharedBuffer: Record<string, any> = {};

// Step 1: Fetch data
const step1 = await stableFunction({
  fn: async (id: number) => ({ id, data: 'user data' }),
  args: [1],
  returnResult: true,
  commonBuffer: sharedBuffer,
  handleSuccessfulAttemptData: ({ data, commonBuffer }) => {
    commonBuffer!.userData = data;
  }
});

// Step 2: Transform data (uses buffer from step 1)
const step2 = await stableFunction({
  fn: async (data: any) => ({ transformed: data.data.toUpperCase() }),
  args: [null], // Placeholder
  returnResult: true,
  commonBuffer: sharedBuffer,
  preExecution: {
    preExecutionHook: ({ commonBuffer }) => {
      return { args: [commonBuffer!.userData] };
    },
    applyPreExecutionConfigOverride: true
  }
});

console.log('Final result:', step2.data);
```

### Use Case 3: Parallel Function Execution with Shared Circuit Breaker

```typescript
import { stableFunction, CircuitBreaker } from '@emmvish/stable-request';

const sharedBreaker = new CircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 10,
  recoveryTimeoutMs: 30000
});

const tasks = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  fn: async (taskId: number) => {
    // Simulate work
    if (Math.random() < 0.3) throw new Error('Task failed');
    return { taskId, result: 'success' };
  }
}));

const results = await Promise.allSettled(
  tasks.map(task =>
    stableFunction({
      fn: task.fn,
      args: [task.id],
      returnResult: true,
      attempts: 2,
      circuitBreaker: sharedBreaker
    })
  )
);

const succeeded = results.filter(r => r.status === 'fulfilled').length;
console.log(`${succeeded}/${tasks.length} tasks succeeded`);
console.log('Circuit breaker state:', sharedBreaker.getState().state);
```

### Use Case 4: Function with Custom Metrics Collection

```typescript
import { stableFunction } from '@emmvish/stable-request';

class MetricsCollector {
  private metrics: any[] = [];
  
  record(metric: any) {
    this.metrics.push({ ...metric, timestamp: Date.now() });
  }
  
  getMetrics() {
    return this.metrics;
  }
}

const collector = new MetricsCollector();

const result = await stableFunction({
  fn: async (value: number) => value * 2,
  args: [10],
  returnResult: true,
  attempts: 3,
  
  handleSuccessfulAttemptData: ({ successfulAttemptData }) => {
    collector.record({
      type: 'success',
      attempt: successfulAttemptData.attempt,
      executionTime: successfulAttemptData.executionTime
    });
  },
  
  handleErrors: ({ errorLog }) => {
    collector.record({
      type: 'error',
      attempt: errorLog.attempt,
      error: errorLog.error
    });
  }
});

// Aggregate and analyze metrics
const allMetrics = collector.getMetrics();
console.log('Total attempts:', allMetrics.length);
console.log('Success rate:', 
  allMetrics.filter(m => m.type === 'success').length / allMetrics.length
);
```

---

## Best Practices

1. **Type Safety**: Always specify generic types for better IntelliSense and compile-time safety
   ```typescript
   stableFunction<[number, string], Promise<Result>>({ ... })
   ```

2. **Return Result**: Set `returnResult: true` when you need the actual function result
   ```typescript
   { returnResult: true } // Returns actual result
   { returnResult: false } // Returns true on success (default)
   ```

3. **Error Handling**: Use `logAllErrors` and `handleErrors` for production monitoring
   ```typescript
   {
     logAllErrors: true,
     handleErrors: ({ errorLog }) => {
       // Send to monitoring system
       trackError(errorLog);
     }
   }
   ```

4. **Response Analysis**: Implement custom `responseAnalyzer` for domain-specific validation
   ```typescript
   {
     responseAnalyzer: ({ data }) => {
       // Custom validation logic
       return data?.status === 'success' && data?.items?.length > 0;
     }
   }
   ```

5. **Caching Strategy**: Use caching for expensive computations with stable inputs
   ```typescript
   {
     cache: {
       enabled: true,
       ttl: 300000, // 5 minutes
       keyGenerator: (fn, args) => `${fn.name}_${JSON.stringify(args)}`
     }
   }
   ```

6. **Circuit Breaker Sharing**: Share circuit breaker instances across related functions
   ```typescript
   const breaker = new CircuitBreaker({ ... });
   // Use same breaker for multiple functions calling same service
   ```

7. **Rate Limiting**: Apply rate limits to respect external API constraints
   ```typescript
   {
     rateLimit: { maxRequests: 100, windowMs: 60000 }, // 100 req/min
     maxConcurrentRequests: 10 // Max 10 parallel
   }
   ```

8. **State Persistence**: Use for long-running operations that might be interrupted
   ```typescript
   {
     statePersistence: {
       persistenceFunction: async ({ buffer }) => {
         await saveToDatabase(buffer);
         return buffer;
       },
       storeAfterHooks: true
     }
   }
   ```

9. **Trial Mode**: Test configurations safely before production deployment
   ```typescript
   {
     trialMode: { enabled: true, reqFailureProbability: 0.5 }
   }
   ```

10. **Execution Context**: Add context for distributed tracing
    ```typescript
    {
      executionContext: {
        workflowId: 'wf-123',
        requestId: 'req-456'
      }
    }
    ```

11. **Metrics Guardrails**: Validate execution metrics
    ```typescript
    {
      metricsGuardrails: {
        request: {
          totalAttempts: { max: 5 },
          failedAttempts: { max: 2 },
          totalExecutionTime: { max: 3000 }
        }
      }
    }
    ```

---

## Metrics Guardrails and Validation

Metrics guardrails allow you to define validation rules for function execution metrics. Validation results are included in the response when guardrails are configured.

### Configuring Metrics Guardrails

```typescript
const result = await stableFunction({
  fn: myAsyncFunction,
  args: [param1, param2],
  attempts: 5,
  metricsGuardrails: {
    request: {  // Note: Uses 'request' key for compatibility
      totalAttempts: { max: 5 },
      successfulAttempts: { min: 1 },
      failedAttempts: { max: 3 },
      totalExecutionTime: { max: 10000 },
      averageAttemptTime: { max: 2000 }
    }
  }
});
```

### Available Metrics

The same metrics as `stableRequest` are available:

| Metric | Type | Description |
|--------|------|-------------|
| `totalAttempts` | `number` | Total number of function execution attempts |
| `successfulAttempts` | `number` | Number of successful executions |
| `failedAttempts` | `number` | Number of failed executions |
| `totalExecutionTime` | `number` | Total execution time in milliseconds |
| `averageAttemptTime` | `number` | Average time per attempt in milliseconds |

### Checking Validation Results

```typescript
const result = await stableFunction({
  fn: async () => fetchData(),
  args: [],
  attempts: 3,
  metricsGuardrails: {
    request: {
      totalExecutionTime: { max: 5000 },
      failedAttempts: { max: 1 }
    }
  }
});

if (result.metrics?.validation) {
  if (!result.metrics.validation.isValid) {
    console.warn('Function metrics validation failed:');
    result.metrics.validation.anomalies.forEach(anomaly => {
      console.warn(`${anomaly.metricName}: ${anomaly.reason} (${anomaly.severity})`);
    });
  }
}
```

### Use Cases

1. **Performance Monitoring**: Track function execution performance
   ```typescript
   metricsGuardrails: {
     request: {
       totalExecutionTime: { max: 3000 },
       averageAttemptTime: { max: 1000 }
     }
   }
   ```

2. **Reliability Tracking**: Ensure successful execution
   ```typescript
   metricsGuardrails: {
     request: {
       successfulAttempts: { min: 1 },
       failedAttempts: { max: 2 }
     }
   }
   ```

3. **Retry Monitoring**: Alert on excessive retries
   ```typescript
   metricsGuardrails: {
     request: {
       totalAttempts: { expected: 1, tolerance: 50 }  // Expect 1, allow up to 1-2 attempts
     }
   }
   ```

For detailed information on the validation result structure and severity levels, see the [stable-request documentation](./stable-request.md#metrics-guardrails-and-validation).

---

## Support

For issues, questions, or contributions:

- **GitHub**: [https://github.com/emmvish/stable-request](https://github.com/emmvish/stable-request)
- **NPM**: [https://www.npmjs.com/package/@emmvish/stable-request](https://www.npmjs.com/package/@emmvish/stable-request)
- **Issues**: [https://github.com/emmvish/stable-request/issues](https://github.com/emmvish/stable-request/issues)
