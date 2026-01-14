# @emmvish/stable-request

A production-grade HTTP Workflow Execution Engine for Node.js that transforms unreliable API calls into resilient, observable, and sophisticated multi-phase workflows with intelligent retry strategies, circuit breakers, and advanced execution patterns.

## Navigation

- [Overview](#overview)
- [Why stable-request?](#why-stable-request)
- [Installation](#installation)
- [Quick Start](#quick-start)
  - [Single Request with Retry](#single-request-with-retry)
  - [Batch Requests (API Gateway)](#batch-requests-api-gateway)
  - [Multi-Phase Workflow](#multi-phase-workflow)
- [Core Features](#core-features)
  - [Intelligent Retry Strategies](#intelligent-retry-strategies)
  - [Circuit Breaker Pattern](#circuit-breaker-pattern)
  - [Response Caching](#response-caching)
  - [Rate Limiting and Concurrency Control](#rate-limiting-and-concurrency-control)
- [Metrics and Observability](#metrics-and-observability)
  - [Request-Level Metrics](#request-level-metrics)
  - [API Gateway Metrics](#api-gateway-metrics)
  - [Workflow Metrics](#workflow-metrics)
  - [MetricsAggregator Utility](#metricsaggregator-utility)
- [Workflow Execution Patterns](#workflow-execution-patterns)
  - [Sequential and Concurrent Phases](#sequential-and-concurrent-phases)
  - [Mixed Execution Mode](#mixed-execution-mode)
  - [Non-Linear Workflows](#non-linear-workflows)
  - [Branched Workflows](#branched-workflows)
- [Advanced Capabilities](#advanced-capabilities)
  - [Config Cascading](#config-cascading)
  - [Request Grouping](#request-grouping)
  - [Shared Buffer and Pre-Execution Hooks](#shared-buffer-and-pre-execution-hooks)
  - [State Persistence and Recovery](#state-persistence-and-recovery)
  - [Comprehensive Observability](#comprehensive-observability)
  - [Trial Mode](#trial-mode)
- [Common Use Cases](#common-use-cases)
- [License](#license)

## Overview

`@emmvish/stable-request` is engineered for applications requiring robust orchestration of complex, multi-step API interactions with enterprise-grade reliability, observability, and fault tolerance. It goes far beyond simple HTTP clients by providing:

- **Workflow-First Architecture**: Organize API calls into phases, branches, and decision trees with full control over execution order
- **Enterprise Resilience**: Built-in circuit breakers, configurable retry strategies, and sophisticated failure handling
- **Execution Flexibility**: Sequential, concurrent, mixed, and non-linear execution patterns to match your business logic
- **Production-Ready Observability**: Comprehensive hooks for monitoring, logging, error analysis, and execution history tracking
- **Performance Optimization**: Response caching, rate limiting, and concurrency control to maximize efficiency
- **Type Safety**: Full TypeScript support with 40+ exported types

## Why stable-request?

Modern applications often need to:
- **Orchestrate complex API workflows** with dependencies between steps
- **Handle unreliable APIs** with intelligent retry and fallback mechanisms
- **Prevent cascade failures** when downstream services fail
- **Optimize performance** by caching responses and controlling request rates
- **Monitor and debug** complex request flows in production
- **Implement conditional logic** based on API responses (branching, looping)

`@emmvish/stable-request` solves all these challenges with a unified, type-safe API that scales from simple requests to sophisticated multi-phase workflows.

## Installation

```bash
npm install @emmvish/stable-request
```

**Requirements**: Node.js 14+ (ES Modules)

## Quick Start

### Single Request with Retry

Execute a single HTTP request with automatic retry on failure:

```typescript
import { stableRequest, RETRY_STRATEGIES } from '@emmvish/stable-request';

const userData = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/users/123',
    headers: { 'Authorization': 'Bearer token' }
  },                         // 'GET' is default HTTP method, if not specified
  resReq: true,              // Return response data
  attempts: 3,               // Retry up to 3 times
  wait: 1000,                // 1 second between retries
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
  logAllErrors: true         // Log all failed attempts
});

console.log(userData); // { id: 123, name: 'John' }
```

### Batch Requests (API Gateway)

Execute multiple requests concurrently or sequentially:

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
    requestOptions: { 
      reqData: { path: '/orders' }, 
      resReq: true 
    } 
  },
  { 
    id: 'products', 
    requestOptions: { 
      reqData: { path: '/products' }, 
      resReq: true 
    } 
  }
];

const results = await stableApiGateway(requests, {
  concurrentExecution: true,                    // Execute in parallel
  commonRequestData: { 
    hostname: 'api.example.com',
    headers: { 'X-API-Key': 'secret' }
  },
  commonAttempts: 2,                           // Retry each request twice
  commonWait: 500
});

results.forEach(result => {
  console.log(`${result.id}:`, result.data);
});
```

### Multi-Phase Workflow

Orchestrate complex workflows with multiple phases:

```typescript
import { stableWorkflow, PHASE_DECISION_ACTIONS, REQUEST_METHODS } from '@emmvish/stable-request';

const phases = [
  {
    id: 'authentication',
    requests: [
      { 
        id: 'login', 
        requestOptions: { 
          reqData: { 
            path: '/auth/login',
            method: REQUEST_METHODS.POST,
            body: { username: 'user', password: 'pass' }
          }, 
          resReq: true 
        } 
      }
    ]
  },
  {
    id: 'fetch-data',
    concurrentExecution: true,                  // Execute requests in parallel
    requests: [
      { id: 'user-profile', requestOptions: { reqData: { path: '/profile' }, resReq: true } },
      { id: 'user-orders', requestOptions: { reqData: { path: '/orders' }, resReq: true } },
      { id: 'user-settings', requestOptions: { reqData: { path: '/settings' }, resReq: true } }
    ]
  },
  {
    id: 'process-data',
    requests: [
      { 
        id: 'update-analytics', 
        requestOptions: { 
          reqData: { path: '/analytics', method: REQUEST_METHODS.POST }, 
          resReq: false 
        } 
      }
    ]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'user-data-sync',
  commonRequestData: { hostname: 'api.example.com' },
  commonAttempts: 3,
  stopOnFirstPhaseError: true,                  // Stop if any phase fails
  logPhaseResults: true                          // Log each phase completion
});

console.log(`Workflow completed: ${result.success}`);
console.log(`Total requests: ${result.totalRequests}`);
console.log(`Successful: ${result.successfulRequests}`);
console.log(`Failed: ${result.failedRequests}`);
console.log(`Execution time: ${result.executionTime}ms`);
```

## Core Features

### Intelligent Retry Strategies

Automatically retry failed requests with sophisticated backoff strategies:

```typescript
import { stableRequest, RETRY_STRATEGIES } from '@emmvish/stable-request';

// Fixed delay: constant wait time
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  attempts: 5,
  wait: 1000,                                   // 1 second between each retry
  retryStrategy: RETRY_STRATEGIES.FIXED
});

// Linear backoff: incrementally increasing delays
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  attempts: 5,
  wait: 1000,                                   // 1s, 2s, 3s, 4s, 5s
  retryStrategy: RETRY_STRATEGIES.LINEAR
});

// Exponential backoff: exponentially growing delays
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  attempts: 5,
  wait: 1000,                                   // 1s, 2s, 4s, 8s, 16s
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
});
```

**Features**:
- Automatic retry on 5xx errors and network failures
- No retry on 4xx client errors (configurable)
- Maximum allowed wait time to prevent excessive delays
- Per-request or workflow-level configuration

**Custom Response Validation**:
```typescript
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/job/status' },
  resReq: true,
  attempts: 10,
  wait: 2000,
  responseAnalyzer: async ({ data }) => {
    // Retry until job is complete
    return data.status === 'completed';
  }
});
```

### Circuit Breaker Pattern

Prevent cascade failures and system overload with built-in circuit breakers:

```typescript
import { stableRequest, CircuitBreakerState } from '@emmvish/stable-request';

await stableRequest({
  reqData: { hostname: 'unreliable-api.example.com', path: '/data' },
  attempts: 3,
  circuitBreaker: {
    failureThresholdPercentage: 50,             // Open after 50% failures
    minimumRequests: 10,                        // Minimum requests before evaluation
    recoveryTimeoutMs: 60000,                   // Wait 60s before trying again (half-open)
    successThresholdPercentage: 20,             // Close after 20% successes in half-open
    trackIndividualAttempts: false              // Track at request level (not attempt level)
  }
});
```

**Circuit Breaker States**:
- **CLOSED**: Normal operation, requests flow through
- **OPEN**: Too many failures, requests blocked immediately
- **HALF_OPEN**: Testing if service recovered, limited requests allowed

**Workflow-Level Circuit Breakers**:
```typescript
import { CircuitBreaker } from '@emmvish/stable-request';

const sharedBreaker = new CircuitBreaker({
  failureThresholdPercentage: 50,               // 50% failure rate triggers open
  minimumRequests: 10,                          // Minimum 10 requests before evaluation
  recoveryTimeoutMs: 120000,                    // 120s timeout in open state
  successThresholdPercentage: 50                // 50% success rate closes circuit
});

await stableWorkflow(phases, {
  circuitBreaker: sharedBreaker,                // Shared across all requests
  commonRequestData: { hostname: 'api.example.com' }
});

// Check circuit breaker state
console.log(sharedBreaker.getState());
// { state: 'CLOSED', failures: 0, successes: 0, ... }
```

### Response Caching

Reduce redundant API calls and improve performance with intelligent caching:

```typescript
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/static-data' },
  resReq: true,
  cache: {
    enabled: true,
    ttl: 300000,                                // Cache for 5 minutes
    key: 'custom-cache-key'                     // Optional: custom cache key
  }
});

// Subsequent identical requests within 5 minutes will use cached response
```

**Global Cache Management**:
```typescript
import { getGlobalCacheManager, resetGlobalCacheManager } from '@emmvish/stable-request';

const cacheManager = getGlobalCacheManager();

// Inspect cache statistics
const stats = cacheManager.getStats();
console.log(stats);
// { size: 42, validEntries: 38, expiredEntries: 4 }

// Clear all cached responses
cacheManager.clearAll();

// Or reset the global cache instance
resetGlobalCacheManager();
```

**Cache Features**:
- Automatic request fingerprinting (method, URL, headers, body)
- TTL-based expiration
- Workflow-wide sharing across phases and branches
- Manual cache inspection and clearing
- Per-request cache configuration

### Rate Limiting and Concurrency Control

Respect API rate limits and control system load:

```typescript
await stableWorkflow(phases, {
  commonRequestData: { hostname: 'api.example.com' },
  
  // Rate limiting (token bucket algorithm)
  rateLimit: {
    maxRequests: 100,                           // 100 requests
    windowMs: 60000                             // per 60 seconds
  },
  
  // Concurrency limiting
  maxConcurrentRequests: 5                      // Max 5 parallel requests
});
```

**Per-Phase Configuration**:
```typescript
const phases = [
  {
    id: 'bulk-import',
    maxConcurrentRequests: 10,                  // Override workflow limit
    rateLimit: {
      maxRequests: 50,
      windowMs: 10000
    },
    requests: [...]
  }
];
```

**Standalone Rate Limiter**:
```typescript
import { RateLimiter } from '@emmvish/stable-request';

const limiter = new RateLimiter(1000, 3600000); // 1000 requests per hour

const state = await limiter.getState();          // Get current state
console.log(state);
// { availableTokens: 1000, queueLength: 0, maxRequests: 1000, windowMs: 3600000 }
```

## Metrics and Observability

`@emmvish/stable-request` provides comprehensive metrics at every level of execution, from individual requests to complete workflows. All metrics are automatically computed and included in results.

### Request-Level Metrics

Every `stableRequest` call returns detailed metrics about the request execution:

```typescript
import { stableRequest } from '@emmvish/stable-request';

const result = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/users/123'
  },
  resReq: true,
  attempts: 3,
  wait: 1000,
  logAllErrors: true
});

// Access request metrics
console.log('Request Result:', {
  success: result.success,              // true/false
  data: result.data,                    // Response data
  error: result.error,                  // Error message (if failed)
  errorLogs: result.errorLogs,          // All failed attempts
  successfulAttempts: result.successfulAttempts,  // All successful attempts
  metrics: {
    totalAttempts: result.metrics.totalAttempts,           // 3
    successfulAttempts: result.metrics.successfulAttempts, // 1
    failedAttempts: result.metrics.failedAttempts,         // 2
    totalExecutionTime: result.metrics.totalExecutionTime, // ms
    averageAttemptTime: result.metrics.averageAttemptTime, // ms
    infrastructureMetrics: {
      circuitBreaker: result.metrics.infrastructureMetrics?.circuitBreaker,
      cache: result.metrics.infrastructureMetrics?.cache
    }
  }
});

// Error logs provide detailed attempt information
result.errorLogs?.forEach(log => {
  console.log({
    attempt: log.attempt,              // "1/3"
    timestamp: log.timestamp,
    error: log.error,
    statusCode: log.statusCode,
    type: log.type,                    // "HTTP_ERROR" | "INVALID_CONTENT"
    isRetryable: log.isRetryable,
    executionTime: log.executionTime
  });
});

// Successful attempts show what worked
result.successfulAttempts?.forEach(attempt => {
  console.log({
    attempt: attempt.attempt,          // "3/3"
    timestamp: attempt.timestamp,
    executionTime: attempt.executionTime,
    data: attempt.data,
    statusCode: attempt.statusCode
  });
});
```

**STABLE_REQUEST_RESULT Structure:**
- `success`: Boolean indicating if request succeeded
- `data`: Response data (if `resReq: true`)
- `error`: Error message (if request failed)
- `errorLogs`: Array of all failed attempt details
- `successfulAttempts`: Array of all successful attempt details
- `metrics`: Computed execution metrics and infrastructure statistics

### API Gateway Metrics

`stableApiGateway` provides aggregated metrics for batch requests:

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

const requests = [
  { id: 'user-1', groupId: 'users', requestOptions: { reqData: { path: '/users/1' }, resReq: true } },
  { id: 'user-2', groupId: 'users', requestOptions: { reqData: { path: '/users/2' }, resReq: true } },
  { id: 'order-1', groupId: 'orders', requestOptions: { reqData: { path: '/orders/1' }, resReq: true } },
  { id: 'product-1', requestOptions: { reqData: { path: '/products/1' }, resReq: true } }
];

const results = await stableApiGateway(requests, {
  concurrentExecution: true,
  commonRequestData: { hostname: 'api.example.com' },
  commonAttempts: 3,
  circuitBreaker: { failureThresholdPercentage: 50, minimumRequests: 5 },
  rateLimit: { maxRequests: 100, windowMs: 60000 },
  maxConcurrentRequests: 5
});

// Gateway-level metrics
console.log('Gateway Metrics:', {
  totalRequests: results.metrics.totalRequests,           // 4
  successfulRequests: results.metrics.successfulRequests, // 3
  failedRequests: results.metrics.failedRequests,         // 1
  successRate: results.metrics.successRate,               // 75%
  failureRate: results.metrics.failureRate                // 25%
});

// Request group metrics
results.metrics.requestGroups?.forEach(group => {
  console.log(`Group ${group.groupId}:`, {
    totalRequests: group.totalRequests,
    successfulRequests: group.successfulRequests,
    failedRequests: group.failedRequests,
    successRate: group.successRate,                      // %
    failureRate: group.failureRate,                      // %
    requestIds: group.requestIds                         // Array of request IDs
  });
});

// Infrastructure metrics (when utilities are used)
if (results.metrics.infrastructureMetrics) {
  const infra = results.metrics.infrastructureMetrics;
  
  // Circuit Breaker metrics
  if (infra.circuitBreaker) {
    console.log('Circuit Breaker:', {
      state: infra.circuitBreaker.state,                 // CLOSED | OPEN | HALF_OPEN
      isHealthy: infra.circuitBreaker.isHealthy,
      totalRequests: infra.circuitBreaker.totalRequests,
      failurePercentage: infra.circuitBreaker.failurePercentage,
      openCount: infra.circuitBreaker.openCount,
      recoveryAttempts: infra.circuitBreaker.recoveryAttempts
    });
  }
  
  // Cache metrics
  if (infra.cache) {
    console.log('Cache:', {
      hitRate: infra.cache.hitRate,                      // %
      currentSize: infra.cache.currentSize,
      networkRequestsSaved: infra.cache.networkRequestsSaved,
      cacheEfficiency: infra.cache.cacheEfficiency       // %
    });
  }
  
  // Rate Limiter metrics
  if (infra.rateLimiter) {
    console.log('Rate Limiter:', {
      throttledRequests: infra.rateLimiter.throttledRequests,
      throttleRate: infra.rateLimiter.throttleRate,      // %
      peakRequestRate: infra.rateLimiter.peakRequestRate
    });
  }
  
  // Concurrency Limiter metrics
  if (infra.concurrencyLimiter) {
    console.log('Concurrency:', {
      peakConcurrency: infra.concurrencyLimiter.peakConcurrency,
      utilizationPercentage: infra.concurrencyLimiter.utilizationPercentage,
      averageQueueWaitTime: infra.concurrencyLimiter.averageQueueWaitTime
    });
  }
}
```

### Workflow Metrics

`stableWorkflow` provides end-to-end metrics for complex orchestrations:

```typescript
import { stableWorkflow, PHASE_DECISION_ACTIONS } from '@emmvish/stable-request';

const phases = [
  {
    id: 'fetch-users',
    requests: [/* ... */]
  },
  {
    id: 'process-data',
    concurrent: true,
    requests: [/* ... */]
  },
  {
    id: 'store-results',
    requests: [/* ... */]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'data-processing-pipeline',
  enableMixedExecution: true,
  commonRequestData: { hostname: 'api.example.com' },
  logPhaseResults: true
});

// Workflow-level metrics
console.log('Workflow Metrics:', {
  workflowId: result.metrics.workflowId,
  success: result.metrics.success,
  executionTime: result.metrics.executionTime,           // Total time in ms
  
  // Phase statistics
  totalPhases: result.metrics.totalPhases,
  completedPhases: result.metrics.completedPhases,
  skippedPhases: result.metrics.skippedPhases,
  failedPhases: result.metrics.failedPhases,
  phaseCompletionRate: result.metrics.phaseCompletionRate,  // %
  averagePhaseExecutionTime: result.metrics.averagePhaseExecutionTime,  // ms
  
  // Request statistics
  totalRequests: result.metrics.totalRequests,
  successfulRequests: result.metrics.successfulRequests,
  failedRequests: result.metrics.failedRequests,
  requestSuccessRate: result.metrics.requestSuccessRate,    // %
  requestFailureRate: result.metrics.requestFailureRate,    // %
  
  // Performance
  throughput: result.metrics.throughput,                    // requests/second
  totalPhaseReplays: result.metrics.totalPhaseReplays,
  totalPhaseSkips: result.metrics.totalPhaseSkips,
  
  // Branch metrics (if using branch execution)
  totalBranches: result.metrics.totalBranches,
  completedBranches: result.metrics.completedBranches,
  failedBranches: result.metrics.failedBranches,
  branchSuccessRate: result.metrics.branchSuccessRate       // %
});

// Request group metrics aggregated across entire workflow
result.requestGroupMetrics?.forEach(group => {
  console.log(`Request Group ${group.groupId}:`, {
    totalRequests: group.totalRequests,
    successRate: group.successRate,                        // %
    requestIds: group.requestIds
  });
});

// Per-phase metrics
result.phases.forEach(phase => {
  console.log(`Phase ${phase.phaseId}:`, {
    executionTime: phase.metrics?.executionTime,
    totalRequests: phase.metrics?.totalRequests,
    successfulRequests: phase.metrics?.successfulRequests,
    requestSuccessRate: phase.metrics?.requestSuccessRate,  // %
    hasDecision: phase.metrics?.hasDecision,
    decisionAction: phase.metrics?.decisionAction          // CONTINUE | JUMP | REPLAY | etc.
  });
});

// Branch metrics (for branched workflows)
result.branches?.forEach(branch => {
  console.log(`Branch ${branch.branchId}:`, {
    success: branch.metrics?.success,
    executionTime: branch.metrics?.executionTime,
    totalPhases: branch.metrics?.totalPhases,
    completedPhases: branch.metrics?.completedPhases,
    totalRequests: branch.metrics?.totalRequests,
    requestSuccessRate: branch.metrics?.requestSuccessRate  // %
  });
});
```

### MetricsAggregator Utility

For custom metrics extraction and analysis:

```typescript
import { MetricsAggregator } from '@emmvish/stable-request';

// Extract workflow metrics
const workflowMetrics = MetricsAggregator.extractWorkflowMetrics(workflowResult);

// Extract phase metrics
const phaseMetrics = MetricsAggregator.extractPhaseMetrics(phaseResult);

// Extract branch metrics
const branchMetrics = MetricsAggregator.extractBranchMetrics(branchResult);

// Extract request group metrics
const requestGroups = MetricsAggregator.extractRequestGroupMetrics(responses);

// Extract individual request metrics
const requestMetrics = MetricsAggregator.extractRequestMetrics(responses);

// Extract circuit breaker metrics
const cbMetrics = MetricsAggregator.extractCircuitBreakerMetrics(circuitBreaker);

// Extract cache metrics
const cacheMetrics = MetricsAggregator.extractCacheMetrics(cacheManager);

// Extract rate limiter metrics
const rateLimiterMetrics = MetricsAggregator.extractRateLimiterMetrics(rateLimiter);

// Extract concurrency limiter metrics
const concurrencyMetrics = MetricsAggregator.extractConcurrencyLimiterMetrics(limiter);

// Aggregate all system metrics
const systemMetrics = MetricsAggregator.aggregateSystemMetrics(
  workflowResult,
  circuitBreaker,
  cacheManager,
  rateLimiter,
  concurrencyLimiter
);

console.log('Complete System View:', {
  workflow: systemMetrics.workflow,
  phases: systemMetrics.phases,
  branches: systemMetrics.branches,
  requestGroups: systemMetrics.requestGroups,
  requests: systemMetrics.requests,
  circuitBreaker: systemMetrics.circuitBreaker,
  cache: systemMetrics.cache,
  rateLimiter: systemMetrics.rateLimiter,
  concurrencyLimiter: systemMetrics.concurrencyLimiter
});
```

**Available Metrics Types:**
- `WorkflowMetrics`: Complete workflow statistics
- `BranchMetrics`: Branch execution metrics
- `PhaseMetrics`: Individual phase metrics
- `RequestGroupMetrics`: Grouped request statistics
- `RequestMetrics`: Individual request metrics
- `CircuitBreakerDashboardMetrics`: Circuit breaker state and performance
- `CacheDashboardMetrics`: Cache hit rates and efficiency
- `RateLimiterDashboardMetrics`: Throttling and rate limit statistics
- `ConcurrencyLimiterDashboardMetrics`: Concurrency and queue metrics
- `SystemMetrics`: Complete system-wide aggregation

## Workflow Execution Patterns

### Sequential and Concurrent Phases

Control execution order at the phase and request level:

**Sequential Phases (Default)**:
```typescript
const phases = [
  { id: 'step-1', requests: [...] },            // Executes first
  { id: 'step-2', requests: [...] },            // Then this
  { id: 'step-3', requests: [...] }             // Finally this
];

await stableWorkflow(phases, {
  commonRequestData: { hostname: 'api.example.com' }
});
```

**Concurrent Phases**:
```typescript
const phases = [
  { id: 'init', requests: [...] },
  { id: 'parallel-1', requests: [...] },
  { id: 'parallel-2', requests: [...] }
];

await stableWorkflow(phases, {
  concurrentPhaseExecution: true,               // All phases run in parallel
  commonRequestData: { hostname: 'api.example.com' }
});
```

**Concurrent Requests Within Phase**:
```typescript
const phases = [
  {
    id: 'data-fetch',
    concurrentExecution: true,                  // Requests run in parallel
    requests: [
      { id: 'users', requestOptions: { reqData: { path: '/users' }, resReq: true } },
      { id: 'products', requestOptions: { reqData: { path: '/products' }, resReq: true } },
      { id: 'orders', requestOptions: { reqData: { path: '/orders' }, resReq: true } }
    ]
  }
];
```

**Stop on First Error**:
```typescript
const phases = [
  {
    id: 'critical-phase',
    stopOnFirstError: true,                     // Stop phase if any request fails
    requests: [...]
  }
];

await stableWorkflow(phases, {
  stopOnFirstPhaseError: true,                  // Stop workflow if any phase fails
  commonRequestData: { hostname: 'api.example.com' }
});
```

### Mixed Execution Mode

Combine sequential and concurrent phases for fine-grained control:

```typescript
const phases = [
  { 
    id: 'authenticate', 
    requests: [{ id: 'login', requestOptions: {...} }] 
  },
  { 
    id: 'fetch-user-data',
    markConcurrentPhase: true,                  // This phase runs concurrently...
    requests: [{ id: 'profile', requestOptions: {...} }]
  },
  { 
    id: 'fetch-orders',
    markConcurrentPhase: true,                  // ...with this phase
    requests: [{ id: 'orders', requestOptions: {...} }]
  },
  { 
    id: 'process-results',                      // This waits for above to complete
    requests: [{ id: 'analytics', requestOptions: {...} }]
  }
];

await stableWorkflow(phases, {
  enableMixedExecution: true,                   // Enable mixed execution mode
  commonRequestData: { hostname: 'api.example.com' }
});
```

**Use Case**: Authenticate first (sequential), then fetch multiple data sources in parallel (concurrent), then process results (sequential).

### Non-Linear Workflows

Build dynamic workflows with conditional branching, looping, and early termination:

```typescript
import { PHASE_DECISION_ACTIONS } from '@emmvish/stable-request';

const phases = [
  {
    id: 'validate-user',
    requests: [
      { id: 'check', requestOptions: { reqData: { path: '/validate' }, resReq: true } }
    ],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      const isValid = phaseResult.responses[0]?.data?.isValid;
      
      if (isValid) {
        // Jump directly to success phase
        return { 
          action: PHASE_DECISION_ACTIONS.JUMP, 
          targetPhaseId: 'success-flow' 
        };
      } else {
        // Continue to retry logic
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      }
    }
  },
  {
    id: 'retry-validation',
    allowReplay: true,
    maxReplayCount: 3,
    requests: [
      { id: 'retry', requestOptions: { reqData: { path: '/retry-validate' }, resReq: true } }
    ],
    phaseDecisionHook: async ({ phaseResult, executionHistory }) => {
      const replayCount = executionHistory.filter(
        h => h.phaseId === 'retry-validation'
      ).length;
      
      const success = phaseResult.responses[0]?.data?.success;
      
      if (success) {
        return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'success-flow' };
      } else if (replayCount < 3) {
        return { action: PHASE_DECISION_ACTIONS.REPLAY };
      } else {
        return { action: PHASE_DECISION_ACTIONS.TERMINATE, metadata: { reason: 'Max retries exceeded' } };
      }
    }
  },
  {
    id: 'success-flow',
    requests: [
      { id: 'finalize', requestOptions: { reqData: { path: '/finalize' }, resReq: true } }
    ]
  }
];

const result = await stableWorkflow(phases, {
  enableNonLinearExecution: true,               // Enable non-linear execution
  workflowId: 'adaptive-validation',
  commonRequestData: { hostname: 'api.example.com' }
});

console.log(result.executionHistory);
// Array of execution records showing which phases ran and why
```

**Phase Decision Actions**:
- **CONTINUE**: Proceed to next sequential phase (default)
- **JUMP**: Skip to a specific phase by ID
- **SKIP**: Skip upcoming phases until a target phase (or end)
- **REPLAY**: Re-execute the current phase (requires `allowReplay: true`)
- **TERMINATE**: Stop the entire workflow immediately

**Decision Hook Context**:
```typescript
phaseDecisionHook: async ({ 
  phaseResult,          // Current phase execution result
  executionHistory,     // Array of all executed phases
  sharedBuffer,         // Cross-phase shared state
  concurrentResults     // Results from concurrent phases (mixed execution)
}) => {
  // Your decision logic
  return { action: PHASE_DECISION_ACTIONS.CONTINUE };
}
```

**Replay Limits**:
```typescript
{
  id: 'polling-phase',
  allowReplay: true,
  maxReplayCount: 10,                           // Maximum 10 replays
  requests: [...],
  phaseDecisionHook: async ({ phaseResult }) => {
    if (phaseResult.responses[0]?.data?.ready) {
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
    return { action: PHASE_DECISION_ACTIONS.REPLAY };
  }
}
```

### Dynamic Phase and Branch Addition

Dynamically add phases or branches during workflow execution based on runtime conditions:

**Adding Phases Dynamically**:
```typescript
const phases = [
  {
    id: 'initial-phase',
    requests: [...],
    phaseDecisionHook: async ({ phaseResult }) => {
      const needsExtraProcessing = phaseResult.responses[0]?.data?.requiresValidation;
      
      if (needsExtraProcessing) {
        return {
          action: PHASE_DECISION_ACTIONS.CONTINUE,
          addPhases: [
            {
              id: 'validation-phase',
              requests: [{ id: 'validate', requestOptions: { reqData: { path: '/validate' }, resReq: true } }]
            }
          ]
        };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  }
];

await stableWorkflow(phases, {
  enableNonLinearExecution: true,
  commonRequestData: { hostname: 'api.example.com' }
});
```

**Adding Branches Dynamically**:
```typescript
const branches = [
  {
    id: 'main-branch',
    phases: [...],
    branchDecisionHook: async ({ branchResults }) => {
      const requiresAudit = branchResults.some(p => p.responses[0]?.data?.flagged);
      
      if (requiresAudit) {
        return {
          action: PHASE_DECISION_ACTIONS.CONTINUE,
          addBranches: [
            {
              id: 'audit-branch',
              phases: [{ id: 'audit', requests: [...] }]
            }
          ]
        };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  }
];

await stableWorkflow([], {
  enableBranchExecution: true,
  branches,
  commonRequestData: { hostname: 'api.example.com' }
});
```

**Extending Current Branch**:
```typescript
branchDecisionHook: async ({ branchResults }) => {
  return {
    action: PHASE_DECISION_ACTIONS.CONTINUE,
    addPhases: [
      { id: 'extra-phase', requests: [...] }  // Branch re-executes with new phases
    ]
  };
}
```

### Branched Workflows

Execute multiple independent workflow paths in parallel or sequentially:

```typescript
const branches = [
  {
    id: 'user-flow',
    markConcurrentBranch: true,                 // Execute in parallel
    phases: [
      { id: 'fetch-user', requests: [...] },
      { id: 'update-user', requests: [...] }
    ]
  },
  {
    id: 'analytics-flow',
    markConcurrentBranch: true,                 // Execute in parallel
    phases: [
      { id: 'log-event', requests: [...] },
      { id: 'update-metrics', requests: [...] }
    ]
  },
  {
    id: 'cleanup-flow',                         // Sequential (waits for above)
    phases: [
      { id: 'clear-cache', requests: [...] },
      { id: 'notify', requests: [...] }
    ]
  }
];

const result = await stableWorkflow([], {       // Empty phases array
  enableBranchExecution: true,
  branches,
  workflowId: 'multi-branch-workflow',
  commonRequestData: { hostname: 'api.example.com' }
});

console.log(result.branches);                   // Branch execution results
console.log(result.branchExecutionHistory);     // Branch-level execution history
```

**Branch-Level Configuration**:
```typescript
const branches = [
  {
    id: 'high-priority-branch',
    markConcurrentBranch: false,
    commonConfig: {                             // Branch-level config overrides
      commonAttempts: 5,
      commonWait: 2000,
      commonCache: { enabled: true, ttl: 120000 }
    },
    phases: [...]
  }
];
```

**Branch Features**:
- Each branch has independent phase execution
- Branches share the workflow's `sharedBuffer`
- Branch decision hooks can terminate the entire workflow
- Supports all execution patterns (mixed, non-linear) within branches

**Branch Decision Hooks**:
```typescript
const branches = [
  {
    id: 'conditional-branch',
    branchDecisionHook: async ({ branchResult, sharedBuffer }) => {
      if (branchResult.failedRequests > 0) {
        return { 
          action: PHASE_DECISION_ACTIONS.TERMINATE, 
          metadata: { reason: 'Critical branch failed' }
        };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    },
    phases: [...]
  }
];
```

## Advanced Capabilities

### Config Cascading

Configuration inheritance across workflow → branch → phase → request levels:

```typescript
await stableWorkflow(phases, {
  // Workflow-level config (lowest priority)
  commonAttempts: 3,
  commonWait: 1000,
  commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
  commonCache: { enabled: true, ttl: 60000 },
  commonRequestData: { 
    hostname: 'api.example.com',
    headers: { 'X-API-Version': 'v2' }
  },
  
  branches: [{
    id: 'my-branch',
    commonConfig: {
      // Branch-level config (overrides workflow)
      commonAttempts: 5,
      commonWait: 500
    },
    phases: [{
      id: 'my-phase',
      commonConfig: {
        // Phase-level config (overrides branch and workflow)
        commonAttempts: 1,
        commonCache: { enabled: false }
      },
      requests: [{
        id: 'my-request',
        requestOptions: {
          // Request-level config (highest priority)
          reqData: { path: '/critical' },
          attempts: 10,
          wait: 100,
          cache: { enabled: true, ttl: 300000 }
        }
      }]
    }]
  }]
});
```

**Priority**: Request > Phase > Branch > Workflow

### Request Grouping

Define reusable configurations for groups of related requests:

```typescript
const requests = [
  {
    id: 'critical-1',
    groupId: 'critical',
    requestOptions: { reqData: { path: '/critical/1' }, resReq: true }
  },
  {
    id: 'critical-2',
    groupId: 'critical',
    requestOptions: { reqData: { path: '/critical/2' }, resReq: true }
  },
  {
    id: 'optional-1',
    groupId: 'optional',
    requestOptions: { reqData: { path: '/optional/1' }, resReq: false }
  }
];

await stableApiGateway(requests, {
  commonRequestData: { hostname: 'api.example.com' },
  commonAttempts: 1,                            // Default: 1 attempt
  
  requestGroups: [
    {
      groupId: 'critical',
      commonAttempts: 5,                        // Critical requests: 5 attempts
      commonWait: 2000,
      commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
      commonFinalErrorAnalyzer: async () => false  // Never suppress errors
    },
    {
      groupId: 'optional',
      commonAttempts: 2,                        // Optional requests: 2 attempts
      commonWait: 500,
      commonFinalErrorAnalyzer: async () => true   // Suppress errors (return false)
    }
  ]
});
```

**Use Cases**:
- Different retry strategies for critical vs. optional requests
- Separate error handling for different request types
- Grouped logging and monitoring

### Shared Buffer and Pre-Execution Hooks

Share state across phases/branches and dynamically transform requests:

**Shared Buffer**:
```typescript
const sharedBuffer = { 
  authToken: null,
  userId: null,
  metrics: []
};

const phases = [
  {
    id: 'auth',
    requests: [{
      id: 'login',
      requestOptions: {
        reqData: { path: '/login', method: REQUEST_METHODS.POST },
        resReq: true,
        preExecution: {
          preExecutionHook: ({ commonBuffer }) => {
            // Write to buffer after response
            return {};
          },
          preExecutionHookParams: {},
          applyPreExecutionConfigOverride: false,
          continueOnPreExecutionHookFailure: false
        }
      }
    }]
  },
  {
    id: 'fetch-data',
    requests: [{
      id: 'profile',
      requestOptions: {
        reqData: { path: '/profile' },
        resReq: true,
        preExecution: {
          preExecutionHook: ({ commonBuffer }) => {
            // Use token from buffer
            return {
              reqData: {
                headers: {
                  'Authorization': `Bearer ${commonBuffer.authToken}`
                }
              }
            };
          },
          applyPreExecutionConfigOverride: true  // Apply returned config
        }
      }
    }]
  }
];

await stableWorkflow(phases, {
  sharedBuffer,
  commonRequestData: { hostname: 'api.example.com' }
});

console.log(sharedBuffer);                      // Updated with data from workflow
```

**Pre-Execution Hook Use Cases**:
- Dynamic header injection (auth tokens, correlation IDs)
- Request payload transformation based on previous responses
- Conditional request configuration (skip, modify, enhance)
- Cross-phase state management

**Hook Failure Handling**:
```typescript
{
  preExecution: {
    preExecutionHook: async ({ commonBuffer, inputParams }) => {
      // May throw error
      const token = await fetchTokenFromExternalSource();
      return { reqData: { headers: { 'Authorization': token } } };
    },
    continueOnPreExecutionHookFailure: true     // Continue even if hook fails
  }
}
```

**Pre-Phase Execution Hooks**:

Modify phase configuration before execution:

```typescript
const phases = [
  {
    id: 'data-phase',
    requests: [...],
    prePhaseExecutionHook: async ({ phase, sharedBuffer, params }) => {
      // Dynamically modify phase based on shared state
      if (sharedBuffer.environment === 'production') {
        phase.commonConfig = { commonAttempts: 5, commonWait: 2000 };
      }
      return phase;
    }
  }
];
```

**Pre-Branch Execution Hooks**:

Modify branch configuration before execution:

```typescript
const branches = [
  {
    id: 'api-branch',
    phases: [...],
    preBranchExecutionHook: async ({ branch, sharedBuffer }) => {
      // Add authentication header dynamically
      branch.commonConfig = {
        ...branch.commonConfig,
        commonRequestData: {
          headers: { 'Authorization': `Bearer ${sharedBuffer.token}` }
        }
      };
      return branch;
    }
  }
];
```

### State Persistence and Recovery

Persist workflow state to external storage for recovery, distributed coordination, and long-running workflows.

**How It Works**:
The persistence function operates in two modes:
- **LOAD Mode**: When `buffer` is empty/null, return the stored state
- **STORE Mode**: When `buffer` contains data, save it to your storage

**Redis Persistence with Distributed Locking**:

```typescript
import Redis from 'ioredis';

const redis = new Redis();

const persistToRedis = async ({ executionContext, params, buffer }) => {
  const { workflowId, phaseId } = executionContext;
  const { ttl = 86400, enableLocking = false } = params || {};
  
  const stateKey = `workflow:${workflowId}:${phaseId}`;
  const lockKey = `lock:${stateKey}`;
  const isStoring = buffer && Object.keys(buffer).length > 0;
  
  if (enableLocking) {
    await redis.setex(lockKey, 5, Date.now().toString());
  }
  
  try {
    if (isStoring) {
      // STORE MODE: Save with metadata
      const stateWithMeta = {
        ...buffer,
        _meta: {
          timestamp: new Date().toISOString(),
          version: (buffer._meta?.version || 0) + 1
        }
      };
      await redis.setex(stateKey, ttl, JSON.stringify(stateWithMeta));
      console.log(`💾 State saved (v${stateWithMeta._meta.version})`);
    } else {
      // LOAD MODE: Retrieve state
      const data = await redis.get(stateKey);
      return data ? JSON.parse(data) : {};
    }
  } finally {
    if (enableLocking) {
      await redis.del(lockKey);  // Release lock
    }
  }
  
  return {};
};

// Use with workflow-level persistence (applies to all phases)
await stableWorkflow(phases, {
  workflowId: 'distributed-job-456',
  commonStatePersistence: {
    persistenceFunction: persistToRedis,
    persistenceParams: { 
      ttl: 3600,
      enableLocking: true  // Enable distributed locking
    },
    loadBeforeHooks: true,
    storeAfterHooks: true
  },
  commonRequestData: { hostname: 'api.example.com' }
});
```

**Checkpoint-Based Recovery Pattern**:

```typescript
const createCheckpoint = async ({ executionContext, params, buffer }) => {
  const { workflowId } = executionContext;
  const checkpointKey = `checkpoint:${workflowId}`;
  
  if (buffer && Object.keys(buffer).length > 0) {
    // STORE: Save checkpoint with completed phases
    const existing = JSON.parse(await redis.get(checkpointKey) || '{}');
    const checkpoint = {
      ...existing,
      completedPhases: [...new Set([
        ...(existing.completedPhases || []),
        ...(buffer.completedPhases || [])
      ])],
      progress: buffer.progress || existing.progress || 0,
      lastUpdated: new Date().toISOString()
    };
    await redis.setex(checkpointKey, 7200, JSON.stringify(checkpoint));
  } else {
    // LOAD: Return checkpoint data
    const data = await redis.get(checkpointKey);
    return data ? JSON.parse(data) : { completedPhases: [] };
  }
  return {};
};

const phases = [
  {
    id: 'phase-1',
    requests: [...],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      // Skip if already completed (recovery scenario)
      if (sharedBuffer.completedPhases?.includes('phase-1')) {
        console.log('✅ Phase-1 already completed, skipping...');
        return { 
          action: PHASE_DECISION_ACTIONS.SKIP, 
          skipToPhaseId: 'phase-2' 
        };
      }
      
      if (phaseResult.success) {
        sharedBuffer.completedPhases = [
          ...(sharedBuffer.completedPhases || []), 
          'phase-1'
        ];
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      }
      return { action: PHASE_DECISION_ACTIONS.TERMINATE };
    }
  },
  {
    id: 'phase-2',
    requests: [...],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      if (sharedBuffer.completedPhases?.includes('phase-2')) {
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      }
      if (phaseResult.success) {
        sharedBuffer.completedPhases = [
          ...(sharedBuffer.completedPhases || []),
          'phase-2'
        ];
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  }
];

await stableWorkflow(phases, {
  workflowId: 'resumable-workflow-789',
  enableNonLinearExecution: true,
  sharedBuffer: { completedPhases: [] },
  commonStatePersistence: {
    persistenceFunction: createCheckpoint,
    persistenceParams: { ttl: 7200 },
    loadBeforeHooks: true,
    storeAfterHooks: true
  },
  commonRequestData: { hostname: 'api.example.com' }
});
```

### Comprehensive Observability

Built-in hooks for monitoring, logging, and analysis at every level:

**Request-Level Hooks**:
```typescript
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  attempts: 3,
  
  // Validate response content
  responseAnalyzer: async ({ data, reqData, params }) => {
    console.log('Analyzing response:', data);
    return data.status === 'success';           // false = retry
  },
  
  // Custom error handling
  handleErrors: async ({ errorLog, reqData, commonBuffer }) => {
    console.error('Request failed:', errorLog);
    await sendToMonitoring(errorLog);
  },
  
  // Log successful attempts
  handleSuccessfulAttemptData: async ({ successfulAttemptData, reqData }) => {
    console.log('Request succeeded:', successfulAttemptData);
  },
  
  // Analyze final error after all retries
  finalErrorAnalyzer: async ({ error, reqData }) => {
    console.error('All retries exhausted:', error);
    return error.message.includes('404');       // true = return false instead of throw
  },
  
  // Pass custom parameters to hooks
  hookParams: {
    responseAnalyzerParams: { expectedFormat: 'json' },
    handleErrorsParams: { alertChannel: 'slack' }
  },
  
  logAllErrors: true,
  logAllSuccessfulAttempts: true
});
```

**Workflow-Level Hooks**:
```typescript
await stableWorkflow(phases, {
  workflowId: 'monitored-workflow',
  
  // Called after each phase completes
  handlePhaseCompletion: async ({ workflowId, phaseResult, params }) => {
    console.log(`Phase ${phaseResult.phaseId} completed`);
    console.log(`Requests: ${phaseResult.totalRequests}`);
    console.log(`Success: ${phaseResult.successfulRequests}`);
    console.log(`Failed: ${phaseResult.failedRequests}`);
    await sendMetrics(phaseResult);
  },
  
  // Called when a phase fails
  handlePhaseError: async ({ workflowId, error, phaseResult }) => {
    console.error(`Phase ${phaseResult.phaseId} failed:`, error);
    await alertOnCall(error);
  },
  
  // Monitor non-linear execution decisions
  handlePhaseDecision: async ({ decision, phaseResult }) => {
    console.log(`Phase decision: ${decision.action}`);
    if (decision.targetPhaseId) {
      console.log(`Target: ${decision.targetPhaseId}`);
    }
  },
  
  // Monitor branch completion
  handleBranchCompletion: async ({ workflowId, branchResult }) => {
    console.log(`Branch ${branchResult.branchId} completed`);
  },
  
  // Monitor branch decisions
  handleBranchDecision: async ({ workflowId, branchId, branchResults, success }) => {
    console.log(`Branch ID: ${branchId}`);
  },
  
  // Pass parameters to workflow hooks
  workflowHookParams: {
    handlePhaseCompletionParams: { environment: 'production' },
    handlePhaseErrorParams: { severity: 'high' }
  },
  
  logPhaseResults: true,
  commonRequestData: { hostname: 'api.example.com' }
});
```

**Execution History**:
```typescript
const result = await stableWorkflow(phases, {
  enableNonLinearExecution: true,
  workflowId: 'tracked-workflow',
  commonRequestData: { hostname: 'api.example.com' }
});

// Detailed execution history
result.executionHistory.forEach(record => {
  console.log({
    phaseId: record.phaseId,
    executionNumber: record.executionNumber,
    decision: record.decision,
    timestamp: record.timestamp,
    metadata: record.metadata
  });
});

// Branch execution history
result.branchExecutionHistory?.forEach(record => {
  console.log({
    branchId: record.branchId,
    action: record.action,
    timestamp: record.timestamp
  });
});
```

### Trial Mode

Test and debug workflows without making real API calls:

```typescript
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  attempts: 3,
  trialMode: {
    enabled: true,
    successProbability: 0.5,                    // 50% chance of success
    retryableProbability: 0.8,                  // 80% of failures are retryable
    latencyRange: { min: 100, max: 500 }        // Simulated latency: 100-500ms
  }
});
```

**Use Cases**:
- Test retry logic without hitting APIs
- Simulate failure scenarios
- Load testing with controlled failure rates
- Development without backend dependencies

## Common Use Cases

### Multi-Step Data Synchronization

```typescript
const syncPhases = [
  {
    id: 'fetch-source-data',
    concurrentExecution: true,
    requests: [
      { id: 'users', requestOptions: { reqData: { path: '/source/users' }, resReq: true } },
      { id: 'orders', requestOptions: { reqData: { path: '/source/orders' }, resReq: true } }
    ]
  },
  {
    id: 'transform-data',
    requests: [
      { 
        id: 'transform', 
        requestOptions: { 
          reqData: { path: '/transform', method: REQUEST_METHODS.POST }, 
          resReq: true 
        } 
      }
    ]
  },
  {
    id: 'upload-to-destination',
    concurrentExecution: true,
    requests: [
      { id: 'upload-users', requestOptions: { reqData: { path: '/dest/users', method: REQUEST_METHODS.POST }, resReq: false } },
      { id: 'upload-orders', requestOptions: { reqData: { path: '/dest/orders', method: REQUEST_METHODS.POST }, resReq: false } }
    ]
  }
];

await stableWorkflow(syncPhases, {
  workflowId: 'data-sync',
  commonRequestData: { hostname: 'api.example.com' },
  commonAttempts: 3,
  stopOnFirstPhaseError: true,
  logPhaseResults: true
});
```

### API Gateway with Fallbacks

```typescript
const requests = [
  {
    id: 'primary-service',
    groupId: 'critical',
    requestOptions: {
      reqData: { hostname: 'primary.api.com', path: '/data' },
      resReq: true,
      finalErrorAnalyzer: async ({ error }) => {
        // If primary fails, mark as handled (don't throw)
        return true;
      }
    }
  },
  {
    id: 'fallback-service',
    groupId: 'fallback',
    requestOptions: {
      reqData: { hostname: 'backup.api.com', path: '/data' },
      resReq: true
    }
  }
];

const results = await stableApiGateway(requests, {
  concurrentExecution: false,                   // Sequential: try fallback only if primary fails
  requestGroups: [
    { groupId: 'critical', commonAttempts: 3 },
    { groupId: 'fallback', commonAttempts: 1 }
  ]
});
```

### Polling with Conditional Termination

```typescript
const pollingPhases = [
  {
    id: 'poll-job-status',
    allowReplay: true,
    maxReplayCount: 20,
    requests: [
      { 
        id: 'status-check', 
        requestOptions: { 
          reqData: { path: '/job/status' }, 
          resReq: true 
        } 
      }
    ],
    phaseDecisionHook: async ({ phaseResult, executionHistory }) => {
      const status = phaseResult.responses[0]?.data?.status;
      const attempts = executionHistory.filter(h => h.phaseId === 'poll-job-status').length;
      
      if (status === 'completed') {
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      } else if (status === 'failed') {
        return { action: PHASE_DECISION_ACTIONS.TERMINATE, metadata: { reason: 'Job failed' } };
      } else if (attempts < 20) {
        return { action: PHASE_DECISION_ACTIONS.REPLAY };
      } else {
        return { action: PHASE_DECISION_ACTIONS.TERMINATE, metadata: { reason: 'Timeout' } };
      }
    }
  },
  {
    id: 'process-results',
    requests: [
      { id: 'fetch-results', requestOptions: { reqData: { path: '/job/results' }, resReq: true } }
    ]
  }
];

await stableWorkflow(pollingPhases, {
  enableNonLinearExecution: true,
  commonRequestData: { hostname: 'api.example.com' },
  commonWait: 5000                              // 5 second wait between polls
});
```

### Webhook Retry with Circuit Breaker

```typescript
import { CircuitBreaker, REQUEST_METHODS, RETRY_STRATEGIES } from '@emmvish/stable-request';

const webhookBreaker = new CircuitBreaker({
  failureThresholdPercentage: 60,               // 60% failure rate triggers open
  minimumRequests: 5,                           // Minimum 5 requests before evaluation
  recoveryTimeoutMs: 30000,                     // 30s timeout in open state
  successThresholdPercentage: 40                // 40% success rate closes circuit
});

async function sendWebhook(eventData: any) {
  try {
    await stableRequest({
      reqData: {
        hostname: 'webhook.example.com',
        path: '/events',
        method: REQUEST_METHODS.POST,
        body: eventData
      },
      attempts: 5,
      wait: 1000,
      retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
      circuitBreaker: webhookBreaker,
      handleErrors: async ({ errorLog }) => {
        console.error('Webhook delivery failed:', errorLog);
        await queueForRetry(eventData);
      }
    });
  } catch (error) {
    console.error('Webhook permanently failed:', error);
  }
}
```

### Distributed Data Migration with State Persistence

```typescript
import Redis from 'ioredis';
import { 
  stableWorkflow, 
  PHASE_DECISION_ACTIONS, 
  REQUEST_METHODS,
  VALID_REQUEST_PROTOCOLS 
} from '@emmvish/stable-request';

const redis = new Redis();

// Checkpoint persistence for recovery
const createCheckpoint = async ({ executionContext, buffer }) => {
  const { workflowId, phaseId } = executionContext;
  const key = `checkpoint:${workflowId}`;
  
  if (buffer && Object.keys(buffer).length > 0) {
    // Save checkpoint with progress
    const existing = JSON.parse(await redis.get(key) || '{}');
    const checkpoint = {
      ...existing,
      ...buffer,
      completedPhases: [...new Set([
        ...(existing.completedPhases || []),
        ...(buffer.completedPhases || [])
      ])],
      lastPhase: phaseId,
      updatedAt: new Date().toISOString()
    };
    await redis.setex(key, 86400, JSON.stringify(checkpoint));
    console.log(`💾 Checkpoint: ${checkpoint.recordsProcessed}/${checkpoint.totalRecords} records`);
  } else {
    // Load checkpoint
    const data = await redis.get(key);
    return data ? JSON.parse(data) : { 
      completedPhases: [], 
      recordsProcessed: 0,
      totalRecords: 0
    };
  }
  return {};
};

const migrationPhases = [
  {
    id: 'extract',
    requests: [{
      id: 'fetch-data',
      requestOptions: {
        reqData: { 
          protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
          hostname: 'source-api.example.com',
          path: '/data',
          method: REQUEST_METHODS.GET
        },
        resReq: true
      }
    }],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      if (sharedBuffer.completedPhases?.includes('extract')) {
        console.log('✅ Extract already completed, skipping...');
        return { 
          action: PHASE_DECISION_ACTIONS.SKIP, 
          skipToPhaseId: 'transform' 
        };
      }
      
      if (phaseResult.success) {
        const records = phaseResult.responses[0]?.data?.records || [];
        sharedBuffer.extractedData = records;
        sharedBuffer.totalRecords = records.length;
        sharedBuffer.completedPhases = ['extract'];
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      }
      return { action: PHASE_DECISION_ACTIONS.TERMINATE };
    }
  },
  {
    id: 'transform',
    allowReplay: true,
    maxReplayCount: 3,
    requests: [{
      id: 'transform-batch',
      requestOptions: {
        reqData: {
          protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
          hostname: 'transform-api.example.com',
          path: '/transform',
          method: REQUEST_METHODS.POST
        },
        resReq: true,
        preExecution: {
          preExecutionHook: ({ commonBuffer }) => {
            // Process in batches
            const batchSize = 100;
            const processed = commonBuffer.recordsProcessed || 0;
            const batch = commonBuffer.extractedData.slice(
              processed,
              processed + batchSize
            );
            return {
              reqData: { body: { records: batch } }
            };
          },
          applyPreExecutionConfigOverride: true
        }
      }
    }],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      if (sharedBuffer.completedPhases?.includes('transform')) {
        return { 
          action: PHASE_DECISION_ACTIONS.SKIP, 
          skipToPhaseId: 'load' 
        };
      }
      
      if (phaseResult.success) {
        const transformed = phaseResult.responses[0]?.data?.transformed || [];
        sharedBuffer.recordsProcessed = 
          (sharedBuffer.recordsProcessed || 0) + transformed.length;
        
        // Continue transforming if more records remain
        if (sharedBuffer.recordsProcessed < sharedBuffer.totalRecords) {
          console.log(
            `🔄 Progress: ${sharedBuffer.recordsProcessed}/${sharedBuffer.totalRecords}`
          );
          return { action: PHASE_DECISION_ACTIONS.REPLAY };
        }
        
        // All records transformed
        sharedBuffer.completedPhases = [
          ...(sharedBuffer.completedPhases || []),
          'transform'
        ];
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      }
      
      return { action: PHASE_DECISION_ACTIONS.TERMINATE };
    }
  },
  {
    id: 'load',
    requests: [{
      id: 'upload-data',
      requestOptions: {
        reqData: {
          protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
          hostname: 'dest-api.example.com',
          path: '/import',
          method: REQUEST_METHODS.POST
        },
        resReq: false
      }
    }],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      if (phaseResult.success) {
        sharedBuffer.completedPhases = [
          ...(sharedBuffer.completedPhases || []),
          'load'
        ];
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  }
];

// Execute with state persistence for recovery
const result = await stableWorkflow(migrationPhases, {
  workflowId: 'data-migration-2024-01-08',
  enableNonLinearExecution: true,
  sharedBuffer: { 
    completedPhases: [],
    recordsProcessed: 0,
    totalRecords: 0
  },
  commonStatePersistence: {
    persistenceFunction: createCheckpoint,
    loadBeforeHooks: true,
    storeAfterHooks: true
  },
  commonAttempts: 3,
  commonWait: 2000,
  stopOnFirstPhaseError: true,
  logPhaseResults: true
});

console.log(`✅ Migration completed: ${result.successfulRequests}/${result.totalRequests}`);
console.log(`⏱️  Duration: ${result.executionTime}ms`);

// To resume a failed workflow, just re-run with the same workflowId
// It will load the checkpoint and skip completed phases
```

---

## License

MIT © Manish Varma