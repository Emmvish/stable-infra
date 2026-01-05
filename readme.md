# @emmvish/stable-request

A powerful HTTP Workflow Execution Engine for Node.js that transforms unreliable API calls into robust, production-ready workflows with advanced retry mechanisms, circuit breakers, and sophisticated execution patterns.

## Navigation

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
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
  - [Shared Buffer and Pre-Execution Hooks](#shared-buffer-and-pre-execution-hooks)
  - [Comprehensive Observability](#comprehensive-observability)
- [API Surface](#api-surface)
- [License](#license)

## Overview

`@emmvish/stable-request` is built for applications that need to orchestrate complex, multi-step API interactions with guarantees around reliability, observability, and fault tolerance. Unlike simple HTTP clients, it provides:

- **Workflow-First Design**: Organize API calls into phases, branches, and decision trees
- **Enterprise Resilience**: Built-in circuit breakers, retry strategies, and failure handling
- **Execution Flexibility**: Sequential, concurrent, mixed, and non-linear execution patterns
- **Production-Ready Observability**: Detailed hooks for monitoring, logging, and error analysis

## Installation

```bash
npm install @emmvish/stable-request
```

## Quick Start

### Single Request with Retry

```typescript
import { stableRequest, RETRY_STRATEGIES } from '@emmvish/stable-request';

const data = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/users',
    method: 'GET'
  },
  resReq: true,
  attempts: 3,
  wait: 1000,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
});
```

### Multi-Phase Workflow

```typescript
import { stableWorkflow } from '@emmvish/stable-request';

const result = await stableWorkflow([
  {
    id: 'auth',
    requests: [
      { id: 'login', requestOptions: { reqData: { path: '/auth/login' }, resReq: true } }
    ]
  },
  {
    id: 'fetch-data',
    concurrentExecution: true,
    requests: [
      { id: 'users', requestOptions: { reqData: { path: '/users' }, resReq: true } },
      { id: 'orders', requestOptions: { reqData: { path: '/orders' }, resReq: true } }
    ]
  }
], {
  workflowId: 'user-data-sync',
  commonRequestData: { hostname: 'api.example.com' },
  stopOnFirstPhaseError: true
});
```

## Core Features

### Intelligent Retry Strategies

Automatically retry failed requests with configurable strategies:

- **Fixed Delay**: Constant wait time between retries
- **Linear Backoff**: Incrementally increasing delays
- **Exponential Backoff**: Exponentially growing delays with optional jitter
- **Fibonacci Backoff**: Delays based on Fibonacci sequence

Each request can have individual retry configurations, or inherit from workflow-level defaults.

### Circuit Breaker Pattern

Prevent cascade failures and system overload with built-in circuit breakers:

- **Automatic State Management**: Transitions between Closed → Open → Half-Open states
- **Configurable Thresholds**: Set failure rates and time windows
- **Request/Attempt Level Tracking**: Monitor at granular or aggregate levels
- **Graceful Degradation**: Fail fast when services are down

### Response Caching

Reduce redundant API calls with intelligent caching:

- **TTL-Based Expiration**: Configure cache lifetime per request
- **Request Fingerprinting**: Automatic deduplication based on request signature
- **Workflow-Wide Sharing**: Cache responses across phases and branches
- **Manual Cache Management**: Programmatic cache inspection and clearing

### Rate Limiting and Concurrency Control

Respect API rate limits and control system load:

- **Token Bucket Rate Limiting**: Smooth out request bursts
- **Concurrency Limiters**: Cap maximum parallel requests
- **Per-Phase Configuration**: Different limits for different workflow stages
- **Automatic Queueing**: Requests wait their turn without failing

## Workflow Execution Patterns

### Sequential and Concurrent Phases

Control execution order at the phase level:

- **Sequential Phases**: Execute phases one after another (default)
- **Concurrent Phases**: Run all phases in parallel
- **Per-Phase Control**: Each phase can define whether its requests run concurrently or sequentially

```typescript
const phases = [
  { id: 'init', requests: [...] },                    // Sequential phase
  { 
    id: 'parallel-fetch', 
    concurrentExecution: true,                        // Concurrent requests within phase
    requests: [...]
  }
];

await stableWorkflow(phases, { 
  concurrentPhaseExecution: true                      // Run phases in parallel
});
```

### Mixed Execution Mode

Combine sequential and concurrent phases in a single workflow:

- Mark specific phases as concurrent while others remain sequential
- Fine-grained control over execution topology
- Useful for scenarios like: "authenticate first, then fetch data in parallel, then process sequentially"

```typescript
const phases = [
  { id: 'auth', requests: [...] },                    // Sequential
  { 
    id: 'fetch', 
    markConcurrentPhase: true,                        // Runs concurrently with next phase
    requests: [...] 
  },
  { 
    id: 'more-fetch', 
    markConcurrentPhase: true,                        // Runs concurrently with previous
    requests: [...] 
  },
  { id: 'process', requests: [...] }                  // Sequential, waits for above
];

await stableWorkflow(phases, { 
  enableMixedExecution: true 
});
```

### Non-Linear Workflows

Build dynamic workflows with conditional branching and looping:

- **JUMP**: Skip to a specific phase based on runtime conditions
- **SKIP**: Skip upcoming phases and jump to a target
- **REPLAY**: Re-execute the current phase (with limits)
- **TERMINATE**: Stop the entire workflow early
- **CONTINUE**: Proceed to the next phase (default)

```typescript
const phases = [
  {
    id: 'validate',
    requests: [...],
    phaseDecisionHook: async ({ phaseResult }) => {
      if (phaseResult.responses[0].data.isValid) {
        return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'success' };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  },
  { id: 'retry-logic', requests: [...] },
  { id: 'success', requests: [...] }
];

await stableWorkflow(phases, { 
  enableNonLinearExecution: true 
});
```

**Decision Hook Context**:
- Access to current phase results
- Execution history (replay count, previous phases)
- Shared buffer for cross-phase state
- Concurrent phase results (in mixed execution)

### Branched Workflows

Execute multiple independent workflow paths in parallel or sequentially:

- **Parallel Branches**: Run branches concurrently (mark with `markConcurrentBranch: true`)
- **Sequential Branches**: Execute branches one after another
- **Branch-Level Decisions**: Control workflow from branch hooks
- **Branch Replay/Termination**: Branches support non-linear execution too

```typescript
const branches = [
  {
    id: 'user-flow',
    markConcurrentBranch: true,                       // Parallel
    phases: [...]
  },
  {
    id: 'analytics-flow',
    markConcurrentBranch: true,                       // Parallel
    phases: [...]
  },
  {
    id: 'cleanup-flow',                               // Sequential (default)
    phases: [...]
  }
];

await stableWorkflow([], {
  enableBranchExecution: true,
  branches
});
```

**Branch Features**:
- Each branch has its own phase execution
- Branches share the workflow's `sharedBuffer`
- Branch decision hooks can terminate the entire workflow
- Supports all execution patterns (mixed, non-linear) within branches

## Advanced Capabilities

### Config Cascading

Configuration inheritance across workflow → branch → phase → request levels:

```typescript
await stableWorkflow(phases, {
  // Workflow-level config (lowest priority)
  commonAttempts: 3,
  commonWait: 1000,
  commonCache: { enabled: true, ttl: 60000 },
  
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
        commonAttempts: 1
      },
      requests: [{
        requestOptions: {
          // Request-level config (highest priority)
          attempts: 10,
          cache: { enabled: false }
        }
      }]
    }]
  }]
});
```

### Shared Buffer and Pre-Execution Hooks

Share state and transform requests dynamically:

**Shared Buffer**: Cross-phase/branch communication
```typescript
const sharedBuffer = { authToken: null };

await stableWorkflow(phases, {
  sharedBuffer,
  // Phases can read/write to sharedBuffer via preExecution hooks
});
```

**Pre-Execution Hooks**: Modify requests before execution
```typescript
{
  requestOptions: {
    preExecution: {
      preExecutionHook: ({ commonBuffer, inputParams }) => {
        // Access buffer, compute values, return config overrides
        return {
          reqData: { 
            headers: { 'Authorization': `Bearer ${commonBuffer.authToken}` }
          }
        };
      },
      applyPreExecutionConfigOverride: true
    }
  }
}
```

### Comprehensive Observability

Built-in hooks for monitoring, logging, and analysis:

**Request-Level Hooks**:
- `responseAnalyzer`: Validate responses, trigger retries based on business logic
- `handleErrors`: Custom error handling and logging
- `handleSuccessfulAttemptData`: Log successful attempts
- `finalErrorAnalyzer`: Analyze final failure after all retries

**Workflow-Level Hooks**:
- `handlePhaseCompletion`: React to phase completion
- `handlePhaseError`: Handle phase-level failures
- `handlePhaseDecision`: Monitor non-linear execution decisions
- `handleBranchCompletion`: Track branch execution
- `handleBranchDecision`: Monitor branch-level decisions

**Execution History**:
Every workflow result includes detailed execution history with timestamps, decisions, and metadata.

## API Surface

### Core Functions

- **`stableRequest`**: Single HTTP request with retry logic
- **`stableApiGateway`**: Execute multiple requests (concurrent or sequential)
- **`stableWorkflow`**: Orchestrate multi-phase workflows with advanced patterns

### Utility Exports

- **Circuit Breaker**: `CircuitBreaker`, `CircuitBreakerOpenError`
- **Rate Limiting**: `RateLimiter`
- **Concurrency**: `ConcurrencyLimiter`
- **Caching**: `CacheManager`, `getGlobalCacheManager`, `resetGlobalCacheManager`
- **Execution Utilities**: `executeNonLinearWorkflow`, `executeBranchWorkflow`, `executePhase`

### Enums

- `RETRY_STRATEGIES`: Fixed, Linear, Exponential, Fibonacci
- `REQUEST_METHODS`: GET, POST, PUT, PATCH, DELETE, etc.
- `PHASE_DECISION_ACTIONS`: CONTINUE, JUMP, SKIP, REPLAY, TERMINATE
- `VALID_REQUEST_PROTOCOLS`: HTTP, HTTPS
- `CircuitBreakerState`: CLOSED, OPEN, HALF_OPEN

### TypeScript Types

Full TypeScript support with 40+ exported types for complete type safety across workflows, requests, configurations, and hooks.

## License

MIT © Manish Varma