# Stable API Gateway API Reference

## Table of Contents

1. [Overview](#overview)
2. [Core Interface: API_GATEWAY_OPTIONS](#core-interface-api_gateway_options)
3. [Request and Function Interfaces](#request-and-function-interfaces)
4. [Result Interface: API_GATEWAY_RESULT](#result-interface-api_gateway_result)
5. [Execution Lifecycle](#execution-lifecycle)
6. [Configuration Examples](#configuration-examples)
7. [Advanced Use Cases](#advanced-use-cases)
8. [Best Practices](#best-practices)

---

## Overview

`stableApiGateway` is a powerful orchestration tool that executes multiple HTTP requests and/or functions with resilience patterns. It provides centralized configuration, request grouping, concurrent/sequential execution, and comprehensive observability for batch operations.

### Key Features

- ✅ **Batch Execution**: Execute multiple HTTP requests and functions together
- ✅ **Mixed Operations**: Combine HTTP requests and function calls in single gateway
- ✅ **Concurrent/Sequential**: Choose parallel or sequential execution modes
- ✅ **Request Grouping**: Organize requests into logical groups with shared config
- ✅ **Config Cascading**: Global → Group → Individual configuration hierarchy
- ✅ **Shared State**: Pass data between requests via `sharedBuffer`
- ✅ **Circuit Breaker**: Shared circuit breaker across all requests/functions
- ✅ **Rate Limiting**: Global rate limiter for controlled throughput
- ✅ **Concurrency Control**: Limit parallel executions with semaphore
- ✅ **Comprehensive Metrics**: Aggregated success rates, group metrics, infrastructure stats

### Function Signatures

```typescript
// Requests only
async function stableApiGateway<RequestDataType = any, ResponseDataType = any>(
  requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[],
  options: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>
): Promise<API_GATEWAY_RESULT<ResponseDataType>>

// Requests and functions
async function stableApiGateway<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
  requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[],
  functions: API_GATEWAY_FUNCTION<FunctionArgsType, FunctionReturnType>[],
  options: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
): Promise<API_GATEWAY_RESULT<ResponseDataType | FunctionReturnType>>

// Mixed items (unified API)
async function stableApiGateway<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
  items: API_GATEWAY_ITEM<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[],
  options: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
): Promise<API_GATEWAY_RESULT<ResponseDataType | FunctionReturnType>>
```

---

## Core Interface: API_GATEWAY_OPTIONS

The main configuration interface for the API Gateway.

### Interface Definition

```typescript
interface API_GATEWAY_OPTIONS<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  // Request-specific common config
  commonRequestData?: Partial<REQUEST_DATA<RequestDataType>>;
  commonAttempts?: number;
  commonHookParams?: HookParams;
  commonPerformAllAttempts?: boolean;
  commonWait?: number;
  commonMaxAllowedWait?: number;
  commonRetryStrategy?: RETRY_STRATEGY_TYPES;
  commonJitter?: number;
  commonLogAllErrors?: boolean;
  commonLogAllSuccessfulAttempts?: boolean;
  commonMaxSerializableChars?: number;
  commonTrialMode?: TRIAL_MODE_OPTIONS;
  commonResponseAnalyzer?: (options: ResponseAnalysisHookOptions<RequestDataType, ResponseDataType>) => boolean | Promise<boolean>;
  commonResReq?: boolean;
  commonFinalErrorAnalyzer?: (options: FinalErrorAnalysisHookOptions<RequestDataType>) => boolean | Promise<boolean>;
  commonHandleErrors?: (options: HandleErrorHookOptions<RequestDataType>) => any | Promise<any>;
  commonHandleSuccessfulAttemptData?: (options: HandleSuccessfulAttemptDataHookOptions<RequestDataType, ResponseDataType>) => any | Promise<any>;
  commonPreExecution?: RequestPreExecutionOptions;
  commonCache?: CacheConfig;
  commonStatePersistence?: StatePersistenceConfig;
  
  // Function-specific common config
  commonFunctionHookParams?: FunctionHookParams;
  commonFunctionResponseAnalyzer?: <TArgs extends any[], TReturn>(options: FunctionResponseAnalysisHookOptions<TArgs, TReturn>) => boolean | Promise<boolean>;
  commonReturnResult?: boolean;
  commonFinalFunctionErrorAnalyzer?: <TArgs extends any[]>(options: FinalFunctionErrorAnalysisHookOptions<TArgs>) => boolean | Promise<boolean>;
  commonHandleFunctionErrors?: <TArgs extends any[]>(options: HandleFunctionErrorHookOptions<TArgs>) => any | Promise<any>;
  commonHandleSuccessfulFunctionAttemptData?: <TArgs extends any[], TReturn>(options: HandleSuccessfulFunctionAttemptDataHookOptions<TArgs, TReturn>) => any | Promise<any>;
  commonFunctionPreExecution?: <TArgs extends any[], TReturn>(options: FunctionPreExecutionOptions<TArgs, TReturn>) => any;
  commonFunctionCache?: <TArgs extends any[], TReturn>(config: FunctionCacheConfig<TArgs, TReturn>) => any;
  
  // Gateway-specific config
  concurrentExecution?: boolean;
  requestGroups?: RequestGroup<RequestDataType, ResponseDataType>[];
  stopOnFirstError?: boolean;
  sharedBuffer?: Record<string, any>;
  maxConcurrentRequests?: number;
  rateLimit?: RateLimitConfig;
  circuitBreaker?: CircuitBreakerConfig;
  executionContext?: Partial<ExecutionContext>;
}
```

### Field Descriptions

#### Request Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `commonRequestData` | `Partial<REQUEST_DATA<RequestDataType>>` | `{}` | Common HTTP config (hostname, headers, etc.) merged into all requests. |
| `commonAttempts` | `number` | `1` | Default max attempts for all requests. |
| `commonWait` | `number` | `1000` | Default wait time (ms) between retries for requests. |
| `commonMaxAllowedWait` | `number` | `60000` | Default max wait cap (ms) for requests. |
| `commonRetryStrategy` | `RETRY_STRATEGIES` | `FIXED` | Default retry strategy for requests (FIXED, LINEAR, EXPONENTIAL). |
| `commonJitter` | `number` | `0` | Default jitter (ms) for requests. |
| `commonPerformAllAttempts` | `boolean` | `false` | Default performAllAttempts flag for requests. |
| `commonResReq` | `boolean` | `false` | Default resReq flag for requests. |
| `commonLogAllErrors` | `boolean` | `false` | Default error logging flag for requests. |
| `commonLogAllSuccessfulAttempts` | `boolean` | `false` | Default success logging flag for requests. |
| `commonMaxSerializableChars` | `number` | `1000` | Default max serializable chars for requests. |
| `commonTrialMode` | `TRIAL_MODE_OPTIONS` | `{ enabled: false }` | Default trial mode for requests. |
| `commonResponseAnalyzer` | `Function` | `() => true` | Default response analyzer for requests. |
| `commonFinalErrorAnalyzer` | `Function` | `() => false` | Default final error analyzer for requests. |
| `commonHandleErrors` | `Function` | Console logger | Default error handler for requests. |
| `commonHandleSuccessfulAttemptData` | `Function` | Console logger | Default success handler for requests. |
| `commonHookParams` | `HookParams` | `{}` | Default hook parameters for requests. |
| `commonPreExecution` | `RequestPreExecutionOptions` | `undefined` | Default pre-execution hook for requests. |
| `commonCache` | `CacheConfig` | `undefined` | Default cache config for requests. |
| `commonStatePersistence` | `StatePersistenceConfig` | `undefined` | Default state persistence for requests. |

#### Function Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `commonReturnResult` | `boolean` | `false` | Default returnResult flag for functions. |
| `commonFunctionResponseAnalyzer` | `Function` | `() => true` | Default response analyzer for functions. |
| `commonFinalFunctionErrorAnalyzer` | `Function` | `() => false` | Default final error analyzer for functions. |
| `commonHandleFunctionErrors` | `Function` | Console logger | Default error handler for functions. |
| `commonHandleSuccessfulFunctionAttemptData` | `Function` | Console logger | Default success handler for functions. |
| `commonFunctionHookParams` | `FunctionHookParams` | `{}` | Default hook parameters for functions. |
| `commonFunctionPreExecution` | `Function` | `undefined` | Default pre-execution hook for functions. |
| `commonFunctionCache` | `Function` | `undefined` | Default cache config for functions. |

#### Gateway Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `concurrentExecution` | `boolean` | `true` | Execute requests/functions concurrently (true) or sequentially (false). |
| `stopOnFirstError` | `boolean` | `false` | Stop execution immediately on first error. |
| `requestGroups` | `RequestGroup[]` | `[]` | Logical groups with shared configuration. |
| `sharedBuffer` | `Record<string, any>` | `{}` | Shared mutable state accessible across all requests/functions. |
| `maxConcurrentRequests` | `number` | `undefined` | Global concurrency limit (semaphore). |
| `rateLimit` | `RateLimitConfig` | `undefined` | Global rate limiter config. |
| `circuitBreaker` | `CircuitBreakerConfig` | `undefined` | Global circuit breaker config. |
| `executionContext` | `Partial<ExecutionContext>` | `undefined` | Context metadata for tracing. |

### RequestGroup Interface

```typescript
interface RequestGroup<RequestDataType = any, ResponseDataType = any> {
  id: string;
  commonConfig?: Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, 
    "concurrentExecution" | "stopOnFirstError" | "requestGroups" | 
    "maxConcurrentRequests" | "rateLimit" | "circuitBreaker">
}
```

Groups allow organizing requests with shared configuration:
- **id**: Unique group identifier
- **commonConfig**: Group-level configuration that overrides global config

### Configuration Cascade

Configuration priority (highest to lowest):
1. **Individual Request/Function** - Specific to each item
2. **Request Group** - Applies to all items in the group
3. **Global (common*)** - Applies to all requests/functions

Example:
```typescript
stableApiGateway(requests, {
  commonAttempts: 3,          // Global: 3 attempts
  requestGroups: [
    {
      id: 'critical',
      commonConfig: {
        commonAttempts: 5     // Group: 5 attempts for critical requests
      }
    }
  ]
});

// Request with individual config
{
  id: 'req-1',
  groupId: 'critical',
  requestOptions: {
    attempts: 7               // Individual: 7 attempts (highest priority)
  }
}
```

---

## Request and Function Interfaces

### API_GATEWAY_REQUEST

Configuration for individual HTTP requests.

```typescript
interface API_GATEWAY_REQUEST<RequestDataType = any, ResponseDataType = any> {
  id: string;
  groupId?: string;
  requestOptions: API_GATEWAY_REQUEST_OPTIONS_TYPE<RequestDataType, ResponseDataType>;
}
```

**Fields:**
- **id**: Unique request identifier (returned in result for tracking)
- **groupId**: Optional group ID to apply group-level config
- **requestOptions**: Request-specific configuration (extends STABLE_REQUEST)

**API_GATEWAY_REQUEST_OPTIONS_TYPE:**
```typescript
type API_GATEWAY_REQUEST_OPTIONS_TYPE<RequestDataType, ResponseDataType> =
  Omit<STABLE_REQUEST<RequestDataType, ResponseDataType>, 'reqData'> & {
    reqData?: Partial<STABLE_REQUEST<RequestDataType, ResponseDataType>['reqData']>;
  };
```

The `reqData` is partial, allowing merging with `commonRequestData`:
```typescript
{
  id: 'user-request',
  requestOptions: {
    reqData: {
      path: '/users/123'  // Merged with commonRequestData
    },
    attempts: 3
  }
}
```

### API_GATEWAY_FUNCTION

Configuration for individual functions.

```typescript
interface API_GATEWAY_FUNCTION<TArgs extends any[] = any[], TReturn = any> {
  id: string;
  groupId?: string;
  functionOptions: API_GATEWAY_FUNCTION_OPTIONS_TYPE<TArgs, TReturn>;
}
```

**Fields:**
- **id**: Unique function identifier
- **groupId**: Optional group ID
- **functionOptions**: Function-specific configuration (extends STABLE_FUNCTION)

**API_GATEWAY_FUNCTION_OPTIONS_TYPE:**
```typescript
type API_GATEWAY_FUNCTION_OPTIONS_TYPE<TArgs extends any[], TReturn> =
  Omit<STABLE_FUNCTION<TArgs, TReturn>, 'fn' | 'args'> & {
    fn?: STABLE_FUNCTION<TArgs, TReturn>['fn'];
    args?: TArgs;
  };
```

Both `fn` and `args` are optional (can be set globally or in group):
```typescript
{
  id: 'calculate',
  functionOptions: {
    fn: (a: number, b: number) => a + b,
    args: [5, 10],
    returnResult: true
  }
}
```

### API_GATEWAY_ITEM (Unified API)

Union type for mixed requests and functions:

```typescript
type API_GATEWAY_ITEM<RequestDataType = any, ResponseDataType = any, TArgs extends any[] = any[], TReturn = any> =
  | { type: RequestOrFunction.REQUEST; request: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType> }
  | { type: RequestOrFunction.FUNCTION; function: API_GATEWAY_FUNCTION<TArgs, TReturn> };
```

**Usage:**
```typescript
const items: API_GATEWAY_ITEM[] = [
  {
    type: RequestOrFunction.REQUEST,
    request: {
      id: 'api-call',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/data' } }
    }
  },
  {
    type: RequestOrFunction.FUNCTION,
    function: {
      id: 'process',
      functionOptions: {
        fn: (data: any) => processData(data),
        args: [data]
      }
    }
  }
];

await stableApiGateway(items, options);
```

---

## Result Interface: API_GATEWAY_RESULT

The result object returned by `stableApiGateway`.

### Interface Definition

```typescript
interface API_GATEWAY_RESULT<ResponseDataType = any> extends Array<API_GATEWAY_RESPONSE<ResponseDataType>> {
  metrics?: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    failureRate: number;
    executionTime: number;
    timestamp: string;
    throughput: number;
    averageRequestDuration: number;
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

### Response Array

The result is an array of `API_GATEWAY_RESPONSE` objects:

```typescript
interface API_GATEWAY_RESPONSE<ResponseDataType = any> {
  requestId: string;          // ID from original request/function
  groupId?: string;           // Group ID if applicable
  success: boolean;           // Success flag
  data?: ResponseDataType;    // Response data (if resReq/returnResult: true)
  error?: string;             // Error message if failed
  type?: RequestOrFunctionType; // 'REQUEST' or 'FUNCTION'
}
```

**Example:**
```typescript
const result = await stableApiGateway(requests, options);

// Array access
result.forEach(response => {
  console.log(`${response.requestId}: ${response.success ? 'Success' : 'Failed'}`);
  if (response.success && response.data) {
    console.log('Data:', response.data);
  }
});

// Find specific response
const userResponse = result.find(r => r.requestId === 'fetch-user');
```

### Metrics Object

**Field Descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `totalRequests` | `number` | Total number of requests/functions executed. |
| `successfulRequests` | `number` | Number that succeeded. |
| `failedRequests` | `number` | Number that failed. |
| `successRate` | `number` | Success percentage (0-100). |
| `failureRate` | `number` | Failure percentage (0-100). |
| `executionTime` | `number` | Total execution time in milliseconds for all requests/functions. |
| `timestamp` | `string` | ISO 8601 timestamp when execution completed. |
| `throughput` | `number` | Throughput in requests per second (totalRequests / seconds). |
| `averageRequestDuration` | `number` | Average execution time per request/function in milliseconds. |
| `requestGroups` | `RequestGroupMetrics[]?` | Per-group metrics breakdown. |
| `infrastructureMetrics` | `Object?` | Circuit breaker, cache, rate limiter, concurrency stats. |

**RequestGroupMetrics:**
```typescript
interface RequestGroupMetrics {
  groupId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  failureRate: number;
}
```

**Usage:**
```typescript
console.log(`Success rate: ${result.metrics.successRate.toFixed(2)}%`);
console.log(`Failed: ${result.metrics.failedRequests}/${result.metrics.totalRequests}`);

// Execution performance metrics
console.log(`Execution time: ${result.metrics.executionTime}ms`);
console.log(`Throughput: ${result.metrics.throughput.toFixed(2)} req/s`);
console.log(`Avg request duration: ${result.metrics.averageRequestDuration.toFixed(2)}ms`);
console.log(`Completed at: ${result.metrics.timestamp}`);

// Per-group analysis
result.metrics.requestGroups?.forEach(group => {
  console.log(`Group ${group.groupId}: ${group.successRate.toFixed(2)}% success`);
});

// Infrastructure stats
console.log('Circuit breaker:', result.metrics.infrastructureMetrics?.circuitBreaker?.state);
console.log('Cache hit rate:', result.metrics.infrastructureMetrics?.cache?.hitRate);
```

---

## Execution Lifecycle

The following diagram illustrates the complete lifecycle of a `stableApiGateway` execution:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INITIALIZATION                                               │
│    - Parse function overloads (requests only, requests+functions│
│      or unified items API)                                      │
│    - Convert to unified API_GATEWAY_ITEM array                  │
│    - Initialize global infrastructure:                          │
│      • Circuit breaker (if configured)                          │
│      • Rate limiter (if configured)                             │
│      • Concurrency limiter (if configured)                      │
│      • Cache manager (if configured)                            │
│    - Extract common config options                              │
│    - Build request groups map                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 2. CONFIGURATION CASCADE                                        │
│    For each request/function item:                              │
│    ┌────────────────────────────────────────────────────┐       │
│    │ 2a. Merge Configuration (Priority Order)           │       │
│    │     1. Global config (common*)                     │       │
│    │     2. Group config (if groupId specified)         │       │
│    │     3. Individual config (requestOptions/          │       │
│    │        functionOptions)                            │       │
│    │     Result: Complete STABLE_REQUEST or             │       │
│    │             STABLE_FUNCTION config                 │       │
│    └────────────────────────────────────────────────────┘       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │ Concurrent?     │
                    └────┬────────┬───┘
                         │        │
           Yes           │        │           No
                         │        │
      ┌──────────────────▼──┐  ┌──▼──────────────────┐
      │ 3A. CONCURRENT      │  │ 3B. SEQUENTIAL      │
      │     EXECUTION       │  │     EXECUTION       │
      └─────────────────────┘  └─────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 3A. CONCURRENT EXECUTION MODE                                   │
│    ┌────────────────────────────────────────────────────┐       │
│    │ Execute all items in parallel using Promise.all()  │       │
│    │ For each item concurrently:                        │       │
│    │   • Acquire concurrency semaphore (if configured)  │       │
│    │   • Acquire rate limit token (if configured)       │       │
│    │   • Execute item:                                  │       │
│    │     - REQUEST: Call stableRequest(config)          │       │
│    │     - FUNCTION: Call stableFunction(config)        │       │
│    │   • Release concurrency semaphore                  │       │
│    │   • Capture result/error                           │       │
│    │   • Continue even if stopOnFirstError=false        │       │
│    │   • Short-circuit if stopOnFirstError=true         │       │
│    └────────────────────────────────────────────────────┘       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ├─────────────────────────────────────┐
                             │                                     │
┌────────────────────────────▼────────────────────────────────────┐│
│ 3B. SEQUENTIAL EXECUTION MODE                                   ││
│    ┌────────────────────────────────────────────────────┐       ││
│    │ Execute items one by one in order                  │       ││
│    │ For each item sequentially:                        │       ││
│    │   • Acquire concurrency semaphore (if configured)  │       ││
│    │   • Acquire rate limit token (if configured)       │       ││
│    │   • Execute item:                                  │       ││
│    │     - REQUEST: Call stableRequest(config)          │       ││
│    │     - FUNCTION: Call stableFunction(config)        │       ││
│    │   • Release concurrency semaphore                  │       ││
│    │   • Capture result/error                           │       ││
│    │   • If error && stopOnFirstError: Stop execution   │       ││
│    │   • Else: Continue to next item                    │       ││
│    └────────────────────────────────────────────────────┘       ││
└────────────────────────────┬────────────────────────────────────┘│
                             │◄────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 4. SHARED BUFFER ACCESS (During Execution)                      │
│    - All requests/functions can access sharedBuffer             │
│    - Pre-execution hooks can read from buffer                   │
│    - Success handlers can write to buffer                       │
│    - Common use: Pass data from one request to another          │
│    Example flow:                                                │
│      Request 1 → success handler → writes to buffer             │
│      Request 2 → pre-execution hook → reads from buffer         │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 5. RESULT AGGREGATION                                           │
│    ┌────────────────────────────────────────────────────┐       │
│    │ 5a. Build Response Array                           │       │
│    │     - Create API_GATEWAY_RESPONSE for each item    │       │
│    │     - Include requestId, groupId, success, data    │       │
│    │     - Include type (REQUEST or FUNCTION)           │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 5b. Calculate Aggregate Metrics                    │       │
│    │     - totalRequests: Count all items               │       │
│    │     - successfulRequests: Count successes          │       │
│    │     - failedRequests: Count failures               │       │
│    │     - successRate: % successful                    │       │
│    │     - failureRate: % failed                        │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 5c. Calculate Group Metrics                        │       │
│    │     For each unique groupId:                       │       │
│    │     - Group total/successful/failed counts         │       │
│    │     - Group success/failure rates                  │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 5d. Extract Infrastructure Metrics                 │       │
│    │     - Circuit breaker state/stats (if used)        │       │
│    │     - Cache hit/miss rates (if used)               │       │
│    │     - Rate limiter stats (if used)                 │       │
│    │     - Concurrency limiter stats (if used)          │       │
│    └────────────────────────────────────────────────────┘       │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 6. RETURN RESULT                                                │
│    - API_GATEWAY_RESULT (array of responses)                    │
│    - Includes metrics property with:                            │
│      • Overall success/failure stats                            │
│      • Per-group breakdown                                      │
│      • Infrastructure metrics                                   │
│    - Can be iterated as array or access metrics directly        │
└─────────────────────────────────────────────────────────────────┘
```

### Key Lifecycle Points

1. **Initialization**: Parse inputs, convert to unified format, initialize infrastructure
2. **Configuration Cascade**: Merge global → group → individual configs
3. **Execution Mode**: Concurrent (parallel) or sequential based on `concurrentExecution`
4. **Shared Buffer**: Mutable state accessible across all requests/functions
5. **Result Aggregation**: Build response array, calculate metrics, extract infrastructure stats
6. **Return**: Array of responses with comprehensive metrics

### Concurrent vs Sequential Execution

**Concurrent (`concurrentExecution: true` - default):**
- All items execute in parallel via `Promise.all()`
- Faster for independent requests
- All items execute even if some fail (unless `stopOnFirstError: true`)
- Order of completion is not guaranteed

**Sequential (`concurrentExecution: false`):**
- Items execute one by one in order
- Slower but predictable
- Can stop on first error if `stopOnFirstError: true`
- Useful when requests depend on each other

**Stop on First Error:**
- `stopOnFirstError: true`: Stops immediately when any item fails
- `stopOnFirstError: false` (default): All items execute regardless of failures

---

## Configuration Examples

### Example 1: Basic Batch Requests

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

const requests: API_GATEWAY_REQUEST[] = [
  {
    id: 'user-1',
    requestOptions: {
      reqData: { hostname: 'api.example.com', path: '/users/1' },
      resReq: true
    }
  },
  {
    id: 'user-2',
    requestOptions: {
      reqData: { hostname: 'api.example.com', path: '/users/2' },
      resReq: true
    }
  },
  {
    id: 'user-3',
    requestOptions: {
      reqData: { hostname: 'api.example.com', path: '/users/3' },
      resReq: true
    }
  }
];

const result = await stableApiGateway(requests, {
  commonAttempts: 3,
  commonWait: 500,
  concurrentExecution: true
});

console.log(`Success rate: ${result.metrics.successRate}%`);
result.forEach(res => {
  console.log(`${res.requestId}: ${res.success ? res.data : res.error}`);
});
```

### Example 2: Common Configuration with Request Groups

```typescript
import { stableApiGateway, RETRY_STRATEGIES, VALID_REQUEST_PROTOCOLS } from '@emmvish/stable-request';

const result = await stableApiGateway(
  [
    {
      id: 'critical-api-1',
      groupId: 'critical',
      requestOptions: {
        reqData: { hostname: 'api.example.com', path: '/critical/data' },
        resReq: true
      }
    },
    {
      id: 'critical-api-2',
      groupId: 'critical',
      requestOptions: {
        reqData: { hostname: 'api.example.com', path: '/critical/metrics' },
        resReq: true
      }
    },
    {
      id: 'standard-api-1',
      groupId: 'standard',
      requestOptions: {
        reqData: { hostname: 'api.example.com', path: '/data' },
        resReq: true
      }
    }
  ],
  {
    // Global config (applies to all)
    commonRequestData: {
      hostname: 'api.example.com',
      protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
      headers: {
        'Content-Type': 'application/json'
      }
    },
    commonAttempts: 3,
    commonWait: 1000,
    
    // Group-specific configs
    requestGroups: [
      {
        id: 'critical',
        commonConfig: {
          commonAttempts: 5,              // Override: 5 attempts for critical
          commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
          commonMaxAllowedWait: 30000
        }
      },
      {
        id: 'standard',
        commonConfig: {
          commonAttempts: 2,              // Override: 2 attempts for standard
          commonRetryStrategy: RETRY_STRATEGIES.LINEAR
        }
      }
    ],
    
    concurrentExecution: true
  }
);

// Analyze by group
result.metrics.requestGroups?.forEach(group => {
  console.log(`${group.groupId}: ${group.successRate.toFixed(2)}% success`);
});
```

### Example 3: Sequential Execution with Shared Buffer

```typescript
import { stableApiGateway, REQUEST_METHODS } from '@emmvish/stable-request';

const sharedBuffer: Record<string, any> = {};

const result = await stableApiGateway(
  [
    {
      id: 'auth',
      requestOptions: {
        reqData: {
          hostname: 'api.example.com',
          path: '/auth/login',
          method: REQUEST_METHODS.POST,
          body: { username: 'user', password: 'pass' }
        },
        resReq: true,
        logAllSuccessfulAttempts: true,
        handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
          // Store token for next request
          commonBuffer.authToken = successfulAttemptData.data.token;
        }
      }
    },
    {
      id: 'user-data',
      requestOptions: {
        resReq: true,
        preExecution: {
          preExecutionHook: async ({ commonBuffer }) => {
            // Use token from previous request
            return {
              reqData: {
                hostname: 'api.example.com',
                path: '/user/profile',
                headers: {
                  Authorization: `Bearer ${commonBuffer.authToken}`
                }
              }
            };
          },
          applyPreExecutionConfigOverride: true
        }
      }
    }
  ],
  {
    sharedBuffer,
    concurrentExecution: false  // Sequential: auth must complete first
  }
);

console.log('Auth result:', result[0]);
console.log('User data:', result[1]);
```

### Example 4: Mixed Requests and Functions

```typescript
import { stableApiGateway, RequestOrFunction, REQUEST_METHODS } from '@emmvish/stable-request';

const items: API_GATEWAY_ITEM[] = [
  // HTTP Request
  {
    type: RequestOrFunction.REQUEST,
    request: {
      id: 'fetch-data',
      requestOptions: {
        reqData: { hostname: 'api.example.com', path: '/data' },
        resReq: true
      }
    }
  },
  // Function
  {
    type: RequestOrFunction.FUNCTION,
    function: {
      id: 'process-data',
      functionOptions: {
        fn: async (data: any[]) => {
          return data.map(item => ({ ...item, processed: true }));
        },
        args: [[]],  // Will be populated from sharedBuffer
        returnResult: true,
        preExecution: {
          preExecutionHook: async ({ commonBuffer, stableFunctionOptions }) => {
            // Get data from previous request
            const fetchedData = commonBuffer.fetchedData || [];
            return {
              args: [fetchedData]
            };
          },
          applyPreExecutionConfigOverride: true
        }
      }
    }
  },
  // Another Request using processed data
  {
    type: RequestOrFunction.REQUEST,
    request: {
      id: 'save-data',
      requestOptions: {
        reqData: {
          hostname: 'api.example.com',
          path: '/data/save',
          method: REQUEST_METHODS.POST
        },
        preExecution: {
          preExecutionHook: async ({ commonBuffer }) => {
            return {
              reqData: {
                body: commonBuffer.processedData
              }
            };
          },
          applyPreExecutionConfigOverride: true
        }
      }
    }
  }
];

const sharedBuffer: Record<string, any> = {};

const result = await stableApiGateway(items, {
  sharedBuffer,
  concurrentExecution: false,  // Sequential pipeline
  commonLogAllSuccessfulAttempts: true,
  commonHandleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer, executionContext }) => {
    // Store results in buffer for next steps
    if (executionContext?.requestId === 'fetch-data') {
      commonBuffer.fetchedData = successfulAttemptData.data;
    } else if (executionContext?.requestId === 'process-data') {
      commonBuffer.processedData = successfulAttemptData.data;
    }
  }
});

console.log('Pipeline result:', result.metrics.successRate === 100 ? 'Success' : 'Failed');
```

### Example 5: Circuit Breaker and Rate Limiting

```typescript
import { stableApiGateway, CircuitBreaker } from '@emmvish/stable-request';

const breaker = new CircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 5,
  recoveryTimeoutMs: 30000
});

const requests: API_GATEWAY_REQUEST[] = Array.from({ length: 20 }, (_, i) => ({
  id: `request-${i}`,
  requestOptions: {
    reqData: {
      hostname: 'api.example.com',
      path: `/data/${i}`
    },
    resReq: true
  }
}));

const result = await stableApiGateway(requests, {
  commonAttempts: 3,
  commonWait: 500,
  circuitBreaker: breaker,
  rateLimit: {
    maxRequests: 10,
    windowMs: 1000  // 10 requests per second
  },
  maxConcurrentRequests: 5,  // Max 5 parallel requests
  concurrentExecution: true
});

console.log('Results:', result.metrics);
console.log('Circuit breaker:', result.metrics.infrastructureMetrics?.circuitBreaker);
console.log('Rate limiter:', result.metrics.infrastructureMetrics?.rateLimiter);
console.log('Concurrency:', result.metrics.infrastructureMetrics?.concurrencyLimiter);
```

### Example 6: Error Handling and Observability

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

const result = await stableApiGateway(
  [
    { id: 'req-1', requestOptions: { reqData: { hostname: 'api.example.com', path: '/data/1' }, resReq: true } },
    { id: 'req-2', requestOptions: { reqData: { hostname: 'api.example.com', path: '/data/2' }, resReq: true } },
    { id: 'req-3', requestOptions: { reqData: { hostname: 'api.example.com', path: '/data/3' }, resReq: true } }
  ],
  {
    commonAttempts: 3,
    commonLogAllErrors: true,
    commonLogAllSuccessfulAttempts: true,
    commonHandleErrors: async ({ errorLog, executionContext }) => {
      // Log to external monitoring
      await fetch('https://monitoring.example.com/errors', {
        method: 'POST',
        body: JSON.stringify({
          requestId: executionContext?.requestId,
          error: errorLog.error,
          attempt: errorLog.attempt,
          statusCode: errorLog.statusCode,
          timestamp: errorLog.timestamp
        })
      });
    },
    commonHandleSuccessfulAttemptData: async ({ successfulAttemptData, executionContext }) => {
      // Log success metrics
      console.log(`${executionContext?.requestId} succeeded in ${successfulAttemptData.executionTime}ms`);
    },
    commonResponseAnalyzer: ({ data }) => {
      // Custom validation
      return data != null && !data.error;
    }
  }
);

// Analyze results
const failed = result.filter(r => !r.success);
if (failed.length > 0) {
  console.error('Failed requests:', failed.map(f => f.requestId));
}
```

### Example 7: Stop on First Error

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

const result = await stableApiGateway(
  [
    { id: 'validate', requestOptions: { reqData: { hostname: 'api.example.com', path: '/validate' }, resReq: true } },
    { id: 'process', requestOptions: { reqData: { hostname: 'api.example.com', path: '/process' }, resReq: true } },
    { id: 'finalize', requestOptions: { reqData: { hostname: 'api.example.com', path: '/finalize' }, resReq: true } }
  ],
  {
    concurrentExecution: false,  // Sequential
    stopOnFirstError: true,       // Stop if validation fails
    commonAttempts: 1
  }
);

if (!result[0].success) {
  console.error('Validation failed, pipeline stopped');
} else if (result.length < 3) {
  console.error('Pipeline stopped early due to error');
} else {
  console.log('All steps completed successfully');
}
```

---

## Advanced Use Cases

### Use Case 1: Multi-Source Data Aggregation

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

interface UserData {
  id: number;
  name: string;
}

interface OrderData {
  orderId: number;
  total: number;
}

interface PreferencesData {
  theme: string;
  language: string;
}

const userId = 123;

const result = await stableApiGateway<any, UserData | OrderData | PreferencesData>(
  [
    {
      id: 'user-profile',
      requestOptions: {
        reqData: { hostname: 'users-api.example.com', path: `/users/${userId}` },
        resReq: true
      }
    },
    {
      id: 'user-orders',
      requestOptions: {
        reqData: { hostname: 'orders-api.example.com', path: `/orders/user/${userId}` },
        resReq: true
      }
    },
    {
      id: 'user-preferences',
      requestOptions: {
        reqData: { hostname: 'preferences-api.example.com', path: `/preferences/${userId}` },
        resReq: true
      }
    }
  ],
  {
    commonAttempts: 3,
    commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
    concurrentExecution: true
  }
);

// Aggregate data
const aggregatedData = {
  profile: result.find(r => r.requestId === 'user-profile')?.data,
  orders: result.find(r => r.requestId === 'user-orders')?.data,
  preferences: result.find(r => r.requestId === 'user-preferences')?.data
};

console.log('Aggregated user data:', aggregatedData);
```

### Use Case 2: Parallel File Processing Pipeline

```typescript
import { stableApiGateway, RequestOrFunction, REQUEST_METHODS } from '@emmvish/stable-request';

const fileUrls = [
  'https://cdn.example.com/file1.json',
  'https://cdn.example.com/file2.json',
  'https://cdn.example.com/file3.json'
];

const items: API_GATEWAY_ITEM[] = [
  // Fetch all files
  ...fileUrls.map((url, i) => ({
    type: RequestOrFunction.REQUEST as const,
    request: {
      id: `fetch-${i}`,
      groupId: 'fetch',
      requestOptions: {
        reqData: { hostname: new URL(url).hostname, path: new URL(url).pathname },
        resReq: true
      }
    }
  })),
  // Process files
  {
    type: RequestOrFunction.FUNCTION,
    function: {
      id: 'process-files',
      functionOptions: {
        fn: async (files: any[]) => {
          return files.map(file => ({
            ...file,
            processed: true,
            timestamp: Date.now()
          }));
        },
        args: [[]],
        returnResult: true
      }
    }
  },
  // Upload processed files
  {
    type: RequestOrFunction.REQUEST,
    request: {
      id: 'upload-results',
      requestOptions: {
        reqData: {
          hostname: 'api.example.com',
          path: '/processed-files',
          method: REQUEST_METHODS.POST
        },
        resReq: true
      }
    }
  }
];

const sharedBuffer: Record<string, any> = { fetchedFiles: [] };

const result = await stableApiGateway(items, {
  sharedBuffer,
  requestGroups: [
    {
      id: 'fetch',
      commonConfig: {
        commonLogAllSuccessfulAttempts: true,
        commonHandleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
          commonBuffer.fetchedFiles.push(successfulAttemptData.data);
        }
      }
    }
  ],
  // First fetch all files concurrently, then process, then upload
  concurrentExecution: false
});

console.log('Processing complete:', result.metrics);
```

### Use Case 3: Health Check with Circuit Breaker

```typescript
import { stableApiGateway, CircuitBreaker } from '@emmvish/stable-request';

const serviceBreaker = new CircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 3,
  recoveryTimeoutMs: 60000
});

const services = [
  { name: 'auth-service', url: 'auth.example.com/health' },
  { name: 'user-service', url: 'users.example.com/health' },
  { name: 'order-service', url: 'orders.example.com/health' },
  { name: 'payment-service', url: 'payments.example.com/health' }
];

// Run health checks every 30 seconds
setInterval(async () => {
  const result = await stableApiGateway(
    services.map(service => ({
      id: service.name,
      requestOptions: {
        reqData: {
          hostname: service.url.split('/')[0],
          path: `/${service.url.split('/')[1]}`
        },
        resReq: true,
        attempts: 1
      }
    })),
    {
      circuitBreaker: serviceBreaker,
      concurrentExecution: true
    }
  );

  const unhealthy = result.filter(r => !r.success);
  if (unhealthy.length > 0) {
    console.error('Unhealthy services:', unhealthy.map(s => s.requestId));
  }

  console.log(`Health check: ${result.metrics.successRate.toFixed(0)}% healthy`);
  console.log('Circuit breaker state:', result.metrics.infrastructureMetrics?.circuitBreaker?.state);
}, 30000);
```

### Use Case 4: Batch User Creation with Validation

```typescript
import { stableApiGateway, RequestOrFunction, REQUEST_METHODS } from '@emmvish/stable-request';

interface NewUser {
  name: string;
  email: string;
  role: string;
}

const newUsers: NewUser[] = [
  { name: 'Alice', email: 'alice@example.com', role: 'admin' },
  { name: 'Bob', email: 'bob@example.com', role: 'user' },
  { name: 'Charlie', email: 'charlie@example.com', role: 'user' }
];

const items: API_GATEWAY_ITEM[] = [
  // Validate users
  {
    type: RequestOrFunction.FUNCTION,
    function: {
      id: 'validate-users',
      functionOptions: {
        fn: (users: NewUser[]) => {
          return users.filter(u => 
            u.email.includes('@') && 
            u.name.length > 0 &&
            ['admin', 'user'].includes(u.role)
          );
        },
        args: [newUsers],
        returnResult: true
      }
    }
  },
  // Create users
  ...newUsers.map((user, i) => ({
    type: RequestOrFunction.REQUEST as const,
    request: {
      id: `create-user-${i}`,
      groupId: 'creation',
      requestOptions: {
        reqData: {
          hostname: 'api.example.com',
          path: '/users',
          method: REQUEST_METHODS.POST,
          body: user
        },
        resReq: true
      }
    }
  }))
];

const result = await stableApiGateway(items, {
  concurrentExecution: false,
  stopOnFirstError: true,  // Stop if validation fails
  requestGroups: [
    {
      id: 'creation',
      commonConfig: {
        commonAttempts: 3,
        commonResponseAnalyzer: ({ data }) => {
          return data?.id != null;  // Verify user was created
        }
      }
    }
  ]
});

const created = result.filter(r => r.requestId.startsWith('create-user-') && r.success);
console.log(`Created ${created.length}/${newUsers.length} users`);
```

### Use Case 5: Distributed Cache Warming

```typescript
import { stableApiGateway, REQUEST_METHODS } from '@emmvish/stable-request';

const cacheKeys = [
  'popular-products',
  'featured-categories',
  'trending-items',
  'daily-deals'
];

const result = await stableApiGateway(
  cacheKeys.map(key => ({
    id: `warm-${key}`,
    requestOptions: {
      reqData: {
        hostname: 'api.example.com',
        path: `/cache/warm/${key}`,
        method: REQUEST_METHODS.POST
      },
      resReq: true,
      attempts: 2,
      cache: {
        enabled: true,
        ttl: 300000  // 5 minutes
      }
    }
  })),
  {
    maxConcurrentRequests: 3,  // Warm 3 at a time
    rateLimit: {
      maxRequests: 10,
      windowMs: 1000
    },
    concurrentExecution: true
  }
);

console.log('Cache warming complete:', result.metrics.successRate === 100);
```

---

## Best Practices

1. **Use Request Groups** for logical organization and shared configuration
   ```typescript
   requestGroups: [
     { id: 'critical', commonConfig: { commonAttempts: 5 } },
     { id: 'standard', commonConfig: { commonAttempts: 2 } }
   ]
   ```

2. **Leverage Configuration Cascade** to avoid repetition
   ```typescript
   // Set common config once
   commonRequestData: {
     hostname: 'api.example.com',
     protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
     headers: { 'Content-Type': 'application/json' }
   }
   // Individual requests only specify what's different
   ```

3. **Use Shared Buffer** for data passing between requests
   ```typescript
   // Request 1 stores data
   handleSuccessfulAttemptData: ({ data, commonBuffer }) => {
     commonBuffer.authToken = data.token;
   },
   // Request 2 uses data
   preExecution: {
     preExecutionHook: ({ commonBuffer }) => ({
       reqData: { headers: { Authorization: commonBuffer.authToken } }
     })
   }
   ```

4. **Choose Execution Mode** based on dependencies
   ```typescript
   // Independent requests: Use concurrent
   concurrentExecution: true
   
   // Dependent requests: Use sequential
   concurrentExecution: false
   ```

5. **Share Circuit Breakers** across API Gateway instances
   ```typescript
   const sharedBreaker = new CircuitBreaker({ /* config */ });
   
   // Use in multiple gateways
   await stableApiGateway(requests1, { circuitBreaker: sharedBreaker });
   await stableApiGateway(requests2, { circuitBreaker: sharedBreaker });
   ```

6. **Use Rate Limiting** to respect API constraints
   ```typescript
   rateLimit: {
     maxRequests: 100,
     windowMs: 60000  // 100 requests per minute
   }
   ```

7. **Monitor with Metrics** for observability
   ```typescript
   const result = await stableApiGateway(requests, options);
   
   // Overall health
   console.log('Success rate:', result.metrics.successRate);
   
   // Per-group analysis
   result.metrics.requestGroups?.forEach(group => {
     console.log(`${group.groupId}: ${group.successRate}%`);
   });
   
   // Infrastructure monitoring
   console.log('CB state:', result.metrics.infrastructureMetrics?.circuitBreaker?.state);
   ```

8. **Use stopOnFirstError** for critical pipelines
   ```typescript
   {
     concurrentExecution: false,
     stopOnFirstError: true  // Halt on validation failure
   }
   ```

9. **Add Execution Context** for distributed tracing
   ```typescript
   executionContext: {
     workflowId: 'batch-job-123',
     requestId: 'gateway-request-456'
   }
   ```

10. **Combine Requests and Functions** for complex workflows
    ```typescript
    const items: API_GATEWAY_ITEM[] = [
      { type: RequestOrFunction.REQUEST, request: { /* fetch */ } },
      { type: RequestOrFunction.FUNCTION, function: { /* transform */ } },
      { type: RequestOrFunction.REQUEST, request: { /* save */ } }
    ];
    ```

---

## Support

For issues, questions, or contributions:

- **GitHub**: [https://github.com/emmvish/stable-request](https://github.com/emmvish/stable-request)
- **NPM**: [https://www.npmjs.com/package/@emmvish/stable-request](https://www.npmjs.com/package/@emmvish/stable-request)
- **Issues**: [https://github.com/emmvish/stable-request/issues](https://github.com/emmvish/stable-request/issues)
