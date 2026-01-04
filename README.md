# stable-request

**stable-request** is a TypeScript-first **HTTP workflow execution engine** for real-world distributed systems — where HTTP `200 OK` does **not** guarantee business success, and HTTP failures still deserve **structured, actionable responses**.

It ensures that **every request attempt**, whether it succeeds or fails, can be:

- Sent reliably
- Observed
- Analyzed
- Retried intelligently
- Suppressed when non-critical
- Escalated when business-critical

All without crashing your application or hiding context behind opaque errors.

**stable-request treats failures as data.**

> If you’ve ever logged `error.message` and thought  
> **“This tells me absolutely nothing”** — this library is for you.

In addition, it enables **reliability** **content-aware retries**, **hierarchical configuration**, **batch orchestration**, and **multi-phase workflows** with deep observability — all built on top of standard HTTP calls.

All in all, it provides you with the **entire ecosystem** to build **API-integrations based workflows** with **complete flexibility**.

---

## Choose your entry point

| Need | Use |
|-----|-----|
| Reliable single API call | `stableRequest` |
| Batch or fan-out requests | `stableApiGateway` |
| Multi-step orchestration | `stableWorkflow` |


Start small and scale.

---

## 📚 Table of Contents
<!-- TOC START -->
- [Installation](#installation)
- [Core Features](#core-features)
- [Quick Start](#quick-start)
- [Advanced Features](#advanced-features)
  - [Non-Linear Workflows](#non-linear-workflows)
  - [Branched Workflows](#branched-workflows)
  - [Retry Strategies](#retry-strategies)
  - [Circuit Breaker](#circuit-breaker)
  - [Rate Limiting](#rate-limiting)
  - [Caching](#caching)
  - [Pre-Execution Hooks](#pre-execution-hooks)
  - [Shared Buffer](#shared-buffer)
  - [Request Grouping](#request-grouping)
  - [Concurrency Control](#concurrency-control)
  - [Response Analysis](#response-analysis)
  - [Error Handling](#error-handling)
- [Advanced Use Cases](#advanced-use-cases)
- [License](#license)
<!-- TOC END -->

---

## Installation

```bash
npm install @emmvish/stable-request
```

## Core Features

- ✅ **Configurable Retry Strategies**: Fixed, Linear, and Exponential backoff
- ✅ **Circuit Breaker**: Prevent cascading failures with automatic circuit breaking
- ✅ **Rate Limiting**: Control request throughput across single or multiple requests
- ✅ **Response Caching**: Built-in TTL-based caching with global cache manager
- ✅ **Batch Processing**: Execute multiple requests concurrently or sequentially via API Gateway
- ✅ **Multi-Phase Non-Linear Workflows**: Orchestrate complex request workflows with phase dependencies
- ✅ **Branched Workflows**: Execute parallel or serial branches with conditional routing and decision hooks
- ✅ **Pre-Execution Hooks**: Transform requests before execution with dynamic configuration
- ✅ **Shared Buffer**: Share state across requests in workflows and gateways
- ✅ **Request Grouping**: Apply different configurations to request groups
- ✅ **Observability Hooks**: Track errors, successful attempts, and phase completions
- ✅ **Response Analysis**: Validate responses and trigger retries based on content
- ✅ **Trial Mode**: Test configurations without making real API calls
- ✅ **TypeScript Support**: Full type safety with generics for request/response data

## Quick Start

### Basic Request with Retry

```typescript
import { stableRequest, RETRY_STRATEGIES } from '@emmvish/stable-request';

const data = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/users/123',
    method: 'GET'
  },
  resReq: true,
  attempts: 3,
  wait: 1000,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
});

console.log(data);
```

### Batch Requests via API Gateway

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

const requests = [
  { id: 'user-1', requestOptions: { reqData: { path: '/users/1' }, resReq: true } },
  { id: 'user-2', requestOptions: { reqData: { path: '/users/2' }, resReq: true } },
  { id: 'user-3', requestOptions: { reqData: { path: '/users/3' }, resReq: true } }
];

const results = await stableApiGateway(requests, {
  commonRequestData: { hostname: 'api.example.com' },
  concurrentExecution: true,
  maxConcurrentRequests: 10
});

results.forEach(result => {
  if (result.success) {
    console.log(`Request ${result.requestId}:`, result.data);
  } else {
    console.error(`Request ${result.requestId} failed:`, result.error);
  }
});
```

### Multi-Phase Workflow

```typescript
import { stableWorkflow, STABLE_WORKFLOW_PHASE } from '@emmvish/stable-request';

const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'authentication',
    requests: [
      { id: 'login', requestOptions: { reqData: { path: '/auth/login' }, resReq: true } }
    ]
  },
  {
    id: 'data-fetching',
    concurrentExecution: true,
    requests: [
      { id: 'users', requestOptions: { reqData: { path: '/users' }, resReq: true } },
      { id: 'posts', requestOptions: { reqData: { path: '/posts' }, resReq: true } }
    ]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'data-pipeline',
  commonRequestData: { hostname: 'api.example.com' },
  stopOnFirstPhaseError: true,
  logPhaseResults: true
});

console.log(`Workflow completed: ${result.successfulRequests}/${result.totalRequests} successful`);
```

### Non-Linear Workflow with Dynamic Routing

```typescript
import { stableWorkflow, STABLE_WORKFLOW_PHASE, PHASE_DECISION_ACTIONS } from '@emmvish/stable-request';

const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'check-status',
    requests: [
      { id: 'status', requestOptions: { reqData: { path: '/status' }, resReq: true } }
    ],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      const status = phaseResult.responses[0]?.data?.status;
      
      if (status === 'completed') {
        return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'finalize' };
      } else if (status === 'processing') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { action: PHASE_DECISION_ACTIONS.REPLAY };  // Replay this phase
      } else {
        return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'error-handler' };
      }
    },
    allowReplay: true,
    maxReplayCount: 10
  },
  {
    id: 'process',
    requests: [
      { id: 'process', requestOptions: { reqData: { path: '/process' }, resReq: true } }
    ]
  },
  {
    id: 'error-handler',
    requests: [
      { id: 'error', requestOptions: { reqData: { path: '/error' }, resReq: true } }
    ]
  },
  {
    id: 'finalize',
    requests: [
      { id: 'final', requestOptions: { reqData: { path: '/finalize' }, resReq: true } }
    ]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'dynamic-workflow',
  commonRequestData: { hostname: 'api.example.com' },
  enableNonLinearExecution: true,
  maxWorkflowIterations: 50,
  sharedBuffer: {}
});

console.log('Execution history:', result.executionHistory);
console.log('Terminated early:', result.terminatedEarly);
```

## Advanced Features

### Non-Linear Workflows

Non-linear workflows enable dynamic phase execution based on runtime decisions, allowing you to build complex orchestrations with conditional branching, polling loops, error recovery, and adaptive routing.

#### Phase Decision Actions

Each phase can make decisions about workflow execution:

- **`continue`**: Proceed to the next sequential phase
- **`jump`**: Jump to a specific phase by ID
- **`replay`**: Re-execute the current phase
- **`skip`**: Skip to a target phase or skip the next phase
- **`terminate`**: Stop the workflow immediately

#### Basic Non-Linear Workflow

```typescript
import { stableWorkflow, STABLE_WORKFLOW_PHASE, PhaseExecutionDecision, PHASE_DECISION_ACTIONS } from '@emmvish/stable-request';

const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'validate-input',
    requests: [
      { id: 'validate', requestOptions: { reqData: { path: '/validate' }, resReq: true } }
    ],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      const isValid = phaseResult.responses[0]?.data?.valid;
      
      if (isValid) {
        sharedBuffer.validationPassed = true;
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };  // Go to next phase
      } else {
        return { 
          action: PHASE_DECISION_ACTIONS.TERMINATE,
          metadata: { reason: 'Validation failed' }
        };
      }
    }
  },
  {
    id: 'process-data',
    requests: [
      { id: 'process', requestOptions: { reqData: { path: '/process' }, resReq: true } }
    ]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'validation-workflow',
  commonRequestData: { hostname: 'api.example.com' },
  enableNonLinearExecution: true,
  sharedBuffer: {}
});

if (result.terminatedEarly) {
  console.log('Workflow terminated:', result.terminationReason);
}
```

#### Conditional Branching

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'check-user-type',
    requests: [
      { id: 'user', requestOptions: { reqData: { path: '/user/info' }, resReq: true } }
    ],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      const userType = phaseResult.responses[0]?.data?.type;
      sharedBuffer.userType = userType;
      
      if (userType === 'premium') {
        return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'premium-flow' };
      } else if (userType === 'trial') {
        return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'trial-flow' };
      } else {
        return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'free-flow' };
      }
    }
  },
  {
    id: 'premium-flow',
    requests: [
      { id: 'premium', requestOptions: { reqData: { path: '/premium/data' }, resReq: true } }
    ],
    phaseDecisionHook: async () => ({ action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'finalize' })
  },
  {
    id: 'trial-flow',
    requests: [
      { id: 'trial', requestOptions: { reqData: { path: '/trial/data' }, resReq: true } }
    ],
    phaseDecisionHook: async () => ({ action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'finalize' })
  },
  {
    id: 'free-flow',
    requests: [
      { id: 'free', requestOptions: { reqData: { path: '/free/data' }, resReq: true } }
    ]
  },
  {
    id: 'finalize',
    requests: [
      { id: 'final', requestOptions: { reqData: { path: '/finalize' }, resReq: true } }
    ]
  }
];

const result = await stableWorkflow(phases, {
  enableNonLinearExecution: true,
  sharedBuffer: {},
  handlePhaseDecision: (decision, phaseResult) => {
    console.log(`Phase ${phaseResult.phaseId} decided: ${decision.action}`);
  }
});
```

#### Polling with Replay

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'poll-job-status',
    allowReplay: true,
    maxReplayCount: 20,
    requests: [
      { id: 'check', requestOptions: { reqData: { path: '/job/status' }, resReq: true } }
    ],
    phaseDecisionHook: async ({ phaseResult, executionHistory }) => {
      const status = phaseResult.responses[0]?.data?.status;
      const attempts = executionHistory.filter(h => h.phaseId === 'poll-job-status').length;
      
      if (status === 'completed') {
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      } else if (status === 'failed') {
        return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'error-recovery' };
      } else if (attempts < 20) {
        // Still processing, wait and replay
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { action: PHASE_DECISION_ACTIONS.REPLAY };
      } else {
        return { 
          action: PHASE_DECISION_ACTIONS.TERMINATE,
          metadata: { reason: 'Job timeout after 20 attempts' }
        };
      }
    }
  },
  {
    id: 'process-results',
    requests: [
      { id: 'process', requestOptions: { reqData: { path: '/job/results' }, resReq: true } }
    ]
  },
  {
    id: 'error-recovery',
    requests: [
      { id: 'recover', requestOptions: { reqData: { path: '/job/retry' }, resReq: true } }
    ]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'polling-workflow',
  commonRequestData: { hostname: 'api.example.com' },
  enableNonLinearExecution: true,
  maxWorkflowIterations: 100
});

console.log('Total iterations:', result.executionHistory.length);
console.log('Phases executed:', result.completedPhases);
```

#### Retry Logic with Replay

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'attempt-operation',
    allowReplay: true,
    maxReplayCount: 3,
    requests: [
      { 
        id: 'operation',
        requestOptions: { 
          reqData: { path: '/risky-operation', method: 'POST' },
          resReq: true,
          attempts: 1  // No retries at request level
        }
      }
    ],
    phaseDecisionHook: async ({ phaseResult, executionHistory, sharedBuffer }) => {
      const success = phaseResult.responses[0]?.success;
      const attemptCount = executionHistory.filter(h => h.phaseId === 'attempt-operation').length;
      
      if (success) {
        sharedBuffer.operationResult = phaseResult.responses[0]?.data;
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      } else if (attemptCount < 3) {
        // Exponential backoff
        const delay = 1000 * Math.pow(2, attemptCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        sharedBuffer.retryAttempts = attemptCount;
        return { action: PHASE_DECISION_ACTIONS.REPLAY };
      } else {
        return {
          action: PHASE_DECISION_ACTIONS.JUMP,
          targetPhaseId: 'fallback-operation',
          metadata: { reason: 'Max retries exceeded' }
        };
      }
    }
  },
  {
    id: 'primary-flow',
    requests: [
      { id: 'primary', requestOptions: { reqData: { path: '/primary' }, resReq: true } }
    ]
  },
  {
    id: 'fallback-operation',
    requests: [
      { id: 'fallback', requestOptions: { reqData: { path: '/fallback' }, resReq: true } }
    ]
  }
];

const result = await stableWorkflow(phases, {
  enableNonLinearExecution: true,
  sharedBuffer: { retryAttempts: 0 },
  logPhaseResults: true
});
```

#### Skip Phases

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'check-cache',
    allowSkip: true,
    requests: [
      { id: 'cache', requestOptions: { reqData: { path: '/cache/check' }, resReq: true } }
    ],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      const cached = phaseResult.responses[0]?.data?.cached;
      
      if (cached) {
        sharedBuffer.cachedData = phaseResult.responses[0]?.data;
        // Skip expensive-computation and go directly to finalize
        return { action: PHASE_DECISION_ACTIONS.SKIP, targetPhaseId: 'finalize' };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  },
  {
    id: 'expensive-computation',
    requests: [
      { id: 'compute', requestOptions: { reqData: { path: '/compute' }, resReq: true } }
    ]
  },
  {
    id: 'save-to-cache',
    requests: [
      { id: 'save', requestOptions: { reqData: { path: '/cache/save' }, resReq: true } }
    ]
  },
  {
    id: 'finalize',
    requests: [
      { id: 'final', requestOptions: { reqData: { path: '/finalize' }, resReq: true } }
    ]
  }
];

const result = await stableWorkflow(phases, {
  enableNonLinearExecution: true,
  sharedBuffer: {}
});
```

#### Execution History and Tracking

```typescript
const result = await stableWorkflow(phases, {
  workflowId: 'tracked-workflow',
  enableNonLinearExecution: true,
  handlePhaseCompletion: ({ phaseResult, workflowId }) => {
    console.log(`[${workflowId}] Phase ${phaseResult.phaseId} completed:`, {
      executionNumber: phaseResult.executionNumber,
      success: phaseResult.success,
      decision: phaseResult.decision
    });
  },
  handlePhaseDecision: (decision, phaseResult) => {
    console.log(`Decision made:`, {
      phase: phaseResult.phaseId,
      action: decision.action,
      target: decision.targetPhaseId,
      metadata: decision.metadata
    });
  }
});

// Analyze execution history
console.log('Total phase executions:', result.executionHistory.length);
console.log('Unique phases executed:', new Set(result.executionHistory.map(h => h.phaseId)).size);
console.log('Replay count:', result.executionHistory.filter(h => h.decision?.action === 'replay').length);

result.executionHistory.forEach(record => {
  console.log(`- ${record.phaseId} (attempt ${record.executionNumber}): ${record.success ? '✓' : '✗'}`);
});
```

#### Loop Protection

```typescript
const result = await stableWorkflow(phases, {
  enableNonLinearExecution: true,
  maxWorkflowIterations: 50,  // Prevent infinite loops
  handlePhaseCompletion: ({ phaseResult }) => {
    if (phaseResult.executionNumber && phaseResult.executionNumber > 10) {
      console.warn(`Phase ${phaseResult.phaseId} executed ${phaseResult.executionNumber} times`);
    }
  }
});

if (result.terminatedEarly && result.terminationReason?.includes('iterations')) {
  console.error('Workflow hit iteration limit - possible infinite loop');
}
```

### Branched Workflows

Branched workflows enable orchestration of complex business logic by organizing phases into branches that can execute in parallel or serial order. Each branch is a self-contained workflow with its own phases, and branches can make decisions to control execution flow using JUMP, TERMINATE, or CONTINUE actions.

#### Why Branched Workflows?

- **Organize complex logic**: Group related phases into logical branches
- **Parallel processing**: Execute independent branches concurrently for better performance
- **Conditional routing**: Branches can decide whether to continue, jump to other branches, or terminate
- **Clean architecture**: Separate concerns into distinct branches (validation, processing, error handling)
- **Shared state**: Branches share a common buffer for state management

#### Basic Branched Workflow

```typescript
import { stableWorkflow, STABLE_WORKFLOW_BRANCH } from '@emmvish/stable-request';

const branches: STABLE_WORKFLOW_BRANCH[] = [
  {
    id: 'validation',
    phases: [
      {
        id: 'validate-input',
        requests: [
          { id: 'validate', requestOptions: { reqData: { path: '/validate' }, resReq: true } }
        ]
      }
    ]
  },
  {
    id: 'processing',
    phases: [
      {
        id: 'process-data',
        requests: [
          { id: 'process', requestOptions: { reqData: { path: '/process' }, resReq: true } }
        ]
      }
    ]
  },
  {
    id: 'finalization',
    phases: [
      {
        id: 'finalize',
        requests: [
          { id: 'final', requestOptions: { reqData: { path: '/finalize' }, resReq: true } }
        ]
      }
    ]
  }
];

const result = await stableWorkflow([], {
  workflowId: 'branched-workflow',
  commonRequestData: { hostname: 'api.example.com' },
  branches,
  executeBranchesConcurrently: false,  // Execute branches serially
  sharedBuffer: {}
});

console.log('Branches executed:', result.branches?.length);
```

#### Parallel vs Serial Branch Execution

```typescript
// Parallel execution - all branches run concurrently
const result = await stableWorkflow([], {
  workflowId: 'parallel-branches',
  commonRequestData: { hostname: 'api.example.com' },
  branches: [
    { id: 'fetch-users', phases: [/* ... */] },
    { id: 'fetch-products', phases: [/* ... */] },
    { id: 'fetch-orders', phases: [/* ... */] }
  ],
  executeBranchesConcurrently: true,  // Parallel execution
  sharedBuffer: {}
});

// Serial execution - branches run one after another
const result = await stableWorkflow([], {
  workflowId: 'serial-branches',
  commonRequestData: { hostname: 'api.example.com' },
  branches: [
    { id: 'authenticate', phases: [/* ... */] },
    { id: 'fetch-data', phases: [/* ... */] },
    { id: 'process', phases: [/* ... */] }
  ],
  executeBranchesConcurrently: false,  // Serial execution
  sharedBuffer: {}
});
```

#### Branch Decision Hooks

Each branch can have a decision hook to control workflow execution:

```typescript
import { BRANCH_DECISION_ACTIONS } from '@emmvish/stable-request';

const branches: STABLE_WORKFLOW_BRANCH[] = [
  {
    id: 'validation',
    phases: [
      {
        id: 'validate',
        requests: [
          { id: 'val', requestOptions: { reqData: { path: '/validate' }, resReq: true } }
        ]
      }
    ],
    branchDecisionHook: async ({ branchResult, sharedBuffer }) => {
      const isValid = branchResult.phases[0]?.responses[0]?.data?.valid;
      
      if (!isValid) {
        return {
          action: BRANCH_DECISION_ACTIONS.TERMINATE,
          metadata: { reason: 'Validation failed' }
        };
      }
      
      sharedBuffer!.validated = true;
      return { action: BRANCH_DECISION_ACTIONS.CONTINUE };
    }
  },
  {
    id: 'processing',
    phases: [/* ... */]
  }
];

const result = await stableWorkflow([], {
  workflowId: 'validation-workflow',
  commonRequestData: { hostname: 'api.example.com' },
  branches,
  executeBranchesConcurrently: false,
  sharedBuffer: {}
});

if (result.terminatedEarly) {
  console.log('Workflow terminated:', result.terminationReason);
}
```

#### JUMP Action - Skip Branches

```typescript
const branches: STABLE_WORKFLOW_BRANCH[] = [
  {
    id: 'check-cache',
    phases: [
      {
        id: 'cache-check',
        requests: [
          { id: 'check', requestOptions: { reqData: { path: '/cache/check' }, resReq: true } }
        ]
      }
    ],
    branchDecisionHook: async ({ branchResult, sharedBuffer }) => {
      const cached = branchResult.phases[0]?.responses[0]?.data?.cached;
      
      if (cached) {
        sharedBuffer!.cachedData = branchResult.phases[0]?.responses[0]?.data;
        // Skip expensive computation, jump directly to finalize
        return {
          action: BRANCH_DECISION_ACTIONS.JUMP,
          targetBranchId: 'finalize'
        };
      }
      
      return { action: BRANCH_DECISION_ACTIONS.CONTINUE };
    }
  },
  {
    id: 'expensive-computation',
    phases: [
      {
        id: 'compute',
        requests: [
          { id: 'compute', requestOptions: { reqData: { path: '/compute' }, resReq: true } }
        ]
      }
    ]
  },
  {
    id: 'save-cache',
    phases: [
      {
        id: 'save',
        requests: [
          { id: 'save', requestOptions: { reqData: { path: '/cache/save' }, resReq: true } }
        ]
      }
    ]
  },
  {
    id: 'finalize',
    phases: [
      {
        id: 'final',
        requests: [
          { id: 'final', requestOptions: { reqData: { path: '/finalize' }, resReq: true } }
        ]
      }
    ]
  }
];

const result = await stableWorkflow([], {
  workflowId: 'cache-optimization',
  commonRequestData: { hostname: 'api.example.com' },
  branches,
  executeBranchesConcurrently: false,
  sharedBuffer: {}
});

// If cache hit: check-cache → finalize (skips expensive-computation and save-cache)
// If cache miss: check-cache → expensive-computation → save-cache → finalize
```

#### Conditional Branching

```typescript
const branches: STABLE_WORKFLOW_BRANCH[] = [
  {
    id: 'check-user-type',
    phases: [
      {
        id: 'user-info',
        requests: [
          { id: 'user', requestOptions: { reqData: { path: '/user/info' }, resReq: true } }
        ]
      }
    ],
    branchDecisionHook: async ({ branchResult, sharedBuffer }) => {
      const userType = branchResult.phases[0]?.responses[0]?.data?.type;
      sharedBuffer!.userType = userType;
      
      if (userType === 'premium') {
        return { action: BRANCH_DECISION_ACTIONS.JUMP, targetBranchId: 'premium-flow' };
      } else if (userType === 'trial') {
        return { action: BRANCH_DECISION_ACTIONS.JUMP, targetBranchId: 'trial-flow' };
      }
      
      return { action: BRANCH_DECISION_ACTIONS.CONTINUE };  // free-flow
    }
  },
  {
    id: 'free-flow',
    phases: [
      {
        id: 'free-data',
        requests: [
          { id: 'free', requestOptions: { reqData: { path: '/free/data' }, resReq: true } }
        ]
      }
    ],
    branchDecisionHook: async () => {
      return { action: BRANCH_DECISION_ACTIONS.JUMP, targetBranchId: 'finalize' };
    }
  },
  {
    id: 'trial-flow',
    phases: [
      {
        id: 'trial-data',
        requests: [
          { id: 'trial', requestOptions: { reqData: { path: '/trial/data' }, resReq: true } }
        ]
      }
    ],
    branchDecisionHook: async () => {
      return { action: BRANCH_DECISION_ACTIONS.JUMP, targetBranchId: 'finalize' };
    }
  },
  {
    id: 'premium-flow',
    phases: [
      {
        id: 'premium-data',
        requests: [
          { id: 'premium', requestOptions: { reqData: { path: '/premium/data' }, resReq: true } }
        ]
      }
    ],
    branchDecisionHook: async () => {
      return { action: BRANCH_DECISION_ACTIONS.JUMP, targetBranchId: 'finalize' };
    }
  },
  {
    id: 'finalize',
    phases: [
      {
        id: 'final',
        requests: [
          { id: 'final', requestOptions: { reqData: { path: '/finalize' }, resReq: true } }
        ]
      }
    ]
  }
];

const result = await stableWorkflow([], {
  workflowId: 'user-type-routing',
  commonRequestData: { hostname: 'api.example.com' },
  branches,
  executeBranchesConcurrently: false,
  sharedBuffer: {}
});
```

#### Retry Logic Within Branches

```typescript
const branches: STABLE_WORKFLOW_BRANCH[] = [
  {
    id: 'retry-branch',
    phases: [
      {
        id: 'retry-phase',
        commonConfig: {
          commonAttempts: 5,
          commonWait: 100,
          commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
        },
        requests: [
          {
            id: 'retry-req',
            requestOptions: {
              reqData: { path: '/unstable-endpoint' },
              resReq: true
            }
          }
        ]
      }
    ]
  }
];

const result = await stableWorkflow([], {
  workflowId: 'retry-workflow',
  commonRequestData: { hostname: 'api.example.com' },
  branches,
  executeBranchesConcurrently: false
});
```

#### Error Handling in Branches

```typescript
const branches: STABLE_WORKFLOW_BRANCH[] = [
  {
    id: 'risky-operation',
    phases: [
      {
        id: 'operation',
        requests: [
          {
            id: 'op',
            requestOptions: {
              reqData: { path: '/risky' },
              resReq: true,
              attempts: 3
            }
          }
        ]
      }
    ],
    branchDecisionHook: async ({ branchResult }) => {
      if (!branchResult.success) {
        return {
          action: BRANCH_DECISION_ACTIONS.JUMP,
          targetBranchId: 'error-handler'
        };
      }
      return { action: BRANCH_DECISION_ACTIONS.JUMP, targetBranchId: 'success-handler' };
    }
  },
  {
    id: 'success-handler',
    phases: [
      {
        id: 'success',
        requests: [
          { id: 'success', requestOptions: { reqData: { path: '/success' }, resReq: true } }
        ]
      }
    ],
    branchDecisionHook: async () => {
      return { action: BRANCH_DECISION_ACTIONS.TERMINATE };
    }
  },
  {
    id: 'error-handler',
    phases: [
      {
        id: 'error',
        requests: [
          { id: 'error', requestOptions: { reqData: { path: '/error' }, resReq: true } }
        ]
      }
    ]
  }
];

const result = await stableWorkflow([], {
  workflowId: 'error-handling-workflow',
  commonRequestData: { hostname: 'api.example.com' },
  branches,
  executeBranchesConcurrently: false,
  stopOnFirstPhaseError: false  // Continue to error handler branch
});
```

#### Branch Completion Hooks

```typescript
const result = await stableWorkflow([], {
  workflowId: 'tracked-branches',
  commonRequestData: { hostname: 'api.example.com' },
  branches,
  executeBranchesConcurrently: true,
  handleBranchCompletion: ({ branchResult, workflowId }) => {
    console.log(`[${workflowId}] Branch ${branchResult.branchId} completed:`, {
      success: branchResult.success,
      phases: branchResult.phases.length,
      decision: branchResult.decision?.action
    });
  }
});
```

#### Mixed Parallel and Serial Branches

```typescript
const branches: STABLE_WORKFLOW_BRANCH[] = [
  {
    id: 'init',
    phases: [/* initialization */]
  },
  {
    id: 'parallel-1',
    markConcurrentBranch: true,
    phases: [/* independent task 1 */]
  },
  {
    id: 'parallel-2',
    markConcurrentBranch: true,
    phases: [/* independent task 2 */]
  },
  {
    id: 'parallel-3',
    markConcurrentBranch: true,
    phases: [/* independent task 3 */],
    branchDecisionHook: async ({ concurrentBranchResults }) => {
      // All parallel branches completed, make decision
      const allSuccessful = concurrentBranchResults!.every(b => b.success);
      if (!allSuccessful) {
        return { action: BRANCH_DECISION_ACTIONS.TERMINATE };
      }
      return { action: BRANCH_DECISION_ACTIONS.CONTINUE };
    }
  },
  {
    id: 'finalize',
    phases: [/* finalization */]
  }
];

const result = await stableWorkflow([], {
  workflowId: 'mixed-execution',
  commonRequestData: { hostname: 'api.example.com' },
  branches,
  executeBranchesConcurrently: false  // Base mode is serial
});

// Execution: init → [parallel-1, parallel-2, parallel-3] → finalize
```

#### Configuration Options

**Workflow Options:**
- `branches`: Array of branch definitions
- `executeBranchesConcurrently`: Execute all branches in parallel (default: false)
- `handleBranchCompletion`: Called when each branch completes

**Branch Options:**
- `id`: Unique branch identifier
- `phases`: Array of phases to execute in this branch
- `branchDecisionHook`: Function returning `BranchExecutionDecision`
- `markConcurrentBranch`: Mark as part of concurrent group (default: false)

**Branch Decision Actions:**
- `CONTINUE`: Proceed to next branch
- `JUMP`: Jump to specific branch by ID
- `TERMINATE`: Stop workflow execution

**Decision Hook Parameters:**
```typescript
interface BranchDecisionHookOptions {
  workflowId: string;
  branchResult: STABLE_WORKFLOW_BRANCH_RESULT;
  branchId: string;
  branchIndex: number;
  sharedBuffer?: Record<string, any>;
  concurrentBranchResults?: STABLE_WORKFLOW_BRANCH_RESULT[];  // For concurrent groups
}
```

**Decision Object:**
```typescript
interface BranchExecutionDecision {
  action: BRANCH_DECISION_ACTIONS;
  targetBranchId?: string;
  metadata?: Record<string, any>;
}
```

#### Mixed Serial and Parallel Execution

Non-linear workflows support mixing serial and parallel phase execution. Mark consecutive phases with `markConcurrentPhase: true` to execute them in parallel, while other phases execute serially.

**Basic Mixed Execution:**

```typescript
import { stableWorkflow, STABLE_WORKFLOW_PHASE, PHASE_DECISION_ACTIONS } from '@emmvish/stable-request';

const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'init',
    requests: [
      { id: 'init', requestOptions: { reqData: { path: '/init' }, resReq: true } }
    ],
    phaseDecisionHook: async () => ({ action: PHASE_DECISION_ACTIONS.CONTINUE })
  },
  // These two phases execute in parallel
  {
    id: 'check-inventory',
    markConcurrentPhase: true,
    requests: [
      { id: 'inv', requestOptions: { reqData: { path: '/inventory' }, resReq: true } }
    ]
  },
  {
    id: 'check-pricing',
    markConcurrentPhase: true,
    requests: [
      { id: 'price', requestOptions: { reqData: { path: '/pricing' }, resReq: true } }
    ],
    // Decision hook receives results from all concurrent phases
    phaseDecisionHook: async ({ concurrentPhaseResults }) => {
      const inventory = concurrentPhaseResults![0].responses[0]?.data;
      const pricing = concurrentPhaseResults![1].responses[0]?.data;
      
      if (inventory.available && pricing.inBudget) {
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      }
      return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'out-of-stock' };
    }
  },
  // This phase executes serially after the parallel group
  {
    id: 'process-order',
    requests: [
      { id: 'order', requestOptions: { reqData: { path: '/order' }, resReq: true } }
    ]
  },
  {
    id: 'out-of-stock',
    requests: [
      { id: 'notify', requestOptions: { reqData: { path: '/notify' }, resReq: true } }
    ]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'mixed-execution',
  commonRequestData: { hostname: 'api.example.com' },
  enableNonLinearExecution: true
});
```

**Multiple Parallel Groups:**

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'authenticate',
    requests: [
      { id: 'auth', requestOptions: { reqData: { path: '/auth' }, resReq: true } }
    ]
  },
  // First parallel group: Data validation
  {
    id: 'validate-user',
    markConcurrentPhase: true,
    requests: [
      { id: 'val-user', requestOptions: { reqData: { path: '/validate/user' }, resReq: true } }
    ]
  },
  {
    id: 'validate-payment',
    markConcurrentPhase: true,
    requests: [
      { id: 'val-pay', requestOptions: { reqData: { path: '/validate/payment' }, resReq: true } }
    ]
  },
  {
    id: 'validate-shipping',
    markConcurrentPhase: true,
    requests: [
      { id: 'val-ship', requestOptions: { reqData: { path: '/validate/shipping' }, resReq: true } }
    ],
    phaseDecisionHook: async ({ concurrentPhaseResults }) => {
      const allValid = concurrentPhaseResults!.every(r => r.success && r.responses[0]?.data?.valid);
      if (!allValid) {
        return { action: PHASE_DECISION_ACTIONS.TERMINATE, metadata: { reason: 'Validation failed' } };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  },
  // Serial processing phase
  {
    id: 'calculate-total',
    requests: [
      { id: 'calc', requestOptions: { reqData: { path: '/calculate' }, resReq: true } }
    ]
  },
  // Second parallel group: External integrations
  {
    id: 'notify-warehouse',
    markConcurrentPhase: true,
    requests: [
      { id: 'warehouse', requestOptions: { reqData: { path: '/notify/warehouse' }, resReq: true } }
    ]
  },
  {
    id: 'notify-shipping',
    markConcurrentPhase: true,
    requests: [
      { id: 'shipping', requestOptions: { reqData: { path: '/notify/shipping' }, resReq: true } }
    ]
  },
  {
    id: 'update-inventory',
    markConcurrentPhase: true,
    requests: [
      { id: 'inventory', requestOptions: { reqData: { path: '/update/inventory' }, resReq: true } }
    ]
  },
  // Final serial phase
  {
    id: 'finalize',
    requests: [
      { id: 'final', requestOptions: { reqData: { path: '/finalize' }, resReq: true } }
    ]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'multi-parallel-workflow',
  commonRequestData: { hostname: 'api.example.com' },
  enableNonLinearExecution: true
});

console.log('Execution order demonstrates mixed serial/parallel execution');
```

**Decision Making with Concurrent Results:**

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'api-check-1',
    markConcurrentPhase: true,
    requests: [
      { id: 'api1', requestOptions: { reqData: { path: '/health/api1' }, resReq: true } }
    ]
  },
  {
    id: 'api-check-2',
    markConcurrentPhase: true,
    requests: [
      { id: 'api2', requestOptions: { reqData: { path: '/health/api2' }, resReq: true } }
    ]
  },
  {
    id: 'api-check-3',
    markConcurrentPhase: true,
    requests: [
      { id: 'api3', requestOptions: { reqData: { path: '/health/api3' }, resReq: true } }
    ],
    phaseDecisionHook: async ({ concurrentPhaseResults, sharedBuffer }) => {
      // Aggregate results from all parallel phases
      const healthScores = concurrentPhaseResults!.map(result => 
        result.responses[0]?.data?.score || 0
      );
      
      const averageScore = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;
      sharedBuffer!.healthScore = averageScore;
      
      if (averageScore > 0.8) {
        return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'optimal-path' };
      } else if (averageScore > 0.5) {
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };  // Go to degraded-path
      } else {
        return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'fallback-path' };
      }
    }
  },
  {
    id: 'degraded-path',
    requests: [
      { id: 'degraded', requestOptions: { reqData: { path: '/degraded' }, resReq: true } }
    ]
  },
  {
    id: 'optimal-path',
    requests: [
      { id: 'optimal', requestOptions: { reqData: { path: '/optimal' }, resReq: true } }
    ]
  },
  {
    id: 'fallback-path',
    requests: [
      { id: 'fallback', requestOptions: { reqData: { path: '/fallback' }, resReq: true } }
    ]
  }
];

const sharedBuffer = {};
const result = await stableWorkflow(phases, {
  workflowId: 'adaptive-routing',
  commonRequestData: { hostname: 'api.example.com' },
  enableNonLinearExecution: true,
  sharedBuffer
});

console.log('Average health score:', sharedBuffer.healthScore);
```

**Error Handling in Parallel Groups:**

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'critical-check',
    markConcurrentPhase: true,
    requests: [
      { 
        id: 'check1',
        requestOptions: { 
          reqData: { path: '/critical/check1' },
          resReq: true,
          attempts: 3
        }
      }
    ]
  },
  {
    id: 'optional-check',
    markConcurrentPhase: true,
    requests: [
      { 
        id: 'check2',
        requestOptions: { 
          reqData: { path: '/optional/check2' },
          resReq: true,
          attempts: 1,
          finalErrorAnalyzer: async () => true  // Suppress errors
        }
      }
    ],
    phaseDecisionHook: async ({ concurrentPhaseResults }) => {
      // Check if critical phase succeeded
      const criticalSuccess = concurrentPhaseResults![0].success;
      
      if (!criticalSuccess) {
        return { 
          action: PHASE_DECISION_ACTIONS.TERMINATE,
          metadata: { reason: 'Critical check failed' }
        };
      }
      
      // Continue even if optional check failed
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  },
  {
    id: 'process',
    requests: [
      { id: 'process', requestOptions: { reqData: { path: '/process' }, resReq: true } }
    ]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'resilient-parallel',
  commonRequestData: { hostname: 'api.example.com' },
  enableNonLinearExecution: true,
  stopOnFirstPhaseError: false  // Continue even with phase errors
});
```

**Key Points:**
- Only **consecutive phases** with `markConcurrentPhase: true` execute in parallel
- The **last phase** in a concurrent group can have a `phaseDecisionHook` that receives `concurrentPhaseResults`
- Parallel groups are separated by phases **without** `markConcurrentPhase` (or phases with it set to false)
- All decision actions work with parallel groups except `REPLAY` (not supported for concurrent groups)
- Error handling follows normal workflow rules - use `stopOnFirstPhaseError` to control behavior

#### Configuration Options

**Workflow Options:**
- `enableNonLinearExecution`: Enable non-linear workflow (required)
- `maxWorkflowIterations`: Maximum total iterations (default: 1000)
- `handlePhaseDecision`: Called when phase makes a decision
- `stopOnFirstPhaseError`: Stop on phase failure (default: false)

**Phase Options:**
- `phaseDecisionHook`: Function returning `PhaseExecutionDecision`
- `allowReplay`: Allow phase replay (default: false)
- `allowSkip`: Allow phase skip (default: false)
- `maxReplayCount`: Maximum replays (default: Infinity)

**Decision Hook Parameters:**
```typescript
interface PhaseDecisionHookOptions {
  workflowId: string;
  phaseResult: STABLE_WORKFLOW_PHASE_RESULT;
  phaseId: string;
  phaseIndex: number;
  executionHistory: PhaseExecutionRecord[];
  sharedBuffer?: Record<string, any>;
  params?: any;
}
```

**Decision Object:**
```typescript
interface PhaseExecutionDecision {
  action: PHASE_DECISION_ACTIONS;
  targetPhaseId?: string;
  replayCount?: number;
  metadata?: Record<string, any>;
}
```

### Retry Strategies

Control the delay between retry attempts:

```typescript
import { stableRequest, RETRY_STRATEGIES } from '@emmvish/stable-request';

// Fixed delay: 1000ms between each retry
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  attempts: 3,
  wait: 1000,
  retryStrategy: RETRY_STRATEGIES.FIXED
});

// Linear backoff: 1000ms, 2000ms, 3000ms
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  attempts: 3,
  wait: 1000,
  retryStrategy: RETRY_STRATEGIES.LINEAR
});

// Exponential backoff: 1000ms, 2000ms, 4000ms
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  attempts: 3,
  wait: 1000,
  maxAllowedWait: 10000,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
});
```

### Circuit Breaker

Prevent cascading failures by automatically blocking requests when error thresholds are exceeded:

```typescript
import { stableApiGateway, CircuitBreakerState } from '@emmvish/stable-request';

const results = await stableApiGateway(requests, {
  commonRequestData: { hostname: 'api.example.com' },
  circuitBreaker: {
    failureThresholdPercentage: 50,  // Open circuit at 50% failure rate
    minimumRequests: 5,               // Need at least 5 requests to calculate
    recoveryTimeoutMs: 30000,         // Try recovery after 30 seconds
    trackIndividualAttempts: false    // Track per-request success/failure
  }
});

// Circuit breaker can be shared across workflows
const breaker = new CircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 10,
  recoveryTimeoutMs: 60000
});

const result = await stableWorkflow(phases, {
  circuitBreaker: breaker,
  // ... other options
});

// Check circuit breaker state
const state = breaker.getState();
console.log(`Circuit breaker state: ${state.state}`); // CLOSED, OPEN, or HALF_OPEN
```

### Rate Limiting

Control request throughput to prevent overwhelming APIs:

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

const results = await stableApiGateway(requests, {
  commonRequestData: { hostname: 'api.example.com' },
  concurrentExecution: true,
  rateLimit: {
    maxRequests: 10,  // Maximum 10 requests
    windowMs: 1000    // Per 1 second window
  }
});

// Rate limiting in workflows
const result = await stableWorkflow(phases, {
  rateLimit: {
    maxRequests: 5,
    windowMs: 1000
  }
});
```

### Caching

Cache responses with TTL to reduce redundant API calls:

```typescript
import { stableRequest, getGlobalCacheManager } from '@emmvish/stable-request';

// Enable caching for a request
const data = await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/users/123' },
  resReq: true,
  cache: {
    enabled: true,
    ttl: 60000  // Cache for 60 seconds
  }
});

// Use global cache manager across requests
const results = await stableApiGateway(requests, {
  commonRequestData: { hostname: 'api.example.com' },
  commonCache: { enabled: true, ttl: 300000 }  // 5 minutes
});

// Manage cache manually
const cacheManager = getGlobalCacheManager();
const stats = cacheManager.getStats();
console.log(`Cache size: ${stats.size}, Valid entries: ${stats.validEntries}`);
cacheManager.clear();  // Clear all cache
```

### Pre-Execution Hooks

Transform requests dynamically before execution:

```typescript
import { stableRequest } from '@emmvish/stable-request';

const commonBuffer: Record<string, any> = {};

const data = await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  preExecution: {
    preExecutionHook: async ({ inputParams, commonBuffer }) => {
      // Fetch authentication token
      const token = await getAuthToken();
      
      // Store in shared buffer
      commonBuffer.token = token;
      commonBuffer.timestamp = Date.now();
      
      // Override request configuration
      return {
        reqData: {
          hostname: 'api.example.com',
          path: '/authenticated-data',
          headers: { Authorization: `Bearer ${token}` }
        }
      };
    },
    preExecutionHookParams: { userId: 'user123' },
    applyPreExecutionConfigOverride: true,  // Apply returned config
    continueOnPreExecutionHookFailure: false
  },
  commonBuffer
});

console.log('Token used:', commonBuffer.token);
```

### Shared Buffer

Share state across requests in gateways and workflows:

```typescript
import { stableWorkflow } from '@emmvish/stable-request';

const sharedBuffer: Record<string, any> = { requestCount: 0 };

const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'phase-1',
    requests: [
      {
        id: 'req-1',
        requestOptions: {
          reqData: { path: '/step1' },
          resReq: true,
          preExecution: {
            preExecutionHook: ({ commonBuffer }) => {
              commonBuffer.requestCount++;
              commonBuffer.phase1Data = 'initialized';
              return {};
            },
            preExecutionHookParams: {},
            applyPreExecutionConfigOverride: false,
            continueOnPreExecutionHookFailure: false
          }
        }
      }
    ]
  },
  {
    id: 'phase-2',
    requests: [
      {
        id: 'req-2',
        requestOptions: {
          reqData: { path: '/step2' },
          resReq: true,
          preExecution: {
            preExecutionHook: ({ commonBuffer }) => {
              commonBuffer.requestCount++;
              // Access data from phase-1
              console.log('Phase 1 data:', commonBuffer.phase1Data);
              return {};
            },
            preExecutionHookParams: {},
            applyPreExecutionConfigOverride: false,
            continueOnPreExecutionHookFailure: false
          }
        }
      }
    ]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'stateful-workflow',
  commonRequestData: { hostname: 'api.example.com' },
  sharedBuffer
});

console.log('Total requests processed:', sharedBuffer.requestCount);
```

### Request Grouping

Apply different configurations to request groups:

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

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
    requestOptions: { reqData: { path: '/optional/1' }, resReq: true }
  }
];

const results = await stableApiGateway(requests, {
  commonRequestData: { hostname: 'api.example.com' },
  commonAttempts: 1,
  commonWait: 100,
  requestGroups: [
    {
      id: 'critical',
      commonConfig: {
        commonAttempts: 5,  // More retries for critical requests
        commonWait: 2000,
        commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
      }
    },
    {
      id: 'optional',
      commonConfig: {
        commonAttempts: 1,  // No retries for optional requests
        commonFinalErrorAnalyzer: async () => true  // Suppress errors
      }
    }
  ]
});
```

### Concurrency Control

Limit concurrent request execution:

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

// Limit to 5 concurrent requests
const results = await stableApiGateway(requests, {
  commonRequestData: { hostname: 'api.example.com' },
  concurrentExecution: true,
  maxConcurrentRequests: 5
});

// Phase-level concurrency control
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'limited-phase',
    concurrentExecution: true,
    maxConcurrentRequests: 3,
    requests: [/* ... */]
  }
];
```

### Response Analysis

Validate response content and trigger retries:

```typescript
import { stableRequest } from '@emmvish/stable-request';

const data = await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/job/status' },
  resReq: true,
  attempts: 10,
  wait: 2000,
  responseAnalyzer: async ({ data, reqData, params }) => {
    // Retry until job is completed
    if (data.status === 'processing') {
      console.log('Job still processing, will retry...');
      return false;  // Trigger retry
    }
    return data.status === 'completed';
  }
});

console.log('Job completed:', data);
```

### Error Handling

Comprehensive error handling with observability hooks:

```typescript
import { stableRequest } from '@emmvish/stable-request';

const data = await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  attempts: 3,
  wait: 1000,
  logAllErrors: true,
  handleErrors: ({ reqData, errorLog, params }) => {
    // Custom error logging
    console.error('Request failed:', {
      url: reqData.url,
      attempt: errorLog.attempt,
      statusCode: errorLog.statusCode,
      error: errorLog.error,
      isRetryable: errorLog.isRetryable
    });
    
    // Send to monitoring service
    monitoringService.trackError(errorLog);
  },
  logAllSuccessfulAttempts: true,
  handleSuccessfulAttemptData: ({ successfulAttemptData }) => {
    console.log('Request succeeded on attempt:', successfulAttemptData.attempt);
  },
  finalErrorAnalyzer: async ({ error, reqData }) => {
    // Gracefully handle specific errors
    if (error.response?.status === 404) {
      console.warn('Resource not found, continuing...');
      return true;  // Return false to suppress error
    }
    return false;  // Throw error
  }
});
```

## Advanced Use Cases

### Use Case 1: Multi-Tenant API with Dynamic Authentication

```typescript
import { stableWorkflow, RETRY_STRATEGIES } from '@emmvish/stable-request';

interface TenantConfig {
  tenantId: string;
  apiKey: string;
  baseUrl: string;
}

async function executeTenantWorkflow(tenantConfig: TenantConfig) {
  const sharedBuffer: Record<string, any> = {
    tenantId: tenantConfig.tenantId,
    authToken: null,
    processedItems: []
  };

  const phases: STABLE_WORKFLOW_PHASE[] = [
    {
      id: 'authentication',
      requests: [
        {
          id: 'get-token',
          requestOptions: {
            reqData: {
              path: '/auth/token',
              method: 'POST',
              headers: { 'X-API-Key': tenantConfig.apiKey }
            },
            resReq: true,
            attempts: 3,
            wait: 2000,
            retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
            responseAnalyzer: async ({ data, commonBuffer }) => {
              if (data?.token) {
                commonBuffer.authToken = data.token;
                commonBuffer.tokenExpiry = Date.now() + (data.expiresIn * 1000);
                return true;
              }
              return false;
            }
          }
        }
      ]
    },
    {
      id: 'data-fetching',
      concurrentExecution: true,
      maxConcurrentRequests: 5,
      requests: [
        {
          id: 'fetch-users',
          requestOptions: {
            reqData: { path: '/users' },
            resReq: true,
            preExecution: {
              preExecutionHook: ({ commonBuffer }) => ({
                reqData: {
                  path: '/users',
                  headers: { Authorization: `Bearer ${commonBuffer.authToken}` }
                }
              }),
              applyPreExecutionConfigOverride: true
            }
          }
        },
        {
          id: 'fetch-settings',
          requestOptions: {
            reqData: { path: '/settings' },
            resReq: true,
            preExecution: {
              preExecutionHook: ({ commonBuffer }) => ({
                reqData: {
                  path: '/settings',
                  headers: { Authorization: `Bearer ${commonBuffer.authToken}` }
                }
              }),
              applyPreExecutionConfigOverride: true
            }
          }
        }
      ]
    },
    {
      id: 'data-processing',
      concurrentExecution: true,
      requests: [
        {
          id: 'process-users',
          requestOptions: {
            reqData: { path: '/process/users', method: 'POST' },
            resReq: true,
            preExecution: {
              preExecutionHook: ({ commonBuffer }) => {
                const usersPhase = commonBuffer.phases?.find(p => p.phaseId === 'data-fetching');
                const usersData = usersPhase?.responses?.find(r => r.requestId === 'fetch-users')?.data;
                
                return {
                  reqData: {
                    path: '/process/users',
                    method: 'POST',
                    headers: { Authorization: `Bearer ${commonBuffer.authToken}` },
                    body: { users: usersData }
                  }
                };
              },
              applyPreExecutionConfigOverride: true
            },
            responseAnalyzer: async ({ data, commonBuffer }) => {
              if (data?.processed) {
                commonBuffer.processedItems.push(...data.processed);
                return true;
              }
              return false;
            }
          }
        }
      ]
    }
  ];

  const result = await stableWorkflow(phases, {
    workflowId: `tenant-${tenantConfig.tenantId}-workflow`,
    commonRequestData: {
      hostname: tenantConfig.baseUrl,
      headers: { 'X-Tenant-ID': tenantConfig.tenantId }
    },
    stopOnFirstPhaseError: true,
    logPhaseResults: true,
    sharedBuffer,
    circuitBreaker: {
      failureThresholdPercentage: 40,
      minimumRequests: 5,
      recoveryTimeoutMs: 30000
    },
    rateLimit: {
      maxRequests: 20,
      windowMs: 1000
    },
    commonCache: {
      enabled: true,
      ttl: 300000  // Cache for 5 minutes
    },
    handlePhaseCompletion: ({ workflowId, phaseResult }) => {
      console.log(`[${workflowId}] Phase ${phaseResult.phaseId} completed:`, {
        success: phaseResult.success,
        successfulRequests: phaseResult.successfulRequests,
        executionTime: `${phaseResult.executionTime}ms`
      });
    },
    handlePhaseError: ({ workflowId, error, phaseResult }) => {
      console.error(`[${workflowId}] Phase ${phaseResult.phaseId} failed:`, error);
      // Send to monitoring
      monitoringService.trackPhaseError(workflowId, phaseResult.phaseId, error);
    }
  });

  return {
    success: result.success,
    tenantId: tenantConfig.tenantId,
    processedItems: sharedBuffer.processedItems,
    executionTime: result.executionTime,
    phases: result.phases.map(p => ({
      id: p.phaseId,
      success: p.success,
      requestCount: p.totalRequests
    }))
  };
}

// Execute workflows for multiple tenants
const tenants: TenantConfig[] = [
  { tenantId: 'tenant-1', apiKey: 'key1', baseUrl: 'api.tenant1.com' },
  { tenantId: 'tenant-2', apiKey: 'key2', baseUrl: 'api.tenant2.com' }
];

const results = await Promise.all(tenants.map(executeTenantWorkflow));
results.forEach(result => {
  console.log(`Tenant ${result.tenantId}:`, result.success ? 'Success' : 'Failed');
});
```

### Use Case 2: Resilient Data Pipeline with Fallback Strategies

```typescript
import { stableApiGateway, RETRY_STRATEGIES, CircuitBreaker } from '@emmvish/stable-request';

interface DataSource {
  id: string;
  priority: number;
  endpoint: string;
  hostname: string;
}

async function fetchDataWithFallback(dataSources: DataSource[]) {
  // Sort by priority
  const sortedSources = [...dataSources].sort((a, b) => a.priority - b.priority);
  
  // Create circuit breakers for each source
  const circuitBreakers = new Map(
    sortedSources.map(source => [
      source.id,
      new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 3,
        recoveryTimeoutMs: 60000
      })
    ])
  );

  // Try each data source in priority order
  for (const source of sortedSources) {
    const breaker = circuitBreakers.get(source.id)!;
    const breakerState = breaker.getState();
    
    // Skip if circuit is open
    if (breakerState.state === 'OPEN') {
      console.warn(`Circuit breaker open for ${source.id}, skipping...`);
      continue;
    }

    console.log(`Attempting to fetch from ${source.id}...`);

    try {
      const requests = [
        {
          id: 'users',
          requestOptions: {
            reqData: { path: `${source.endpoint}/users` },
            resReq: true,
            attempts: 3,
            wait: 1000,
            retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
          }
        },
        {
          id: 'products',
          requestOptions: {
            reqData: { path: `${source.endpoint}/products` },
            resReq: true,
            attempts: 3,
            wait: 1000,
            retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
          }
        },
        {
          id: 'orders',
          requestOptions: {
            reqData: { path: `${source.endpoint}/orders` },
            resReq: true,
            attempts: 3,
            wait: 1000,
            retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
          }
        }
      ];

      const results = await stableApiGateway(requests, {
        commonRequestData: {
          hostname: source.hostname,
          headers: { 'X-Source-ID': source.id }
        },
        concurrentExecution: true,
        maxConcurrentRequests: 10,
        circuitBreaker: breaker,
        rateLimit: {
          maxRequests: 50,
          windowMs: 1000
        },
        commonCache: {
          enabled: true,
          ttl: 60000
        },
        commonResponseAnalyzer: async ({ data }) => {
          // Validate data structure
          return data && typeof data === 'object' && !data.error;
        },
        commonHandleErrors: ({ errorLog }) => {
          console.error(`Error from ${source.id}:`, errorLog);
        }
      });

      // Check if all requests succeeded
      const allSuccessful = results.every(r => r.success);
      
      if (allSuccessful) {
        console.log(`Successfully fetched data from ${source.id}`);
        return {
          source: source.id,
          data: {
            users: results.find(r => r.requestId === 'users')?.data,
            products: results.find(r => r.requestId === 'products')?.data,
            orders: results.find(r => r.requestId === 'orders')?.data
          }
        };
      } else {
        console.warn(`Partial failure from ${source.id}, trying next source...`);
      }
    } catch (error) {
      console.error(`Failed to fetch from ${source.id}:`, error);
      // Continue to next source
    }
  }

  throw new Error('All data sources failed');
}

// Usage
const dataSources: DataSource[] = [
  {
    id: 'primary-db',
    priority: 1,
    endpoint: '/api/v1',
    hostname: 'primary.example.com'
  },
  {
    id: 'replica-db',
    priority: 2,
    endpoint: '/api/v1',
    hostname: 'replica.example.com'
  },
  {
    id: 'backup-cache',
    priority: 3,
    endpoint: '/cached',
    hostname: 'cache.example.com'
  }
];

const result = await fetchDataWithFallback(dataSources);
console.log('Data fetched from:', result.source);
console.log('Users:', result.data.users?.length);
console.log('Products:', result.data.products?.length);
console.log('Orders:', result.data.orders?.length);
```

## License

MIT © Manish Varma

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

**Made with ❤️ for developers integrating with unreliable APIs**
