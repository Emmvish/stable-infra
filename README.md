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
- [Workflow Execution Patterns](#workflow-execution-patterns)
  - [Sequential and Concurrent Phases](#sequential-and-concurrent-phases)
  - [Mixed Execution Mode](#mixed-execution-mode)
  - [Non-Linear Workflows](#non-linear-workflows)
  - [Branched Workflows](#branched-workflows)
- [Advanced Capabilities](#advanced-capabilities)
  - [Config Cascading](#config-cascading)
  - [Request Grouping](#request-grouping)
  - [Shared Buffer and Pre-Execution Hooks](#shared-buffer-and-pre-execution-hooks)
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
    failureThreshold: 5,                        // Open after 5 failures
    successThreshold: 2,                        // Close after 2 successes in half-open
    timeout: 60000,                             // Wait 60s before trying again (half-open)
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
  failureThreshold: 10,
  successThreshold: 3,
  timeout: 120000
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
    timeWindow: 60000                           // per 60 seconds
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
      timeWindow: 10000
    },
    requests: [...]
  }
];
```

**Standalone Rate Limiter**:
```typescript
import { RateLimiter } from '@emmvish/stable-request';

const limiter = new RateLimiter({
  maxRequests: 1000,
  timeWindow: 3600000                           // 1000 requests per hour
});

await limiter.acquire();                        // Waits if limit exceeded
// Make request
```

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
          terminateWorkflow: true,              // Terminate entire workflow
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
  handlePhaseDecision: async ({ workflowId, decision, phaseResult }) => {
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
  handleBranchDecision: async ({ workflowId, decision, branchResult }) => {
    console.log(`Branch decision: ${decision.action}`);
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
import { CircuitBreaker, REQUEST_METHODS } from '@emmvish/stable-request';

const webhookBreaker = new CircuitBreaker({
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000
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

## License

MIT © Manish Varma
