# Infrastructure Utilities API Reference

## Table of Contents

1. [Overview](#overview)
2. [Cache Manager](#cache-manager)
3. [Circuit Breaker](#circuit-breaker)
4. [Rate Limiter](#rate-limiter)
5. [Concurrency Limiter](#concurrency-limiter)
6. [Function Cache Manager](#function-cache-manager)
7. [Metrics Aggregator](#metrics-aggregator)
8. [Metrics Validator](#metrics-validator)
9. [Configuration Examples](#configuration-examples)
10. [Advanced Use Cases](#advanced-use-cases)
11. [Best Practices](#best-practices)

---

## Overview

The `@emmvish/stable-request` library provides a suite of infrastructure utilities that implement resilience patterns for production-ready applications. These utilities can be used independently or together to build robust, fault-tolerant systems.

### Key Utilities

- **Cache Manager**: HTTP response caching with TTL, LRU eviction, and cache-control respect
- **Circuit Breaker**: Fail-fast protection with automatic recovery (CLOSED → OPEN → HALF_OPEN)
- **Rate Limiter**: Sliding-window rate limiting for controlled throughput
- **Concurrency Limiter**: Semaphore-based concurrency control with queuing
- **Function Cache Manager**: Function result caching for expensive computations
- **Metrics Aggregator**: Comprehensive metrics extraction and aggregation
- **Metrics Validator**: Real-time metrics validation against configurable guardrails

### Common Features

- ✅ **Global Instances**: Singleton pattern for shared state across application
- ✅ **Comprehensive Metrics**: Detailed statistics and dashboard-ready metrics
- ✅ **Type-Safe**: Full TypeScript support with generics
- ✅ **Production-Ready**: Battle-tested patterns from industry best practices
- ✅ **Observable**: Rich state inspection for monitoring and debugging
- ✅ **Configurable**: Flexible configuration for different use cases
- ✅ **Persistence Support**: Optional load/store functions for state persistence across restarts

---

## Cache Manager

HTTP response caching utility with LRU eviction, TTL support, and cache-control header respect.

### Overview

The `CacheManager` class provides intelligent caching for HTTP responses with configurable TTL, cache size limits, and automatic cache-control header parsing. It uses SHA-256 hashing for cache keys and LRU (Least Recently Used) eviction strategy.

### Configuration Interface

```typescript
interface CacheConfig {
  enabled: boolean;
  ttl?: number;
  respectCacheControl?: boolean;
  cacheableStatusCodes?: number[];
  maxSize?: number;
  excludeMethods?: string[];
  keyGenerator?: (reqConfig: AxiosRequestConfig) => string;
  persistence?: InfrastructurePersistence<CacheManagerPersistedState>;
}
```

#### Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | Required | Enable/disable caching. |
| `ttl` | `number?` | `300000` | Default time-to-live in milliseconds (5 minutes). |
| `respectCacheControl` | `boolean?` | `true` | Parse and respect HTTP cache-control headers. |
| `cacheableStatusCodes` | `number[]?` | `[200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501]` | HTTP status codes eligible for caching. |
| `maxSize` | `number?` | `100` | Maximum number of cached responses. |
| `excludeMethods` | `REQUEST_METHODS[]?` | `['POST', 'PUT', 'PATCH', 'DELETE']` | HTTP methods excluded from caching. |
| `keyGenerator` | `Function?` | SHA-256 hash | Custom cache key generator function. |
| `persistence` | `InfrastructurePersistence?` | `undefined` | Optional persistence with `load()` and `store()` functions. |

### Class Methods

#### constructor(config: CacheConfig)

Create a new cache manager instance.

```typescript
const cache = new CacheManager({
  enabled: true,
  ttl: 300000,
  maxSize: 100
});
```

#### async initialize(): Promise<void>

Load persisted state if persistence is configured. Call this after construction to restore state.

```typescript
await cache.initialize();
```

#### get<T>(reqConfig: AxiosRequestConfig): CachedResponse<T> | null

Retrieve cached response for a request.

```typescript
const cached = cache.get<ResponseDataType>(axiosConfig);
if (cached) {
  console.log('Cache hit:', cached.data);
}
```

**Returns:**
- `CachedResponse<T>` if cached and not expired
- `null` if not cached, expired, or excluded method

#### set<T>(reqConfig, data, status, statusText, headers): void

Store response in cache.

```typescript
cache.set(
  axiosConfig,
  responseData,
  200,
  'OK',
  { 'cache-control': 'max-age=600' }
);
```

**Parameters:**
- `reqConfig`: Axios request configuration
- `data`: Response data to cache
- `status`: HTTP status code
- `statusText`: HTTP status text
- `headers`: Response headers

#### getStats(): CacheStats

Get cache statistics and metrics.

```typescript
const stats = cache.getStats();
console.log(`Hit rate: ${stats.hitRate.toFixed(2)}%`);
console.log(`Size: ${stats.size}/${stats.maxSize}`);
```

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `size` | `number` | Current number of cached items. |
| `validEntries` | `number` | Number of non-expired entries. |
| `expiredEntries` | `number` | Number of expired entries. |
| `maxSize` | `number` | Maximum cache size. |
| `hits` | `number` | Total cache hits. |
| `misses` | `number` | Total cache misses. |
| `sets` | `number` | Total cache writes. |
| `evictions` | `number` | Total LRU evictions. |
| `expirations` | `number` | Total TTL expirations. |
| `totalRequests` | `number` | Total cache lookups. |
| `hitRate` | `number` | Hit rate percentage (0-100). |
| `missRate` | `number` | Miss rate percentage (0-100). |
| `averageCacheAge` | `number` | Average age of cached entries in milliseconds. |
| `averageGetTime` | `number` | Average get operation time in milliseconds. |
| `averageSetTime` | `number` | Average set operation time in milliseconds. |
| `utilizationPercentage` | `number` | Cache utilization percentage (0-100). |

#### clear(): void

Clear all cached entries.

```typescript
cache.clear();
```

#### delete(reqConfig: AxiosRequestConfig): boolean

Delete specific cached entry.

```typescript
const deleted = cache.delete(axiosConfig);
console.log(`Entry deleted: ${deleted}`);
```

#### prune(): number

Remove all expired entries.

```typescript
const prunedCount = cache.prune();
console.log(`Pruned ${prunedCount} expired entries`);
```

### Global Instance

Use singleton pattern for shared cache across application.

```typescript
import { getGlobalCacheManager, resetGlobalCacheManager } from '@emmvish/stable-request';

// Initialize global cache
const cache = getGlobalCacheManager({
  enabled: true,
  ttl: 300000,
  maxSize: 200
});

// Reset global cache
resetGlobalCacheManager();
```

---

## Circuit Breaker

Fail-fast protection pattern with automatic recovery using three states: CLOSED, OPEN, and HALF_OPEN.

### Overview

The `CircuitBreaker` class implements the circuit breaker pattern to prevent cascading failures. It monitors request success/failure rates and transitions between states to protect downstream services.

### Circuit Breaker States

Using the `CircuitBreakerState` enum:

```typescript
enum CircuitBreakerState {
  CLOSED = 'closed',      // Normal operation, requests flow through
  OPEN = 'open',          // Circuit tripped, requests immediately fail
  HALF_OPEN = 'half-open' // Testing recovery, limited requests allowed
}
```

### State Transitions

```
CLOSED ──[failure threshold exceeded]──► OPEN
   ▲                                       │
   │                                       │
   │                                       │[recovery timeout]
   │                                       │
   │                                       ▼
   └──[success threshold met]──────── HALF_OPEN
```

### Configuration Interface

```typescript
interface CircuitBreakerConfig {
  failureThresholdPercentage: number;
  minimumRequests: number;
  recoveryTimeoutMs: number;
  successThresholdPercentage?: number;
  halfOpenMaxRequests?: number;
  trackIndividualAttempts?: boolean;
  persistence?: InfrastructurePersistence<CircuitBreakerPersistedState>;
}
```

#### Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `failureThresholdPercentage` | `number` | Required | Failure percentage to trip circuit (0-100). |
| `minimumRequests` | `number` | Required | Minimum requests before evaluating threshold. |
| `recoveryTimeoutMs` | `number` | Required | Time in ms before attempting recovery (OPEN → HALF_OPEN). |
| `successThresholdPercentage` | `number?` | `50` | Success percentage to close circuit in HALF_OPEN (0-100). |
| `halfOpenMaxRequests` | `number?` | `5` | Maximum requests allowed in HALF_OPEN state. |
| `trackIndividualAttempts` | `boolean?` | `false` | Track individual retry attempts vs. final request results. |
| `persistence` | `InfrastructurePersistence?` | `undefined` | Optional persistence with `load()` and `store()` functions. |

### Class Methods

#### constructor(config: CircuitBreakerConfig)

Create a new circuit breaker instance.

```typescript
const breaker = new CircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 10,
  recoveryTimeoutMs: 60000
});
```

#### async initialize(): Promise<void>

Load persisted state if persistence is configured. Call this after construction to restore state.

```typescript
await breaker.initialize();
```

#### async canExecute(): Promise<boolean>

Check if request can be executed.

```typescript
if (await breaker.canExecute()) {
  // Execute request
} else {
  // Circuit is OPEN
  throw new CircuitBreakerOpenError('Circuit breaker is open');
}
```

**Returns:**
- `true` if circuit is CLOSED or HALF_OPEN (with capacity)
- `false` if circuit is OPEN or HALF_OPEN at capacity

#### recordSuccess(): void

Record successful request.

```typescript
breaker.recordSuccess();
```

**State Effects:**
- **CLOSED**: Increments success counter
- **HALF_OPEN**: Increments success counter, may transition to CLOSED

#### recordFailure(): void

Record failed request.

```typescript
breaker.recordFailure();
```

**State Effects:**
- **CLOSED**: Increments failure counter, may transition to OPEN
- **HALF_OPEN**: Immediately transitions to OPEN

#### recordAttemptSuccess(): void

Record successful individual attempt (when `trackIndividualAttempts: true`).

```typescript
breaker.recordAttemptSuccess();
```

#### recordAttemptFailure(): void

Record failed individual attempt (when `trackIndividualAttempts: true`).

```typescript
breaker.recordAttemptFailure();
```

#### getState(): CircuitBreakerStateInfo

Get circuit breaker state and metrics.

```typescript
const state = breaker.getState();
console.log(`State: ${state.state}`);
console.log(`Failure rate: ${state.failurePercentage.toFixed(2)}%`);
console.log(`Recovery success rate: ${state.recoverySuccessRate.toFixed(2)}%`);
```

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `state` | `CircuitBreakerState` | Current circuit state (CLOSED, OPEN, HALF_OPEN). |
| `totalRequests` | `number` | Total requests processed. |
| `failedRequests` | `number` | Total failed requests. |
| `successfulRequests` | `number` | Total successful requests. |
| `failurePercentage` | `number` | Current failure percentage. |
| `totalAttempts` | `number` | Total individual attempts (if tracking). |
| `failedAttempts` | `number` | Failed attempts. |
| `successfulAttempts` | `number` | Successful attempts. |
| `attemptFailurePercentage` | `number` | Attempt failure percentage. |
| `stateTransitions` | `number` | Total state transitions. |
| `lastStateChangeTime` | `number` | Timestamp of last state change. |
| `openCount` | `number` | Times circuit opened. |
| `halfOpenCount` | `number` | Times circuit entered HALF_OPEN. |
| `totalOpenDuration` | `number` | Total time in OPEN state (ms). |
| `averageOpenDuration` | `number` | Average OPEN duration (ms). |
| `recoveryAttempts` | `number` | Total recovery attempts. |
| `successfulRecoveries` | `number` | Successful recoveries (HALF_OPEN → CLOSED). |
| `failedRecoveries` | `number` | Failed recoveries (HALF_OPEN → OPEN). |
| `recoverySuccessRate` | `number` | Recovery success percentage. |
| `openUntil` | `number \| null` | Timestamp when circuit will try HALF_OPEN. |

#### reset(): void

Reset circuit breaker to initial state.

```typescript
breaker.reset();
```

#### async execute<T>(fn: () => Promise<T>): Promise<T>

Execute function with circuit breaker protection.

```typescript
try {
  const result = await breaker.execute(async () => {
    return await makeApiCall();
  });
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    console.error('Circuit is open');
  }
}
```

### Global Instance

```typescript
import { getGlobalCircuitBreaker, resetGlobalCircuitBreaker } from '@emmvish/stable-request';

const breaker = getGlobalCircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 10,
  recoveryTimeoutMs: 60000
});

resetGlobalCircuitBreaker();
```

---

## Rate Limiter

Sliding-window rate limiter for controlling request throughput.

### Overview

The `RateLimiter` class implements token bucket algorithm with sliding window for smooth rate limiting. It queues excess requests and processes them when tokens become available.

### Configuration

```typescript
// Simple constructor
const limiter = new RateLimiter(maxRequests, windowMs);

// Config object constructor (with optional persistence)
const limiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000,
  persistence: { load, store }
});
```

**Parameters:**
- `maxRequests`: Maximum requests allowed per window (minimum: 1)
- `windowMs`: Time window in milliseconds (minimum: 100)
- `persistence`: Optional persistence with `load()` and `store()` functions

### Class Methods

#### constructor(maxRequests: number, windowMs: number) or constructor(config: RateLimitConfig)

Create a new rate limiter instance.

```typescript
const limiter = new RateLimiter(100, 60000); // 100 requests per minute

// Or with persistence
const limiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000,
  persistence: {
    load: async () => await loadFromRedis('rate-limiter'),
    store: async (state) => await saveToRedis('rate-limiter', state)
  }
});
await limiter.initialize();
```

#### async execute<T>(fn: () => Promise<T>): Promise<T>

Execute function with rate limiting.

```typescript
const result = await limiter.execute(async () => {
  return await makeApiCall();
});
```

**Behavior:**
- If tokens available: Executes immediately
- If no tokens: Queues and waits for next window

#### async executeAll<T>(fns: Array<() => Promise<T>>): Promise<T[]>

Execute multiple functions with rate limiting.

```typescript
const results = await limiter.executeAll([
  async () => await apiCall1(),
  async () => await apiCall2(),
  async () => await apiCall3()
]);
```

#### getState(): RateLimiterState

Get rate limiter state and metrics.

```typescript
const state = limiter.getState();
console.log(`Available tokens: ${state.availableTokens}`);
console.log(`Queue length: ${state.queueLength}`);
console.log(`Throttle rate: ${state.throttleRate.toFixed(2)}%`);
```

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `availableTokens` | `number` | Current available tokens. |
| `queueLength` | `number` | Current queue length. |
| `maxRequests` | `number` | Maximum requests per window. |
| `windowMs` | `number` | Window size in milliseconds. |
| `totalRequests` | `number` | Total requests processed. |
| `throttledRequests` | `number` | Total throttled (queued) requests. |
| `completedRequests` | `number` | Total completed requests. |
| `throttleRate` | `number` | Throttle rate percentage (0-100). |
| `peakQueueLength` | `number` | Peak queue length observed. |
| `averageQueueWaitTime` | `number` | Average wait time in queue (ms). |
| `peakRequestRate` | `number` | Peak requests per window. |
| `currentRequestRate` | `number` | Current requests per second. |
| `requestsInCurrentWindow` | `number` | Requests in current window. |

### Global Instance

```typescript
import { getGlobalRateLimiter, resetGlobalRateLimiter } from '@emmvish/stable-request';

const limiter = getGlobalRateLimiter(100, 60000);
resetGlobalRateLimiter();
```

---

## Concurrency Limiter

Semaphore-based concurrency control with queuing for limiting parallel execution.

### Overview

The `ConcurrencyLimiter` class implements semaphore pattern to limit concurrent operations. Excess requests are queued and processed when slots become available.

### Configuration

```typescript
// Simple constructor
const limiter = new ConcurrencyLimiter(maxConcurrent);

// Config object constructor (with optional persistence)
const limiter = new ConcurrencyLimiter({
  limit: 10,
  persistence: { load, store }
});
```

**Parameters:**
- `maxConcurrent`: Maximum concurrent operations allowed (minimum: 1)
- `persistence`: Optional persistence with `load()` and `store()` functions

### Class Methods

#### constructor(limit: number) or constructor(config: ConcurrencyLimiterConfig)

Create a new concurrency limiter instance.

```typescript
const limiter = new ConcurrencyLimiter(10); // Max 10 concurrent operations

// Or with persistence
const limiter = new ConcurrencyLimiter({
  limit: 10,
  persistence: {
    load: async () => await loadFromRedis('concurrency-limiter'),
    store: async (state) => await saveToRedis('concurrency-limiter', state)
  }
});
await limiter.initialize();
```

#### async execute<T>(fn: () => Promise<T>): Promise<T>

Execute function with concurrency limiting.

```typescript
const result = await limiter.execute(async () => {
  return await heavyOperation();
});
```

**Behavior:**
- If under limit: Executes immediately
- If at limit: Queues until slot available

#### async executeAll<T>(fns: Array<() => Promise<T>>): Promise<T[]>

Execute multiple functions with concurrency limiting.

```typescript
const results = await limiter.executeAll([
  async () => await operation1(),
  async () => await operation2(),
  async () => await operation3()
]);
```

#### getState(): ConcurrencyLimiterState

Get concurrency limiter state and metrics.

```typescript
const state = limiter.getState();
console.log(`Running: ${state.running}/${state.limit}`);
console.log(`Queue length: ${state.queueLength}`);
console.log(`Success rate: ${state.successRate.toFixed(2)}%`);
```

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `limit` | `number` | Maximum concurrent operations. |
| `running` | `number` | Currently running operations. |
| `queueLength` | `number` | Current queue length. |
| `totalRequests` | `number` | Total requests processed. |
| `completedRequests` | `number` | Total completed requests. |
| `failedRequests` | `number` | Total failed requests. |
| `queuedRequests` | `number` | Total queued requests. |
| `successRate` | `number` | Success rate percentage (0-100). |
| `peakConcurrency` | `number` | Peak concurrent operations observed. |
| `peakQueueLength` | `number` | Peak queue length observed. |
| `averageQueueWaitTime` | `number` | Average wait time in queue (ms). |
| `averageExecutionTime` | `number` | Average execution time (ms). |
| `utilizationPercentage` | `number` | Current utilization percentage (0-100). |

### Global Instance

```typescript
import { getGlobalConcurrencyLimiter, resetGlobalConcurrencyLimiter } from '@emmvish/stable-request';

const limiter = getGlobalConcurrencyLimiter(10);
resetGlobalConcurrencyLimiter();
```

---

## Function Cache Manager

Function result caching utility for expensive computations with automatic memoization.

### Overview

The `FunctionCacheManager` class provides memoization for function results based on function identity and arguments. Uses MD5 hashing for cache keys and LRU eviction.

### Configuration Interface

```typescript
interface FunctionCacheConfig<TArgs extends any[], TReturn> {
  enabled: boolean;
  ttl?: number;
  maxSize?: number;
  keyGenerator?: (fn: (...args: TArgs) => any, args: TArgs) => string;
  persistence?: InfrastructurePersistence<FunctionCacheManagerPersistedState>;
}
```

#### Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | Required | Enable/disable function caching. |
| `ttl` | `number?` | `300000` | Time-to-live in milliseconds (5 minutes). |
| `maxSize` | `number?` | `1000` | Maximum cached function results. |
| `keyGenerator` | `Function?` | MD5 hash | Custom cache key generator. |
| `persistence` | `InfrastructurePersistence?` | `undefined` | Optional persistence with `load()` and `store()` functions. |

### Class Methods

#### constructor(config: FunctionCacheConfig)

Create a new function cache manager instance.

```typescript
const cache = new FunctionCacheManager({
  enabled: true,
  ttl: 300000,
  maxSize: 1000
});
```

#### async initialize(): Promise<void>

Load persisted state if persistence is configured. Call this after construction to restore state.

```typescript
await cache.initialize();
```

#### get<TArgs, TReturn>(fn, args): CachedFunctionResponse<TReturn> | null

Retrieve cached function result.

```typescript
const cached = cache.get(expensiveFunction, [arg1, arg2]);
if (cached) {
  console.log('Cache hit:', cached.data);
}
```

**Returns:**
- `CachedFunctionResponse<TReturn>` if cached and not expired
- `null` if not cached or expired

#### set<TArgs, TReturn>(fn, args, data): void

Store function result in cache.

```typescript
const result = await expensiveFunction(arg1, arg2);
cache.set(expensiveFunction, [arg1, arg2], result);
```

#### clear(): void

Clear all cached function results.

```typescript
cache.clear();
```

#### getStats(): FunctionCacheStats

Get function cache statistics.

```typescript
const stats = cache.getStats();
console.log(`Hit rate: ${stats.hitRate.toFixed(2)}%`);
console.log(`Size: ${stats.size}/${stats.maxSize}`);
```

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `hits` | `number` | Total cache hits. |
| `misses` | `number` | Total cache misses. |
| `hitRate` | `number` | Hit rate percentage (0-100). |
| `missRate` | `number` | Miss rate percentage (0-100). |
| `sets` | `number` | Total cache writes. |
| `evictions` | `number` | Total LRU evictions. |
| `size` | `number` | Current cache size. |
| `maxSize` | `number` | Maximum cache size. |
| `averageGetTime` | `number` | Average get operation time (ms). |
| `averageSetTime` | `number` | Average set operation time (ms). |

### Global Instance

```typescript
import { getGlobalFunctionCacheManager } from '@emmvish/stable-request';

const cache = getGlobalFunctionCacheManager({
  enabled: true,
  ttl: 600000,
  maxSize: 500
});
```

---

## Metrics Aggregator

Static utility class for extracting and computing comprehensive metrics from workflow results.

### Overview

The `MetricsAggregator` class provides static methods to extract metrics from workflow executions, including phase metrics, branch metrics, request group metrics, and infrastructure metrics.

### Static Methods

#### extractWorkflowMetrics<T>(result: STABLE_WORKFLOW_RESULT<T>): WorkflowMetrics

Extract comprehensive workflow-level metrics.

```typescript
const metrics = MetricsAggregator.extractWorkflowMetrics(workflowResult);

console.log(`Success: ${metrics.success}`);
console.log(`Execution time: ${metrics.executionTime}ms`);
console.log(`Phase completion rate: ${metrics.phaseCompletionRate.toFixed(2)}%`);
console.log(`Request success rate: ${metrics.requestSuccessRate.toFixed(2)}%`);
console.log(`Throughput: ${metrics.throughput.toFixed(2)} req/s`);
```

**Returns: WorkflowMetrics**

| Field | Type | Description |
|-------|------|-------------|
| `workflowId` | `string` | Workflow identifier. |
| `success` | `boolean` | Overall workflow success. |
| `executionTime` | `number` | Total execution time (ms). |
| `timestamp` | `string` | ISO 8601 timestamp. |
| `totalPhases` | `number` | Total phases defined. |
| `completedPhases` | `number` | Phases completed. |
| `skippedPhases` | `number` | Phases skipped. |
| `failedPhases` | `number` | Phases failed. |
| `phaseCompletionRate` | `number` | Completion rate percentage. |
| `averagePhaseExecutionTime` | `number` | Average phase time (ms). |
| `totalRequests` | `number` | Total requests executed. |
| `successfulRequests` | `number` | Successful requests. |
| `failedRequests` | `number` | Failed requests. |
| `requestSuccessRate` | `number` | Request success rate percentage. |
| `requestFailureRate` | `number` | Request failure rate percentage. |
| `terminatedEarly` | `boolean` | Workflow terminated early. |
| `terminationReason` | `string?` | Reason for termination. |
| `totalPhaseReplays` | `number` | Total phase replays. |
| `totalPhaseSkips` | `number` | Total phase skips. |
| `throughput` | `number` | Requests per second. |
| `totalBranches` | `number?` | Total branches (if branched). |
| `completedBranches` | `number?` | Completed branches. |
| `failedBranches` | `number?` | Failed branches. |
| `branchSuccessRate` | `number?` | Branch success rate percentage. |
| `averageRequestDuration` | `number?` | Average request duration (ms). |

#### extractBranchMetrics<T>(branch: BranchExecutionResult<T>): BranchMetrics

Extract branch-level metrics.

```typescript
const branchMetrics = MetricsAggregator.extractBranchMetrics(branchResult);
console.log(`Branch ${branchMetrics.branchId} completion: ${branchMetrics.phaseCompletionRate.toFixed(2)}%`);
```

**Returns: BranchMetrics**

| Field | Type | Description |
|-------|------|-------------|
| `branchId` | `string` | Branch identifier. |
| `branchIndex` | `number` | Branch index in execution order. |
| `executionNumber` | `number` | Execution iteration number. |
| `success` | `boolean` | Branch execution success flag. |
| `executionTime` | `number` | Total execution time (ms). |
| `skipped` | `boolean` | Whether the branch was skipped. |
| `totalPhases` | `number` | Total phases in the branch. |
| `completedPhases` | `number` | Completed phases count. |
| `failedPhases` | `number` | Failed phases count. |
| `phaseCompletionRate` | `number` | Phase completion rate percentage. |
| `totalRequests` | `number` | Total requests executed in branch. |
| `successfulRequests` | `number` | Successful requests count. |
| `failedRequests` | `number` | Failed requests count. |
| `requestSuccessRate` | `number` | Request success rate percentage. |
| `hasDecision` | `boolean` | Whether a branch decision was recorded. |
| `decisionAction` | `string?` | Decision action, if any. |
| `error` | `string?` | Error message if failed. |

#### extractPhaseMetrics<T>(phase: STABLE_WORKFLOW_PHASE_RESULT<T>): PhaseMetrics

Extract phase-level metrics.

```typescript
const phaseMetrics = MetricsAggregator.extractPhaseMetrics(phaseResult);
console.log(`Phase ${phaseMetrics.phaseId} success rate: ${phaseMetrics.requestSuccessRate.toFixed(2)}%`);
```

**Returns: PhaseMetrics**

| Field | Type | Description |
|-------|------|-------------|
| `phaseId` | `string` | Phase identifier. |
| `phaseIndex` | `number` | Phase index in workflow. |
| `workflowId` | `string` | Workflow identifier. |
| `branchId` | `string?` | Branch identifier (if branched). |
| `executionNumber` | `number` | Execution iteration number. |
| `success` | `boolean` | Phase execution success flag. |
| `skipped` | `boolean` | Whether the phase was skipped. |
| `executionTime` | `number` | Total execution time (ms). |
| `timestamp` | `string` | ISO 8601 timestamp. |
| `totalRequests` | `number` | Total requests executed in phase. |
| `successfulRequests` | `number` | Successful requests count. |
| `failedRequests` | `number` | Failed requests count. |
| `requestSuccessRate` | `number` | Request success rate percentage. |
| `requestFailureRate` | `number` | Request failure rate percentage. |
| `hasDecision` | `boolean` | Whether a phase decision was recorded. |
| `decisionAction` | `string?` | Decision action, if any. |
| `targetPhaseId` | `string?` | Target phase id for JUMP decision. |
| `replayCount` | `number?` | Replay count, if applicable. |
| `error` | `string?` | Error message if failed. |

#### extractRequestGroupMetrics<T>(responses: API_GATEWAY_RESPONSE<T>[]): RequestGroupMetrics[]

Extract request group metrics.

```typescript
const groupMetrics = MetricsAggregator.extractRequestGroupMetrics(responses);
groupMetrics.forEach(group => {
  console.log(`Group ${group.groupId}: ${group.successRate.toFixed(2)}% success`);
});
```

**Returns: RequestGroupMetrics[]**

| Field | Type | Description |
|-------|------|-------------|
| `groupId` | `string` | Request group identifier. |
| `totalRequests` | `number` | Total requests in group. |
| `successfulRequests` | `number` | Successful requests count. |
| `failedRequests` | `number` | Failed requests count. |
| `successRate` | `number` | Group success rate percentage. |
| `failureRate` | `number` | Group failure rate percentage. |
| `requestIds` | `string[]` | Request IDs in the group. |

#### extractCircuitBreakerMetrics(circuitBreaker: CircuitBreaker): CircuitBreakerDashboardMetrics

Extract circuit breaker dashboard metrics.

```typescript
const cbMetrics = MetricsAggregator.extractCircuitBreakerMetrics(breaker);
console.log(`State: ${cbMetrics.state}`);
console.log(`Health score: ${cbMetrics.healthScore.toFixed(2)}`);
```

**Returns: CircuitBreakerDashboardMetrics**

| Field | Type | Description |
|-------|------|-------------|
| `state` | `string` | Current circuit state. |
| `isHealthy` | `boolean` | Health indicator for circuit breaker. |
| `totalRequests` | `number` | Total requests processed. |
| `successfulRequests` | `number` | Successful requests count. |
| `failedRequests` | `number` | Failed requests count. |
| `failurePercentage` | `number` | Failure percentage. |
| `stateTransitions` | `number` | Total state transitions. |
| `lastStateChangeTime` | `number` | Timestamp of last state change. |
| `timeSinceLastStateChange` | `number` | Time since last state change (ms). |
| `openCount` | `number` | Times circuit opened. |
| `totalOpenDuration` | `number` | Total time in OPEN state (ms). |
| `averageOpenDuration` | `number` | Average OPEN duration (ms). |
| `isCurrentlyOpen` | `boolean` | Whether circuit is currently OPEN. |
| `openUntil` | `number \| null` | Timestamp when circuit will try HALF_OPEN. |
| `timeUntilRecovery` | `number \| null` | Time until recovery attempt (ms). |
| `recoveryAttempts` | `number` | Total recovery attempts. |
| `successfulRecoveries` | `number` | Successful recoveries count. |
| `failedRecoveries` | `number` | Failed recoveries count. |
| `recoverySuccessRate` | `number` | Recovery success rate. |
| `config` | `Required<CircuitBreakerConfig>` | Effective circuit breaker configuration. |

#### extractCacheMetrics(cache: CacheManager): CacheDashboardMetrics

Extract cache dashboard metrics.

```typescript
const cacheMetrics = MetricsAggregator.extractCacheMetrics(cache);
console.log(`Hit rate: ${cacheMetrics.hitRate.toFixed(2)}%`);
console.log(`Performance score: ${cacheMetrics.performanceScore.toFixed(2)}`);
```

**Returns: CacheDashboardMetrics**

| Field | Type | Description |
|-------|------|-------------|
| `isEnabled` | `boolean` | Whether cache is enabled. |
| `currentSize` | `number` | Current cache size. |
| `maxSize` | `number` | Maximum cache size. |
| `validEntries` | `number` | Non-expired entries count. |
| `expiredEntries` | `number` | Expired entries count. |
| `utilizationPercentage` | `number` | Utilization percentage. |
| `totalRequests` | `number` | Total cache lookups. |
| `hits` | `number` | Cache hit count. |
| `misses` | `number` | Cache miss count. |
| `hitRate` | `number` | Hit rate percentage. |
| `missRate` | `number` | Miss rate percentage. |
| `sets` | `number` | Cache writes count. |
| `evictions` | `number` | Eviction count. |
| `expirations` | `number` | Expiration count. |
| `averageGetTime` | `number` | Average get time (ms). |
| `averageSetTime` | `number` | Average set time (ms). |
| `averageCacheAge` | `number` | Average cache age (ms). |
| `oldestEntryAge` | `number \| null` | Age of oldest entry (ms). |
| `newestEntryAge` | `number \| null` | Age of newest entry (ms). |
| `networkRequestsSaved` | `number` | Network requests saved via cache. |
| `cacheEfficiency` | `number` | Cache efficiency score (0-100). |

#### extractRateLimiterMetrics(rateLimiter: RateLimiter): RateLimiterDashboardMetrics

Extract rate limiter dashboard metrics.

```typescript
const rlMetrics = MetricsAggregator.extractRateLimiterMetrics(limiter);
console.log(`Throttle rate: ${rlMetrics.throttleRate.toFixed(2)}%`);
console.log(`Efficiency score: ${rlMetrics.efficiencyScore.toFixed(2)}`);
```

**Returns: RateLimiterDashboardMetrics**

| Field | Type | Description |
|-------|------|-------------|
| `maxRequests` | `number` | Max requests per window. |
| `windowMs` | `number` | Window size (ms). |
| `availableTokens` | `number` | Available tokens in current window. |
| `queueLength` | `number` | Current queue length. |
| `requestsInCurrentWindow` | `number` | Requests in current window. |
| `totalRequests` | `number` | Total requests processed. |
| `completedRequests` | `number` | Completed requests count. |
| `throttledRequests` | `number` | Throttled requests count. |
| `throttleRate` | `number` | Throttle rate percentage. |
| `currentRequestRate` | `number` | Current requests per second. |
| `peakRequestRate` | `number` | Peak requests per second. |
| `averageRequestRate` | `number` | Average requests per second. |
| `peakQueueLength` | `number` | Peak queue length. |
| `averageQueueWaitTime` | `number` | Average queue wait time (ms). |
| `isThrottling` | `boolean` | Whether limiter is throttling. |
| `utilizationPercentage` | `number` | Utilization percentage. |

#### extractConcurrencyLimiterMetrics(concurrencyLimiter: ConcurrencyLimiter): ConcurrencyLimiterDashboardMetrics

Extract concurrency limiter dashboard metrics.

```typescript
const clMetrics = MetricsAggregator.extractConcurrencyLimiterMetrics(limiter);
console.log(`Utilization: ${clMetrics.utilizationPercentage.toFixed(2)}%`);
console.log(`Performance score: ${clMetrics.performanceScore.toFixed(2)}`);
```

**Returns: ConcurrencyLimiterDashboardMetrics**

| Field | Type | Description |
|-------|------|-------------|
| `limit` | `number` | Max concurrent operations. |
| `running` | `number` | Currently running operations. |
| `queueLength` | `number` | Current queue length. |
| `utilizationPercentage` | `number` | Utilization percentage. |
| `totalRequests` | `number` | Total requests processed. |
| `completedRequests` | `number` | Completed requests count. |
| `failedRequests` | `number` | Failed requests count. |
| `queuedRequests` | `number` | Total queued requests. |
| `successRate` | `number` | Success rate percentage. |
| `peakConcurrency` | `number` | Peak concurrency. |
| `averageConcurrency` | `number` | Average concurrency. |
| `concurrencyUtilization` | `number` | Concurrency utilization metric. |
| `peakQueueLength` | `number` | Peak queue length. |
| `averageQueueWaitTime` | `number` | Average queue wait time (ms). |
| `averageExecutionTime` | `number` | Average execution time (ms). |
| `isAtCapacity` | `boolean` | Whether at capacity. |
| `hasQueuedRequests` | `boolean` | Whether there are queued requests. |

#### aggregateSystemMetrics<T>(...): SystemMetrics

Aggregate all system-level metrics.

```typescript
const systemMetrics = MetricsAggregator.aggregateSystemMetrics(
  workflowResult,
  circuitBreaker,
  cache,
  rateLimiter,
  concurrencyLimiter
);

console.log('System Metrics:', systemMetrics);
```

**Returns: SystemMetrics**

| Field | Type | Description |
|-------|------|-------------|
| `workflow` | `WorkflowMetrics?` | Workflow-level metrics, if provided. |
| `branches` | `BranchMetrics[]` | Branch metrics list. |
| `phases` | `PhaseMetrics[]` | Phase metrics list. |
| `requestGroups` | `RequestGroupMetrics[]` | Request group metrics list. |
| `requests` | `RequestMetrics[]` | Request metrics list. |
| `circuitBreaker` | `CircuitBreakerDashboardMetrics?` | Circuit breaker dashboard metrics. |
| `cache` | `CacheDashboardMetrics?` | Cache dashboard metrics. |
| `rateLimiter` | `RateLimiterDashboardMetrics?` | Rate limiter dashboard metrics. |
| `concurrencyLimiter` | `ConcurrencyLimiterDashboardMetrics?` | Concurrency limiter dashboard metrics. |

**RequestMetrics**

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | `string` | Request identifier. |
| `groupId` | `string?` | Group identifier, if any. |
| `success` | `boolean` | Request success flag. |
| `hasError` | `boolean` | Whether the request has an error. |
| `errorMessage` | `string?` | Error message, if any. |

---

## Metrics Validator

Static utility class for validating metrics against configurable guardrails with automatic anomaly detection.

### Overview

The `MetricsValidator` class provides real-time validation of metrics against user-defined thresholds (guardrails). It automatically detects anomalies, calculates severity levels, and provides detailed violation information for monitoring and alerting.

### Key Features

- ✅ **Automatic Anomaly Detection**: Identifies metrics outside acceptable ranges
- ✅ **Severity Classification**: CRITICAL, WARNING, INFO based on deviation
- ✅ **Multi-Level Validation**: Request, Function, API Gateway, Workflow, Phase, Branch, Infrastructure
- ✅ **Flexible Guardrails**: Min/max thresholds or expected value with tolerance
- ✅ **Type-Safe Enums**: ViolationType and AnomalySeverity for consistent handling

### Guardrails Configuration

#### MetricsGuardrails Interface

```typescript
interface MetricsGuardrails {
  request?: RequestMetricsGuardrails;
  apiGateway?: ApiGatewayMetricsGuardrails;
  workflow?: WorkflowMetricsGuardrails;
  phase?: PhaseMetricsGuardrails;
  branch?: BranchMetricsGuardrails;
  infrastructure?: InfrastructureMetricsGuardrails;
}
```

#### Guardrail Specification

Each metric can have:
- `min`: Minimum acceptable value
- `max`: Maximum acceptable value
- `expected`: Expected value (requires `tolerance`)
- `tolerance`: Acceptable deviation percentage (0-100) from expected value

```typescript
interface MetricGuardrail {
  min?: number;
  max?: number;
  expected?: number;
  tolerance?: number;
}
```

### Validation Result

```typescript
interface MetricsValidationResult {
  isValid: boolean;
  anomalies: MetricAnomaly[];
  validatedAt: string; // ISO 8601 timestamp
}

interface MetricAnomaly {
  metricName: string;
  metricValue: number;
  guardrail: MetricGuardrail;
  severity: AnomalySeverity;
  reason: string;
  violationType: ViolationType;
}
```

### Enums

#### AnomalySeverity

```typescript
enum AnomalySeverity {
  CRITICAL = 'critical',  // Deviation > 50%
  WARNING = 'warning',    // Deviation > 20%
  INFO = 'info'           // Deviation ≤ 20%
}
```

#### ViolationType

```typescript
enum ViolationType {
  BELOW_MIN = 'below_min',
  ABOVE_MAX = 'above_max',
  OUTSIDE_TOLERANCE = 'outside_tolerance'
}
```

### Static Methods

#### validateRequestMetrics(metrics, guardrails): MetricsValidationResult

Validate request/function metrics against guardrails.

```typescript
const validation = MetricsValidator.validateRequestMetrics(
  result.metrics,
  {
    request: {
      totalAttempts: { max: 5 },
      successfulAttempts: { min: 1 },
      failedAttempts: { max: 2 },
      totalExecutionTime: { max: 5000 }
    }
  }
);

if (!validation.isValid) {
  validation.anomalies.forEach(anomaly => {
    console.error(`${anomaly.severity.toUpperCase()}: ${anomaly.reason}`);
  });
}
```

**Validated Metrics:**
- `totalAttempts`
- `successfulAttempts`
- `failedAttempts`
- `totalExecutionTime`
- `averageAttemptTime`

#### validateApiGatewayMetrics(metrics, guardrails): MetricsValidationResult

Validate API Gateway metrics.

```typescript
const validation = MetricsValidator.validateApiGatewayMetrics(
  result.metrics,
  {
    apiGateway: {
      totalRequests: { expected: 10, tolerance: 10 },
      successRate: { min: 95 },
      failureRate: { max: 5 },
      executionTime: { max: 10000 },
      throughput: { min: 10 },
      averageRequestDuration: { max: 1000 }
    }
  }
);
```

**Validated Metrics:**
- `totalRequests`
- `successfulRequests`
- `failedRequests`
- `successRate`
- `failureRate`
- `executionTime`
- `throughput`
- `averageRequestDuration`

#### validateWorkflowMetrics(metrics, guardrails): MetricsValidationResult

Validate workflow-level metrics.

```typescript
const validation = MetricsValidator.validateWorkflowMetrics(
  workflowMetrics,
  {
    workflow: {
      executionTime: { max: 30000 },
      phaseCompletionRate: { min: 90 },
      requestSuccessRate: { min: 95 },
      throughput: { min: 5 }
    }
  }
);
```

**Validated Metrics:**
- `executionTime`
- `totalPhases`
- `completedPhases`
- `failedPhases`
- `skippedPhases`
- `phaseCompletionRate`
- `averagePhaseExecutionTime`
- `totalRequests`
- `successfulRequests`
- `failedRequests`
- `requestSuccessRate`
- `requestFailureRate`
- `throughput`

#### validatePhaseMetrics(metrics, guardrails): MetricsValidationResult

Validate phase-level metrics.

```typescript
const validation = MetricsValidator.validatePhaseMetrics(
  phaseResult.metrics,
  {
    phase: {
      executionTime: { max: 5000 },
      totalRequests: { min: 1 },
      requestSuccessRate: { min: 95 }
    }
  }
);
```

**Validated Metrics:**
- `phaseIndex`
- `executionTime`
- `totalRequests`
- `successfulRequests`
- `failedRequests`
- `requestSuccessRate`
- `requestFailureRate`

#### validateBranchMetrics(metrics, guardrails): MetricsValidationResult

Validate branch-level metrics.

```typescript
const validation = MetricsValidator.validateBranchMetrics(
  branchMetrics,
  {
    branch: {
      executionTime: { max: 15000 },
      phaseCompletionRate: { min: 80 },
      requestSuccessRate: { min: 90 }
    }
  }
);
```

**Validated Metrics:**
- `branchIndex`
- `executionTime`
- `completedPhases`
- `totalPhases`
- `phaseCompletionRate`
- `totalRequests`
- `successfulRequests`
- `failedRequests`
- `requestSuccessRate`
- `requestFailureRate`

#### validateInfrastructureMetrics(metrics, guardrails): MetricsValidationResult

Validate infrastructure metrics (cache, circuit breaker, rate limiter, concurrency limiter).

```typescript
const validation = MetricsValidator.validateInfrastructureMetrics(
  result.metrics.infrastructureMetrics,
  {
    infrastructure: {
      cache: {
        hitRate: { min: 70 },
        utilizationPercentage: { expected: 80, tolerance: 20 }
      },
      circuitBreaker: {
        failureRate: { max: 10 },
        healthScore: { min: 80 }
      },
      rateLimiter: {
        throttleRate: { max: 30 },
        averageQueueWaitTime: { max: 1000 }
      },
      concurrencyLimiter: {
        utilizationPercentage: { min: 50, max: 90 },
        successRate: { min: 95 }
      }
    }
  }
);
```

### Severity Calculation

Severity is automatically calculated based on deviation from threshold:

```typescript
// For min threshold violation
const deviation = ((threshold - actualValue) / threshold) * 100;

// For max threshold violation
const deviation = ((actualValue - threshold) / threshold) * 100;

if (deviation > 50) {
  severity = AnomalySeverity.CRITICAL;
} else if (deviation > 20) {
  severity = AnomalySeverity.WARNING;
} else {
  severity = AnomalySeverity.INFO;
}
```

### Usage Examples

#### Example 1: Request Validation

```typescript
import { stableRequest, MetricsValidator } from '@emmvish/stable-request';

const result = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/data'
  },
  attempts: 3,
  metricsGuardrails: {
    request: {
      totalAttempts: { max: 3 },
      successfulAttempts: { min: 1 },
      totalExecutionTime: { max: 5000 }
    }
  },
  resReq: true
});

// Validation is automatically performed and included in result
if (!result.metrics?.validation?.isValid) {
  console.error('Metrics validation failed!');
  result.metrics.validation.anomalies.forEach(anomaly => {
    console.error(`[${anomaly.severity}] ${anomaly.reason}`);
  });
}
```

#### Example 2: API Gateway Validation

```typescript
import { stableApiGateway, MetricsValidator, AnomalySeverity } from '@emmvish/stable-request';

const result = await stableApiGateway(
  requests,
  functions,
  {
    metricsGuardrails: {
      apiGateway: {
        successRate: { min: 95 },
        failureRate: { max: 5 },
        executionTime: { max: 10000 }
      }
    }
  }
);

if (result.metrics?.validation) {
  const criticalAnomalies = result.metrics.validation.anomalies
    .filter(a => a.severity === AnomalySeverity.CRITICAL);
  
  if (criticalAnomalies.length > 0) {
    alertOps('Critical metrics violations detected', criticalAnomalies);
  }
}
```

#### Example 3: Workflow Validation

```typescript
import { stableWorkflow, MetricsValidator } from '@emmvish/stable-request';

const result = await stableWorkflow(
  phases,
  {
    metricsGuardrails: {
      workflow: {
        executionTime: { max: 30000 },
        phaseCompletionRate: { min: 90 },
        requestSuccessRate: { min: 95 }
      },
      phase: {
        executionTime: { max: 5000 },
        requestSuccessRate: { min: 95 }
      }
    }
  }
);

// Check workflow-level validation
if (!result.metrics?.validation?.isValid) {
  console.error('Workflow validation failed');
}

// Check phase-level validation
result.phases?.forEach((phase, index) => {
  if (!phase.metrics?.validation?.isValid) {
    console.error(`Phase ${index} validation failed`);
    phase.metrics.validation.anomalies.forEach(anomaly => {
      console.error(`  ${anomaly.reason}`);
    });
  }
});
```

#### Example 4: Tolerance-Based Validation

```typescript
// Expected value with tolerance
const result = await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  metricsGuardrails: {
    request: {
      // Expect 3 attempts, allow 10% deviation (2.7 to 3.3)
      totalAttempts: { expected: 3, tolerance: 10 },
      
      // Expect 1000ms execution time, allow 20% deviation (800-1200ms)
      totalExecutionTime: { expected: 1000, tolerance: 20 }
    }
  },
  resReq: true
});

if (result.metrics?.validation?.isValid) {
  console.log('Metrics within expected tolerances');
}
```

#### Example 5: Multi-Level Validation

```typescript
import { stableWorkflow, ViolationType } from '@emmvish/stable-request';

const result = await stableWorkflow(
  phases,
  {
    enableBranchExecution: true,
    metricsGuardrails: {
      workflow: {
        executionTime: { max: 60000 },
        phaseCompletionRate: { min: 85 }
      },
      phase: {
        executionTime: { max: 10000 },
        requestSuccessRate: { min: 90 }
      },
      branch: {
        executionTime: { max: 20000 },
        phaseCompletionRate: { min: 80 }
      }
    },
    branches: [
      {
        id: 'critical-path',
        phases: [...],
        metricsGuardrails: {
          branch: {
            requestSuccessRate: { min: 99 } // Stricter for critical path
          }
        }
      }
    ]
  }
);

// Check all validation levels
function checkValidation(result: any, level: string) {
  if (!result.metrics?.validation?.isValid) {
    console.error(`${level} validation failed`);
    
    result.metrics.validation.anomalies.forEach(anomaly => {
      const icon = anomaly.violationType === ViolationType.BELOW_MIN ? '📉' 
                 : anomaly.violationType === ViolationType.ABOVE_MAX ? '📈' 
                 : '⚠️';
      
      console.error(`  ${icon} [${anomaly.severity}] ${anomaly.reason}`);
    });
  }
}

checkValidation(result, 'Workflow');
result.phases?.forEach((p, i) => checkValidation(p, `Phase ${i}`));
result.branches?.forEach((b, i) => checkValidation(b, `Branch ${i}`));
```

#### Example 6: Infrastructure Metrics Validation

```typescript
import { 
  stableRequest, 
  getGlobalCacheManager, 
  getGlobalCircuitBreaker,
  MetricsValidator 
} from '@emmvish/stable-request';

const cache = getGlobalCacheManager({ enabled: true, ttl: 300000 });
const breaker = getGlobalCircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 10,
  recoveryTimeoutMs: 60000
});

const result = await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  cache: cache,
  circuitBreaker: breaker,
  metricsGuardrails: {
    infrastructure: {
      cache: {
        hitRate: { min: 60 },
        utilizationPercentage: { min: 50, max: 90 }
      },
      circuitBreaker: {
        failureRate: { max: 20 },
        healthScore: { min: 70 }
      }
    }
  },
  resReq: true
});

// Check infrastructure validation
if (result.metrics?.validation) {
  const infraAnomalies = result.metrics.validation.anomalies
    .filter(a => 
      a.metricName.includes('hitRate') || 
      a.metricName.includes('healthScore')
    );
  
  if (infraAnomalies.length > 0) {
    console.warn('Infrastructure metrics need attention:', infraAnomalies);
  }
}
```

### Integration with Monitoring

```typescript
import { MetricsValidator, AnomalySeverity, ViolationType } from '@emmvish/stable-request';

function sendMetricsToMonitoring(result: any) {
  if (!result.metrics?.validation) return;
  
  const validation = result.metrics.validation;
  
  // Send validation status
  metrics.gauge('metrics.validation.status', validation.isValid ? 1 : 0);
  metrics.gauge('metrics.validation.anomaly_count', validation.anomalies.length);
  
  // Count by severity
  const criticalCount = validation.anomalies
    .filter(a => a.severity === AnomalySeverity.CRITICAL).length;
  const warningCount = validation.anomalies
    .filter(a => a.severity === AnomalySeverity.WARNING).length;
  const infoCount = validation.anomalies
    .filter(a => a.severity === AnomalySeverity.INFO).length;
  
  metrics.gauge('metrics.validation.critical_anomalies', criticalCount);
  metrics.gauge('metrics.validation.warning_anomalies', warningCount);
  metrics.gauge('metrics.validation.info_anomalies', infoCount);
  
  // Alert on critical anomalies
  if (criticalCount > 0) {
    validation.anomalies
      .filter(a => a.severity === AnomalySeverity.CRITICAL)
      .forEach(anomaly => {
        alerting.sendAlert({
          level: 'critical',
          title: `Critical Metrics Violation: ${anomaly.metricName}`,
          description: anomaly.reason,
          metadata: {
            metricName: anomaly.metricName,
            metricValue: anomaly.metricValue,
            guardrail: anomaly.guardrail,
            violationType: anomaly.violationType
          }
        });
      });
  }
}
```

### Best Practices

1. **Set Realistic Guardrails** based on historical data and SLOs
   ```typescript
   // Use percentiles from historical data
   const guardrails = {
     request: {
       totalExecutionTime: { max: p95ExecutionTime * 1.2 },
       successfulAttempts: { min: 1 }
     }
   };
   ```

2. **Use Tolerance for Expected Values** when you know the target
   ```typescript
   // For predictable workloads
   {
     apiGateway: {
       totalRequests: { expected: 100, tolerance: 10 } // 90-110 requests
     }
   }
   ```

3. **Layer Guardrails** from strict to lenient at different levels
   ```typescript
   {
     workflow: { requestSuccessRate: { min: 90 } },  // Lenient
     phase: { requestSuccessRate: { min: 95 } },     // Strict
     branch: { requestSuccessRate: { min: 99 } }     // Very strict for critical
   }
   ```

4. **Monitor Anomaly Patterns** to tune guardrails
   ```typescript
   if (validation.anomalies.length > 0) {
     const mostCommon = getMostCommonAnomaly(validation.anomalies);
     if (mostCommon.count > 10) {
       console.log(`Consider adjusting ${mostCommon.metricName} guardrail`);
     }
   }
   ```

5. **Handle Validation Failures Gracefully**
   ```typescript
   if (!result.metrics?.validation?.isValid) {
     const hasCritical = result.metrics.validation.anomalies
       .some(a => a.severity === AnomalySeverity.CRITICAL);
     
     if (hasCritical) {
       // Critical: Take immediate action
       await rollbackDeployment();
     } else {
       // Warning/Info: Log and monitor
       logger.warn('Metrics validation warnings', result.metrics.validation);
     }
   }
   ```

6. **Combine with Circuit Breaker** for automatic protection
   ```typescript
   const breaker = new CircuitBreaker({
     failureThresholdPercentage: 50,
     minimumRequests: 10,
     recoveryTimeoutMs: 60000
   });
   
   const result = await stableRequest({
     // ... config
     circuitBreaker: breaker,
     metricsGuardrails: {
       request: {
         failedAttempts: { max: 3 }
       },
       infrastructure: {
         circuitBreaker: {
           failureRate: { max: 50 }
         }
       }
     }
   });
   ```

---

## Configuration Examples

### Example 1: HTTP Response Caching

```typescript
import { CacheManager } from '@emmvish/stable-request';

const cache = new CacheManager({
  enabled: true,
  ttl: 300000, // 5 minutes
  maxSize: 200,
  respectCacheControl: true,
  cacheableStatusCodes: [200, 203, 204, 206],
  excludeMethods: ['POST', 'PUT', 'PATCH', 'DELETE']
});

// Use with stableRequest
const result = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/data'
  },
  cache: {
    enabled: true,
    ttl: 300000,
    maxSize: 200
  },
  resReq: true
});

// Check cache stats
const stats = cache.getStats();
console.log(`Cache hit rate: ${stats.hitRate.toFixed(2)}%`);
console.log(`Cache size: ${stats.size}/${stats.maxSize}`);
```

### Example 2: Circuit Breaker Protection

```typescript
import { CircuitBreaker, CircuitBreakerState } from '@emmvish/stable-request';

const breaker = new CircuitBreaker({
  failureThresholdPercentage: 50, // Open at 50% failure
  minimumRequests: 10,             // Need 10 requests to evaluate
  recoveryTimeoutMs: 60000,        // Try recovery after 1 minute
  successThresholdPercentage: 70,  // Need 70% success to close
  halfOpenMaxRequests: 5           // Max 5 requests in half-open
});

// Use with stableRequest
const result = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/risky-endpoint'
  },
  circuitBreaker: breaker,
  resReq: true
});

// Monitor circuit state
const state = breaker.getState();
console.log(`Circuit state: ${state.state}`);
console.log(`Failure rate: ${state.failurePercentage.toFixed(2)}%`);

if (state.state === CircuitBreakerState.OPEN) {
  console.log(`Circuit will try recovery at: ${new Date(state.openUntil!)}`);
}
```

### Example 3: Rate Limiting

```typescript
import { RateLimiter } from '@emmvish/stable-request';

const limiter = new RateLimiter(100, 60000); // 100 requests per minute

// Execute with rate limiting
const results = await Promise.all(
  Array.from({ length: 150 }, (_, i) => 
    limiter.execute(async () => {
      return await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: `/data/${i}`
        },
        resReq: true
      });
    })
  )
);

// Check rate limiter stats
const state = limiter.getState();
console.log(`Throttled: ${state.throttledRequests}/${state.totalRequests}`);
console.log(`Average queue wait: ${state.averageQueueWaitTime.toFixed(2)}ms`);
console.log(`Current rate: ${state.currentRequestRate.toFixed(2)} req/s`);
```

### Example 4: Concurrency Control

```typescript
import { ConcurrencyLimiter } from '@emmvish/stable-request';

const limiter = new ConcurrencyLimiter(5); // Max 5 concurrent

// Process items with concurrency limit
const items = Array.from({ length: 50 }, (_, i) => i);

const results = await Promise.all(
  items.map(item =>
    limiter.execute(async () => {
      return await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: `/process/${item}`
        },
        resReq: true
      });
    })
  )
);

// Check concurrency stats
const state = limiter.getState();
console.log(`Peak concurrency: ${state.peakConcurrency}`);
console.log(`Success rate: ${state.successRate.toFixed(2)}%`);
console.log(`Average execution time: ${state.averageExecutionTime.toFixed(2)}ms`);
```

### Example 5: Function Result Caching

```typescript
import { FunctionCacheManager } from '@emmvish/stable-request';

const cache = new FunctionCacheManager({
  enabled: true,
  ttl: 600000, // 10 minutes
  maxSize: 500
});

async function expensiveComputation(a: number, b: number): Promise<number> {
  // Check cache first
  const cached = cache.get(expensiveComputation, [a, b]);
  if (cached) {
    console.log('Cache hit!');
    return cached.data;
  }
  
  // Perform expensive computation
  console.log('Cache miss, computing...');
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
  const result = a * b + Math.pow(a, b);
  
  // Store in cache
  cache.set(expensiveComputation, [a, b], result);
  
  return result;
}

// First call: cache miss (computes)
const result1 = await expensiveComputation(5, 3);

// Second call: cache hit (instant)
const result2 = await expensiveComputation(5, 3);

// Check cache stats
const stats = cache.getStats();
console.log(`Hit rate: ${stats.hitRate.toFixed(2)}%`);
```

### Example 6: Combined Infrastructure

```typescript
import {
  CacheManager,
  CircuitBreaker,
  RateLimiter,
  ConcurrencyLimiter,
  stableRequest
} from '@emmvish/stable-request';

// Initialize infrastructure
const cache = new CacheManager({
  enabled: true,
  ttl: 300000,
  maxSize: 200
});

const breaker = new CircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 10,
  recoveryTimeoutMs: 60000
});

const rateLimiter = new RateLimiter(100, 60000);
const concurrencyLimiter = new ConcurrencyLimiter(10);

// Use all together
async function robustApiCall(endpoint: string) {
  return await concurrencyLimiter.execute(async () => {
    return await rateLimiter.execute(async () => {
      return await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: endpoint
        },
        cache: cache,
        circuitBreaker: breaker,
        attempts: 3,
        wait: 1000,
        resReq: true
      });
    });
  });
}

// Make requests
const results = await Promise.all([
  robustApiCall('/endpoint1'),
  robustApiCall('/endpoint2'),
  robustApiCall('/endpoint3')
]);

// Aggregate metrics
console.log('Cache stats:', cache.getStats());
console.log('Circuit breaker state:', breaker.getState());
console.log('Rate limiter stats:', rateLimiter.getState());
console.log('Concurrency limiter stats:', concurrencyLimiter.getState());
```

---

## Advanced Use Cases

### Use Case 1: Multi-Tier Caching Strategy

```typescript
import { CacheManager, FunctionCacheManager } from '@emmvish/stable-request';

// HTTP response cache (short TTL)
const httpCache = new CacheManager({
  enabled: true,
  ttl: 60000, // 1 minute
  maxSize: 100
});

// Computation cache (long TTL)
const computeCache = new FunctionCacheManager({
  enabled: true,
  ttl: 600000, // 10 minutes
  maxSize: 500
});

async function getProcessedData(id: string) {
  // Check computation cache first
  const computeCached = computeCache.get(getProcessedData, [id]);
  if (computeCached) {
    return computeCached.data;
  }
  
  // Fetch from API (with HTTP cache)
  const rawData = await stableRequest({
    reqData: {
      hostname: 'api.example.com',
      path: `/data/${id}`
    },
    cache: httpCache,
    resReq: true
  });
  
  // Expensive processing
  const processed = await expensiveProcessing(rawData.data);
  
  // Cache processed result
  computeCache.set(getProcessedData, [id], processed);
  
  return processed;
}

// First call: Both caches miss
const data1 = await getProcessedData('123');

// Second call (within 1 min): Computation cache hit
const data2 = await getProcessedData('123');

// After 1 min (within 10 min): HTTP cache miss, computation cache hit
const data3 = await getProcessedData('123');
```

### Use Case 2: Adaptive Circuit Breaker with Fallback

```typescript
import { CircuitBreaker, CircuitBreakerState, CircuitBreakerOpenError } from '@emmvish/stable-request';

const primaryBreaker = new CircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 10,
  recoveryTimeoutMs: 60000
});

const fallbackBreaker = new CircuitBreaker({
  failureThresholdPercentage: 70,
  minimumRequests: 5,
  recoveryTimeoutMs: 30000
});

async function resilientApiCall(endpoint: string) {
  try {
    // Try primary service
    return await primaryBreaker.execute(async () => {
      primaryBreaker.recordAttemptFailure(); // Track attempt
      const result = await stableRequest({
        reqData: {
          hostname: 'primary-api.example.com',
          path: endpoint
        },
        resReq: true
      });
      primaryBreaker.recordAttemptSuccess();
      return { source: 'primary', data: result.data };
    });
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      console.log('Primary circuit open, using fallback');
    }
    
    // Fallback to secondary service
    return await fallbackBreaker.execute(async () => {
      const result = await stableRequest({
        reqData: {
          hostname: 'fallback-api.example.com',
          path: endpoint
        },
        resReq: true
      });
      return { source: 'fallback', data: result.data };
    });
  }
}

// Monitor health
setInterval(() => {
  const primaryState = primaryBreaker.getState();
  const fallbackState = fallbackBreaker.getState();
  
  console.log(`Primary: ${primaryState.state} (${primaryState.failurePercentage.toFixed(2)}% failure)`);
  console.log(`Fallback: ${fallbackState.state} (${fallbackState.failurePercentage.toFixed(2)}% failure)`);
}, 10000);
```

### Use Case 3: Smart Rate Limiting with Priority Queue

```typescript
import { RateLimiter } from '@emmvish/stable-request';

class PriorityRateLimiter {
  private highPriorityLimiter: RateLimiter;
  private normalPriorityLimiter: RateLimiter;
  
  constructor() {
    this.highPriorityLimiter = new RateLimiter(100, 60000); // 100/min
    this.normalPriorityLimiter = new RateLimiter(50, 60000);  // 50/min
  }
  
  async execute<T>(fn: () => Promise<T>, priority: 'high' | 'normal' = 'normal'): Promise<T> {
    const limiter = priority === 'high' 
      ? this.highPriorityLimiter 
      : this.normalPriorityLimiter;
    
    return await limiter.execute(fn);
  }
  
  getStats() {
    return {
      high: this.highPriorityLimiter.getState(),
      normal: this.normalPriorityLimiter.getState()
    };
  }
}

const priorityLimiter = new PriorityRateLimiter();

// High priority requests
await priorityLimiter.execute(
  async () => await criticalApiCall(),
  'high'
);

// Normal priority requests
await priorityLimiter.execute(
  async () => await regularApiCall(),
  'normal'
);
```

### Use Case 4: Dynamic Concurrency Adjustment

```typescript
import { ConcurrencyLimiter } from '@emmvish/stable-request';

class AdaptiveConcurrencyLimiter {
  private limiter: ConcurrencyLimiter;
  private currentLimit: number;
  private readonly minLimit = 5;
  private readonly maxLimit = 50;
  
  constructor(initialLimit: number = 10) {
    this.currentLimit = initialLimit;
    this.limiter = new ConcurrencyLimiter(this.currentLimit);
  }
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const result = await this.limiter.execute(fn);
    this.adjustConcurrency();
    return result;
  }
  
  private adjustConcurrency() {
    const state = this.limiter.getState();
    
    // Increase concurrency if high utilization and good success rate
    if (state.utilizationPercentage > 80 && state.successRate > 95) {
      this.currentLimit = Math.min(this.currentLimit + 1, this.maxLimit);
      this.limiter = new ConcurrencyLimiter(this.currentLimit);
      console.log(`Increased concurrency to ${this.currentLimit}`);
    }
    
    // Decrease concurrency if low success rate
    if (state.successRate < 80) {
      this.currentLimit = Math.max(this.currentLimit - 2, this.minLimit);
      this.limiter = new ConcurrencyLimiter(this.currentLimit);
      console.log(`Decreased concurrency to ${this.currentLimit}`);
    }
  }
  
  getState() {
    return {
      currentLimit: this.currentLimit,
      ...this.limiter.getState()
    };
  }
}

const adaptiveLimiter = new AdaptiveConcurrencyLimiter(10);

// Process with adaptive concurrency
for (let i = 0; i < 1000; i++) {
  await adaptiveLimiter.execute(async () => {
    return await stableRequest({
      reqData: { hostname: 'api.example.com', path: `/item/${i}` },
      resReq: true
    });
  });
}
```

### Use Case 5: Comprehensive Monitoring Dashboard

```typescript
import { MetricsAggregator, CacheManager, CircuitBreaker, RateLimiter, ConcurrencyLimiter } from '@emmvish/stable-request';

class InfrastructureMonitor {
  private cache: CacheManager;
  private breaker: CircuitBreaker;
  private rateLimiter: RateLimiter;
  private concurrencyLimiter: ConcurrencyLimiter;
  
  constructor(
    cache: CacheManager,
    breaker: CircuitBreaker,
    rateLimiter: RateLimiter,
    concurrencyLimiter: ConcurrencyLimiter
  ) {
    this.cache = cache;
    this.breaker = breaker;
    this.rateLimiter = rateLimiter;
    this.concurrencyLimiter = concurrencyLimiter;
  }
  
  getDashboard() {
    const cacheMetrics = MetricsAggregator.extractCacheMetrics(this.cache);
    const breakerMetrics = MetricsAggregator.extractCircuitBreakerMetrics(this.breaker);
    const rateLimiterMetrics = MetricsAggregator.extractRateLimiterMetrics(this.rateLimiter);
    const concurrencyMetrics = MetricsAggregator.extractConcurrencyLimiterMetrics(this.concurrencyLimiter);
    
    return {
      timestamp: new Date().toISOString(),
      cache: {
        status: cacheMetrics.isEffective ? 'Healthy' : 'Needs Attention',
        hitRate: cacheMetrics.hitRate,
        utilization: cacheMetrics.utilizationPercentage,
        performanceScore: cacheMetrics.performanceScore
      },
      circuitBreaker: {
        status: breakerMetrics.isHealthy ? 'Healthy' : 'Degraded',
        state: breakerMetrics.state,
        failureRate: breakerMetrics.failureRate,
        healthScore: breakerMetrics.healthScore
      },
      rateLimiter: {
        status: rateLimiterMetrics.isEfficient ? 'Efficient' : 'Congested',
        throttleRate: rateLimiterMetrics.throttleRate,
        queueLength: rateLimiterMetrics.currentQueueLength,
        efficiencyScore: rateLimiterMetrics.efficiencyScore
      },
      concurrency: {
        status: concurrencyMetrics.isOptimal ? 'Optimal' : 'Suboptimal',
        utilization: concurrencyMetrics.utilizationPercentage,
        successRate: concurrencyMetrics.successRate,
        performanceScore: concurrencyMetrics.performanceScore
      },
      overall: {
        healthy: breakerMetrics.isHealthy && cacheMetrics.isEffective,
        efficient: rateLimiterMetrics.isEfficient && concurrencyMetrics.isOptimal
      }
    };
  }
  
  startMonitoring(intervalMs: number = 10000) {
    setInterval(() => {
      const dashboard = this.getDashboard();
      console.log('=== Infrastructure Dashboard ===');
      console.log(JSON.stringify(dashboard, null, 2));
      
      // Alert on issues
      if (!dashboard.overall.healthy) {
        console.warn('⚠️  System health degraded!');
      }
      if (!dashboard.overall.efficient) {
        console.warn('⚠️  System efficiency suboptimal!');
      }
    }, intervalMs);
  }
}

// Initialize and monitor
const monitor = new InfrastructureMonitor(cache, breaker, rateLimiter, concurrencyLimiter);
monitor.startMonitoring(10000); // Every 10 seconds
```

---

## Best Practices

### Cache Manager

1. **Set Appropriate TTL** based on data freshness requirements
   ```typescript
   // Frequently changing data: short TTL
   const cache = new CacheManager({ enabled: true, ttl: 30000 }); // 30 seconds
   
   // Stable data: long TTL
   const cache = new CacheManager({ enabled: true, ttl: 3600000 }); // 1 hour
   ```

2. **Respect Cache-Control Headers** for HTTP compliance
   ```typescript
   const cache = new CacheManager({
     enabled: true,
     respectCacheControl: true
   });
   ```

3. **Exclude Non-Idempotent Methods** from caching
   ```typescript
   const cache = new CacheManager({
     enabled: true,
     excludeMethods: ['POST', 'PUT', 'PATCH', 'DELETE']
   });
   ```

4. **Monitor Cache Effectiveness** regularly
   ```typescript
   const stats = cache.getStats();
   if (stats.hitRate < 30) {
     console.warn('Low cache hit rate, consider adjusting TTL or size');
   }
   ```

5. **Prune Expired Entries** periodically
   ```typescript
   setInterval(() => {
     const pruned = cache.prune();
     console.log(`Pruned ${pruned} expired entries`);
   }, 300000); // Every 5 minutes
   ```

### Circuit Breaker

6. **Choose Appropriate Thresholds** for your service
   ```typescript
   // Strict: Low tolerance for failures
   const breaker = new CircuitBreaker({
     failureThresholdPercentage: 30,
     minimumRequests: 5,
     recoveryTimeoutMs: 30000
   });
   
   // Lenient: High tolerance for failures
   const breaker = new CircuitBreaker({
     failureThresholdPercentage: 70,
     minimumRequests: 20,
     recoveryTimeoutMs: 120000
   });
   ```

7. **Monitor Circuit State** and alert on transitions
   ```typescript
   const state = breaker.getState();
   if (state.state === CircuitBreakerState.OPEN) {
     alertOps('Circuit breaker opened', state);
   }
   ```

8. **Track Recovery Success Rate** for tuning
   ```typescript
   const state = breaker.getState();
   if (state.recoverySuccessRate < 50) {
     console.warn('Low recovery success rate, consider increasing timeout');
   }
   ```

### Rate Limiter

9. **Set Realistic Rate Limits** based on service capacity
   ```typescript
   // Match API provider limits
   const limiter = new RateLimiter(1000, 60000); // 1000 req/min
   ```

10. **Monitor Queue Lengths** to detect bottlenecks
    ```typescript
    const state = limiter.getState();
    if (state.queueLength > 100) {
      console.warn('Rate limiter queue growing, consider increasing limit');
    }
    ```

### Concurrency Limiter

11. **Start Conservative** and increase based on performance
    ```typescript
    const limiter = new ConcurrencyLimiter(5); // Start low
    // Monitor and adjust based on metrics
    ```

12. **Monitor Utilization** for optimization
    ```typescript
    const state = limiter.getState();
    if (state.utilizationPercentage < 50) {
      console.log('Low utilization, can increase concurrency limit');
    }
    ```

### General

13. **Use Global Instances** for shared infrastructure
    ```typescript
    const cache = getGlobalCacheManager({ enabled: true, ttl: 300000 });
    const breaker = getGlobalCircuitBreaker({
      failureThresholdPercentage: 50,
      minimumRequests: 10,
      recoveryTimeoutMs: 60000
    });
    ```

14. **Combine Utilities** for comprehensive resilience
    ```typescript
    // Layer: Concurrency → Rate Limiting → Circuit Breaker → Cache
    await concurrencyLimiter.execute(async () =>
      await rateLimiter.execute(async () =>
        await stableRequest({
          reqData: { /* ... */ },
          cache: cache,
          circuitBreaker: breaker
        })
      )
    );
    ```

15. **Extract and Monitor Metrics** continuously
    ```typescript
    const metrics = MetricsAggregator.aggregateSystemMetrics(
      workflowResult,
      circuitBreaker,
      cache,
      rateLimiter,
      concurrencyLimiter
    );
    
    sendToMonitoring(metrics);
    ```

---

## Support

For issues, questions, or contributions:

- **GitHub**: [https://github.com/emmvish/stable-request](https://github.com/emmvish/stable-request)
- **NPM**: [https://www.npmjs.com/package/@emmvish/stable-request](https://www.npmjs.com/package/@emmvish/stable-request)
- **Issues**: [https://github.com/emmvish/stable-request/issues](https://github.com/emmvish/stable-request/issues)
