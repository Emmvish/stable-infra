# Stable Workflow API Reference

## Table of Contents

1. [Overview](#overview)
2. [Core Interfaces](#core-interfaces)
3. [Execution Modes](#execution-modes)
4. [Phase Decision System](#phase-decision-system)
5. [Hook Interfaces](#hook-interfaces)
6. [Result Interfaces](#result-interfaces)
7. [Execution Lifecycle](#execution-lifecycle)
8. [Configuration Examples](#configuration-examples)
9. [Advanced Use Cases](#advanced-use-cases)
10. [Best Practices](#best-practices)

---

## Overview

`stableWorkflow` is a sophisticated orchestration engine that executes multi-phase workflows with advanced control flow. It provides sequential, concurrent, mixed, and non-linear execution modes with phase-level decision-making, state persistence, and comprehensive observability.

### Key Features

- ✅ **Multi-Phase Execution**: Organize requests/functions into logical phases
- ✅ **Execution Modes**: Sequential, concurrent, mixed (hybrid), non-linear, and branched
- ✅ **Phase Decisions**: Dynamic control flow (CONTINUE, SKIP, REPLAY, JUMP, TERMINATE)
- ✅ **Branched Workflows**: Parallel execution paths with independent phase sequences
- ✅ **Branch Decisions**: Control flow for branches (CONTINUE, SKIP, REPLAY, JUMP, TERMINATE)
- ✅ **State Persistence**: Save/load workflow state between phases and branches
- ✅ **Shared Buffer**: Pass data between phases and branches via mutable state
- ✅ **Phase & Branch Hooks**: Pre-execution, completion, error, and decision hooks
- ✅ **Mixed Concurrent Groups**: Mark phases/branches for parallel execution
- ✅ **Circuit Breaker**: Shared across entire workflow
- ✅ **Comprehensive Metrics**: Phase-level, branch-level, and workflow-level statistics

### Function Signature

```typescript
async function stableWorkflow<
  RequestDataType = any, 
  ResponseDataType = any, 
  FunctionArgsType extends any[] = any[], 
  FunctionReturnType = any
>(
  phases: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[],
  options: STABLE_WORKFLOW_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> = {}
): Promise<STABLE_WORKFLOW_RESULT<ResponseDataType | FunctionReturnType>>
```

---

## Core Interfaces

### STABLE_WORKFLOW_PHASE

Configuration for individual workflow phases.

```typescript
interface STABLE_WORKFLOW_PHASE<
  RequestDataType = any, 
  ResponseDataType = any, 
  FunctionArgsType extends any[] = any[], 
  FunctionReturnType = any
> {
  id?: string;
  requests?: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[];
  functions?: API_GATEWAY_FUNCTION<any[], any>[];
  items?: API_GATEWAY_ITEM<RequestDataType, ResponseDataType, any[], any>[];
  concurrentExecution?: boolean;
  stopOnFirstError?: boolean;
  markConcurrentPhase?: boolean;
  maxConcurrentRequests?: number;
  rateLimit?: RateLimitConfig;
  circuitBreaker?: CircuitBreakerConfig;
  maxReplayCount?: number;
  allowReplay?: boolean;
  allowSkip?: boolean;
  phaseDecisionHook?: (options: PhaseDecisionHookOptions<ResponseDataType>) => PhaseExecutionDecision | Promise<PhaseExecutionDecision>;
  commonConfig?: Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, 
    'concurrentExecution' | 'stopOnFirstError' | 'requestGroups' | 'maxConcurrentRequests' | 'rateLimit' | 'circuitBreaker'>;
  statePersistence?: StatePersistenceConfig;
}
```

#### Field Descriptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string?` | `phase-{index+1}` | Unique phase identifier for tracking and jumping. |
| `requests` | `API_GATEWAY_REQUEST[]?` | `[]` | HTTP requests to execute in this phase. |
| `functions` | `API_GATEWAY_FUNCTION[]?` | `[]` | Functions to execute in this phase. |
| `items` | `API_GATEWAY_ITEM[]?` | `[]` | Mixed requests/functions (unified API). |
| `concurrentExecution` | `boolean?` | `true` | Execute items within phase concurrently (true) or sequentially (false). |
| `stopOnFirstError` | `boolean?` | `false` | Stop phase execution on first error within phase. |
| `markConcurrentPhase` | `boolean?` | `false` | Mark phase for concurrent execution with adjacent marked phases (mixed mode only). |
| `maxConcurrentRequests` | `number?` | `undefined` | Concurrency limit for items in this phase. |
| `rateLimit` | `RateLimitConfig?` | `undefined` | Phase-specific rate limiter. |
| `circuitBreaker` | `CircuitBreakerConfig?` | `undefined` | Phase-specific circuit breaker. |
| `maxReplayCount` | `number?` | `undefined` | Maximum times phase can be replayed. |
| `allowReplay` | `boolean?` | `true` | Allow phase to be replayed via REPLAY decision. |
| `allowSkip` | `boolean?` | `true` | Allow phase to be skipped via SKIP decision. |
| `phaseDecisionHook` | `Function?` | `undefined` | Hook to make dynamic control flow decisions after phase execution. |
| `commonConfig` | `Object?` | `{}` | Common configuration for all items in this phase (extends API_GATEWAY_OPTIONS). |
| `statePersistence` | `StatePersistenceConfig?` | `undefined` | Phase-specific state persistence. |
| `metricsGuardrails` | `MetricsGuardrails?` | `undefined` | Phase-specific metrics validation guardrails (see `MetricsGuardrailsPhase`, `MetricsGuardrailsInfrastructure`). |
| `maxTimeout` | `number?` | `undefined` | Phase-level timeout (ms). |

**Note:** Only one of `requests`, `functions`, or `items` should be provided. If multiple are present, `items` takes precedence.

### STABLE_WORKFLOW_OPTIONS

Main configuration interface for the workflow.

```typescript
interface STABLE_WORKFLOW_OPTIONS<
  RequestDataType = any, 
  ResponseDataType = any, 
  FunctionArgsType extends any[] = any[], 
  FunctionReturnType = any
> extends Omit<API_GATEWAY_OPTIONS, 'concurrentExecution' | 'stopOnFirstError'> {
  workflowId?: string;
  stopOnFirstPhaseError?: boolean;
  logPhaseResults?: boolean;
  concurrentPhaseExecution?: boolean;
  enableMixedExecution?: boolean;
  enableNonLinearExecution?: boolean;
  enableBranchExecution?: boolean;
  branches?: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
  maxWorkflowIterations?: number;
  statePersistence?: StatePersistenceConfig;
  handlePhaseCompletion?: (options: HandlePhaseCompletionHookOptions<ResponseDataType>) => any | Promise<any>;
  handlePhaseError?: (options: HandlePhaseErrorHookOptions<ResponseDataType>) => any | Promise<any>;
  handlePhaseDecision?: (options: HandlePhaseDecisionHookOptions<ResponseDataType>) => any | Promise<any>;
  handleBranchCompletion?: (options: HandleBranchCompletionHookOptions<ResponseDataType>) => any | Promise<any>;
  handleBranchDecision?: (options: HandleBranchDecisionHookOptions<ResponseDataType>) => any | Promise<any>;
  prePhaseExecutionHook?: (options: PrePhaseExecutionHookOptions<RequestDataType, ResponseDataType>) => STABLE_WORKFLOW_PHASE | Promise<STABLE_WORKFLOW_PHASE>;
  preBranchExecutionHook?: (options: PreBranchExecutionHookOptions<RequestDataType, ResponseDataType>) => STABLE_WORKFLOW_BRANCH | Promise<STABLE_WORKFLOW_BRANCH>;
  maxSerializableChars?: number;
  workflowHookParams?: WorkflowHookParams;
  metricsGuardrails?: MetricsGuardrails;
  // Plus all API_GATEWAY_OPTIONS fields (commonAttempts, commonWait, etc.)
}
```

#### Field Descriptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `workflowId` | `string?` | `workflow-{timestamp}` | Unique workflow identifier for tracking. |
| `startPhaseIndex` | `number?` | `0` | Start execution at this 0-based phase index. In mixed/non-linear mode, aligns to the first phase of a concurrent group. |
| `stopOnFirstPhaseError` | `boolean?` | `false` | Stop entire workflow if any phase fails. |
| `logPhaseResults` | `boolean?` | `false` | Log phase execution details to console. |
| `concurrentPhaseExecution` | `boolean?` | `false` | Execute all phases concurrently. |
| `enableMixedExecution` | `boolean?` | `false` | Enable mixed mode: sequential with concurrent groups via `markConcurrentPhase`. |
| `enableNonLinearExecution` | `boolean?` | `false` | Enable non-linear mode: phases with decision hooks for dynamic control flow. |
| `enableBranchExecution` | `boolean?` | `false` | Enable branched mode: parallel execution paths with independent phase sequences. |
| `enableBranchRacing` | `boolean?` | `false` | Enable branch racing: first successful branch wins, others are cancelled. Requires `enableBranchExecution: true` and `markConcurrentBranch: true` on branches. |
| `branches` | `STABLE_WORKFLOW_BRANCH[]?` | `[]` | Array of workflow branches (required when `enableBranchExecution: true`). |
| `maxWorkflowIterations` | `number?` | `1000` | Maximum iterations to prevent infinite loops in non-linear/branched mode. |
| `statePersistence` | `StatePersistenceConfig?` | `undefined` | Workflow-level state persistence. |
| `maxTimeout` | `number?` | `undefined` | Workflow-level timeout (ms). |
| `handlePhaseCompletion` | `Function?` | Console logger | Hook called after each phase completes successfully. |
| `handlePhaseError` | `Function?` | Console logger | Hook called when a phase fails. |
| `handlePhaseDecision` | `Function?` | No-op | Hook called after phase decision is made (for logging/observability). |
| `handleBranchCompletion` | `Function?` | Console logger | Hook called after each branch completes. |
| `handleBranchDecision` | `Function?` | No-op | Hook called after branch decision is made (for logging/observability). |
| `prePhaseExecutionHook` | `Function?` | `undefined` | Hook called before each phase executes (can modify phase config). |
| `preBranchExecutionHook` | `Function?` | `undefined` | Hook called before each branch executes (can modify branch config). |
| `maxSerializableChars` | `number?` | `1000` | Maximum characters for serializing objects in logs. |
| `workflowHookParams` | `WorkflowHookParams?` | `{}` | Parameters passed to workflow hooks. |
| `metricsGuardrails` | `MetricsGuardrails?` | `undefined` | Metrics validation guardrails for workflow execution (see `MetricsGuardrailsWorkflow`, `MetricsGuardrailsInfrastructure`, `MetricsGuardrailsCommon`). |
| `loadTransactionLogs` | `Function?` | `undefined` | Hook to load `StableBuffer` transaction logs. Logs are passed to all phase/branch hooks. |
| `transactionLogs` | `StableBufferTransactionLog[]?` | `undefined` | Pre-loaded transaction logs. If `loadTransactionLogs` is also provided, it takes priority. |

**Inherited from API_GATEWAY_OPTIONS:**
- All `common*` configuration fields (commonAttempts, commonWait, commonRetryStrategy, etc.)
- `sharedBuffer`, `requestGroups`, `circuitBreaker`, `rateLimit`, `maxConcurrentRequests`
- `executionContext` for distributed tracing

---

## Execution Modes

`stableWorkflow` supports five execution modes, each optimized for different use cases.

### 1. Sequential Mode (Default)

Phases execute one after another in order.

```typescript
await stableWorkflow(phases, {
  // Default mode - no flags needed
});
```

**Characteristics:**
- Phases execute in array order
- Next phase starts only after previous completes
- Predictable execution order
- Best for dependent phases

**Use Cases:**
- Data pipelines (fetch → transform → save)
- Multi-step processes with dependencies
- Workflows requiring strict ordering

### 2. Concurrent Mode

All phases execute simultaneously.

```typescript
await stableWorkflow(phases, {
  concurrentPhaseExecution: true
});
```

**Characteristics:**
- All phases start at the same time
- Faster execution for independent phases
- No guaranteed execution order
- Cannot use `stopOnFirstPhaseError` effectively

**Use Cases:**
- Independent data fetching from multiple sources
- Parallel processing tasks
- Bulk operations without dependencies

### 3. Mixed Mode

Sequential execution with concurrent groups marked via `markConcurrentPhase`.

```typescript
await stableWorkflow([
  { id: 'phase-1', requests: [...] },                    // Sequential
  { id: 'phase-2', requests: [...], markConcurrentPhase: true }, // Concurrent group start
  { id: 'phase-3', requests: [...], markConcurrentPhase: true }, // Concurrent with phase-2
  { id: 'phase-4', requests: [...] }                     // Sequential (waits for group)
], {
  enableMixedExecution: true
});
```

**Characteristics:**
- Combines sequential and concurrent execution
- Marked phases form concurrent groups
- Groups execute together, then workflow continues sequentially
- Flexible optimization

**Use Cases:**
- Workflows with independent subsections
- Optimizing specific phases while maintaining overall order
- Partial parallelization

### 4. Non-Linear Mode

Dynamic control flow with phase decisions (CONTINUE, SKIP, REPLAY, JUMP, TERMINATE).

```typescript
await stableWorkflow(phases, {
  enableNonLinearExecution: true
});
```

**Characteristics:**
- Phases can make runtime decisions via `phaseDecisionHook`
- Support for conditional execution, loops, jumps
- Complex control flow patterns
- Requires `maxWorkflowIterations` safety limit

**Use Cases:**
- Conditional workflows
- Retry/recovery logic at phase level
- State machines
- Adaptive workflows based on results

### 5. Branched Mode

Execute multiple independent workflow branches in parallel, each with its own phase sequence.

```typescript
await stableWorkflow([], {  // No phases in main workflow
  enableBranchExecution: true,
  branches: [
    {
      id: 'branch-1',
      phases: [/* phases for branch 1 */]
    },
    {
      id: 'branch-2',
      phases: [/* phases for branch 2 */]
    }
  ]
});
```

**Characteristics:**
- Multiple execution paths (branches) run independently
- Each branch has its own phase sequence
- Branches can run concurrently or sequentially
- Branch-level decision hooks for dynamic control
- Support for CONTINUE, SKIP, REPLAY, JUMP, TERMINATE decisions at branch level
- Shared buffer accessible across all branches

**Use Cases:**
- Multi-tenant processing
- A/B testing workflows
- Parallel data pipelines for different data sources
- Feature-flagged execution paths
- Independent microservice orchestration

### Branch Racing

When `enableBranchRacing: true` is set with concurrent branches, the workflow uses `Promise.race()` to select the first successful branch:

```typescript
await stableWorkflow([], {
  enableBranchExecution: true,
  enableBranchRacing: true,  // First successful branch wins
  branches: [
    {
      id: 'provider-a',
      markConcurrentBranch: true,
      phases: [/* ... */]
    },
    {
      id: 'provider-b', 
      markConcurrentBranch: true,
      phases: [/* ... */]
    }
  ]
});
```

**Characteristics:**
- **First-wins semantics**: The first branch to complete successfully wins
- **Automatic cancellation**: Losing branches marked as cancelled with appropriate error
- **Execution history**: Only winning branch's history is recorded
- **Decision hooks**: Only winning branch's decision hook executes
- **Concurrent required**: Racing only works with `markConcurrentBranch: true` on branches

---

## Branch Configuration

### STABLE_WORKFLOW_BRANCH

Configuration for workflow branches.

```typescript
interface STABLE_WORKFLOW_BRANCH<
  RequestDataType = any,
  ResponseDataType = any,
  FunctionArgsType extends any[] = any[],
  FunctionReturnType = any
> {
  id: string;
  phases: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
  markConcurrentBranch?: boolean;
  allowReplay?: boolean;
  maxReplayCount?: number;
  allowSkip?: boolean;
  branchDecisionHook?: (options: BranchDecisionHookOptions<ResponseDataType>) => BranchExecutionDecision | Promise<BranchExecutionDecision>;
  statePersistence?: StatePersistenceConfig;
  commonConfig?: Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>,
    'concurrentExecution' | 'stopOnFirstError' | 'requestGroups' | 'maxConcurrentRequests' | 'rateLimit' | 'circuitBreaker'>;
}
```

#### Field Descriptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string` | Required | Unique branch identifier for tracking and jumping. |
| `phases` | `STABLE_WORKFLOW_PHASE[]` | Required | Array of phases to execute in this branch. |
| `markConcurrentBranch` | `boolean?` | `false` | Mark branch for concurrent execution with adjacent marked branches. |
| `allowReplay` | `boolean?` | `true` | Allow branch to be replayed via REPLAY decision. |
| `maxReplayCount` | `number?` | `undefined` | Maximum times branch can be replayed. |
| `allowSkip` | `boolean?` | `true` | Allow branch to be skipped via SKIP decision. |
| `branchDecisionHook` | `Function?` | `undefined` | Hook to make dynamic control flow decisions after branch execution. |
| `statePersistence` | `StatePersistenceConfig?` | `undefined` | Branch-specific state persistence. |
| `commonConfig` | `Object?` | `{}` | Common configuration for all phases in this branch (extends API_GATEWAY_OPTIONS). |
| `maxTimeout` | `number?` | `undefined` | Branch-level timeout (ms). |

---

## Phase Decision System

Available only in **Non-Linear Mode**. Each phase can return a decision to control workflow execution.

### PhaseExecutionDecision Interface

```typescript
interface PhaseExecutionDecision {
  action: PHASE_DECISION_ACTIONS;
  targetPhaseId?: string;
  replayCount?: number;
  metadata?: Record<string, any>;
  addPhases?: STABLE_WORKFLOW_PHASE[];
}
```

### PHASE_DECISION_ACTIONS Enum

```typescript
enum PHASE_DECISION_ACTIONS {
  CONTINUE = 'continue',      // Proceed to next phase
  SKIP = 'skip',              // Skip next phase
  REPLAY = 'replay',          // Re-execute current phase
  JUMP = 'jump',              // Jump to specific phase
  TERMINATE = 'terminate'     // Stop workflow immediately
}
```

#### Action Details

**CONTINUE**
- Default behavior
- Proceed to next phase in sequence
- No additional fields required

```typescript
phaseDecisionHook: () => ({
  action: PHASE_DECISION_ACTIONS.CONTINUE
})
```

**SKIP**
- Skip the next phase
- Workflow continues with phase after skipped one
- Skipped phase marked with `skipped: true`

```typescript
phaseDecisionHook: ({ phaseResult }) => ({
  action: PHASE_DECISION_ACTIONS.SKIP,
  metadata: { reason: 'Validation passed, skip retry phase' }
})
```

**REPLAY**
- Re-execute the current phase
- Must respect `maxReplayCount` limit
- Phase must have `allowReplay: true` (default)

```typescript
phaseDecisionHook: ({ phaseResult, executionHistory }) => {
  const replayCount = executionHistory.filter(
    e => e.phaseId === phaseResult.phaseId && e.executionNumber !== undefined
  ).length;
  
  if (phaseResult.failedRequests > 0 && replayCount < 3) {
    return {
      action: PHASE_DECISION_ACTIONS.REPLAY,
      replayCount: replayCount + 1
    };
  }
  
  return { action: PHASE_DECISION_ACTIONS.CONTINUE };
}
```

**JUMP**
- Jump to a specific phase by ID
- Requires `targetPhaseId`
- Can create loops (requires `maxWorkflowIterations` protection)

```typescript
phaseDecisionHook: ({ phaseResult, sharedBuffer }) => {
  if (sharedBuffer.needsRevalidation) {
    return {
      action: PHASE_DECISION_ACTIONS.JUMP,
      targetPhaseId: 'validation-phase'
    };
  }
  
  return { action: PHASE_DECISION_ACTIONS.CONTINUE };
}
```

**TERMINATE**
- Immediately stop workflow execution
- Remaining phases not executed
- Workflow marked with `terminatedEarly: true`

```typescript
phaseDecisionHook: ({ phaseResult }) => {
  if (phaseResult.failedRequests === phaseResult.totalRequests) {
    return {
      action: PHASE_DECISION_ACTIONS.TERMINATE,
      metadata: { reason: 'Complete phase failure, abort workflow' }
    };
  }
  
  return { action: PHASE_DECISION_ACTIONS.CONTINUE };
}
```

### PhaseDecisionHookOptions

Context provided to `phaseDecisionHook`:

```typescript
interface PhaseDecisionHookOptions<ResponseDataType = any> {
  workflowId: string;
  branchId?: string;
  phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>;
  phaseId: string;
  phaseIndex: number;
  executionHistory: PhaseExecutionRecord[];
  sharedBuffer?: Record<string, any>;
  params?: any;
  concurrentPhaseResults?: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
}
```

---

## Branch Decision System

Available in **Branched Mode** (`enableBranchExecution: true`). Each branch can return a decision to control workflow execution at the branch level.

### BranchExecutionDecision Interface

```typescript
interface BranchExecutionDecision {
  action: PHASE_DECISION_ACTIONS;
  targetBranchId?: string;
  metadata?: Record<string, any>;
  addPhases?: STABLE_WORKFLOW_PHASE[];
  addBranches?: STABLE_WORKFLOW_BRANCH[];
}
```

**Note:** Branch decisions use the same `PHASE_DECISION_ACTIONS` enum as phase decisions.

### Branch Decision Actions

**CONTINUE**
- Default behavior
- Proceed to next branch in sequence
- No additional fields required

```typescript
branchDecisionHook: () => ({
  action: PHASE_DECISION_ACTIONS.CONTINUE
})
```

**SKIP**
- Skip the next branch
- Workflow continues with branch after skipped one
- Skipped branch marked with `skipped: true`

```typescript
branchDecisionHook: ({ branchResults }) => {
  if (branchResults.every(p => p.success)) {
    return {
      action: PHASE_DECISION_ACTIONS.SKIP,
      metadata: { reason: 'All phases succeeded, skip validation branch' }
    };
  }
  return { action: PHASE_DECISION_ACTIONS.CONTINUE };
}
```

**REPLAY**
- Re-execute the current branch
- Must respect `maxReplayCount` limit
- Branch must have `allowReplay: true` (default)

```typescript
branchDecisionHook: ({ branchResults, executionNumber }) => {
  const hasFailed = branchResults.some(p => !p.success);
  
  if (hasFailed && executionNumber < 3) {
    return {
      action: PHASE_DECISION_ACTIONS.REPLAY,
      metadata: { attempt: executionNumber + 1 }
    };
  }
  
  return { action: PHASE_DECISION_ACTIONS.CONTINUE };
}
```

**JUMP**
- Jump to a specific branch by ID
- Requires `targetBranchId`
- Can create loops (requires `maxWorkflowIterations` protection)

```typescript
branchDecisionHook: ({ branchResults, sharedBuffer }) => {
  if (sharedBuffer.needsReprocessing) {
    return {
      action: PHASE_DECISION_ACTIONS.JUMP,
      targetBranchId: 'data-processing-branch'
    };
  }
  
  return { action: PHASE_DECISION_ACTIONS.CONTINUE };
}
```

**TERMINATE**
- Immediately stop workflow execution
- Remaining branches not executed
- Workflow marked with `terminatedEarly: true`

```typescript
branchDecisionHook: ({ branchResults }) => {
  const criticalFailure = branchResults.every(p => !p.success);
  
  if (criticalFailure) {
    return {
      action: PHASE_DECISION_ACTIONS.TERMINATE,
      metadata: { reason: 'Critical branch failure, abort workflow' }
    };
  }
  
  return { action: PHASE_DECISION_ACTIONS.CONTINUE };
}
```

### BranchDecisionHookOptions

Context provided to `branchDecisionHook`:

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

## Hook Interfaces

### 1. PrePhaseExecutionHookOptions

Called before each phase executes.

```typescript
interface PrePhaseExecutionHookOptions<RequestDataType = any, ResponseDataType = any> {
  params?: any;
  sharedBuffer?: Record<string, any>;
  workflowId: string;
  branchId?: string;
  phaseId: string;
  phaseIndex: number;
  phase: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>;
}
```

**Usage:**
```typescript
prePhaseExecutionHook: async ({ phase, sharedBuffer, phaseIndex }) => {
  // Modify phase configuration dynamically
  const authToken = await getAuthToken();
  
  return {
    ...phase,
    commonConfig: {
      ...phase.commonConfig,
      commonRequestData: {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    }
  };
}
```

### 2. HandlePhaseCompletionHookOptions

Called after phase completes successfully.

```typescript
interface HandlePhaseCompletionHookOptions<ResponseDataType = any> {
  workflowId: string;
  branchId?: string;
  phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>;
  maxSerializableChars?: number;
  params?: any;
  sharedBuffer?: Record<string, any>;
}
```

**Usage:**
```typescript
handlePhaseCompletion: ({ phaseResult, sharedBuffer }) => {
  // Store phase results for downstream phases
  sharedBuffer[phaseResult.phaseId] = {
    success: phaseResult.success,
    data: phaseResult.responses.map(r => r.data)
  };
  
  console.log(`Phase ${phaseResult.phaseId} completed: ${phaseResult.successfulRequests}/${phaseResult.totalRequests} succeeded`);
}
```

### 3. HandlePhaseErrorHookOptions

Called when phase fails.

```typescript
interface HandlePhaseErrorHookOptions<ResponseDataType = any> extends HandlePhaseCompletionHookOptions<ResponseDataType> {
  error: any;
}
```

**Usage:**
```typescript
handlePhaseError: async ({ workflowId, phaseResult, error }) => {
  await logToMonitoring({
    workflowId,
    phaseId: phaseResult.phaseId,
    error: error.message,
    failedRequests: phaseResult.failedRequests,
    timestamp: phaseResult.timestamp
  });
}
```

### 4. HandlePhaseDecisionHookOptions

Called after phase decision is made (observability).

```typescript
interface HandlePhaseDecisionHookOptions<ResponseDataType = any> {
  decision: PhaseExecutionDecision;
  phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>;
  maxSerializableChars?: number;
}
```

**Usage:**
```typescript
handlePhaseDecision: ({ decision, phaseResult }) => {
  console.log(`Phase ${phaseResult.phaseId} decision: ${decision.action}`);
  
  if (decision.action === PHASE_DECISION_ACTIONS.JUMP) {
    console.log(`Jumping to phase: ${decision.targetPhaseId}`);
  }
}
```

### 5. HandleBranchCompletionHookOptions

Called after branch completes.

```typescript
interface HandleBranchCompletionHookOptions<ResponseDataType = any> {
  workflowId: string;
  branchId: string;
  branchResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
  success: boolean;
  maxSerializableChars?: number;
  params?: any;
  sharedBuffer?: Record<string, any>;
}
```

**Usage:**
```typescript
handleBranchCompletion: ({ branchId, branchResults, success }) => {
  const totalPhases = branchResults.length;
  const successfulPhases = branchResults.filter(p => p.success).length;
  
  console.log(`Branch ${branchId} completed: ${successfulPhases}/${totalPhases} phases succeeded`);
  
  if (!success) {
    console.warn(`Branch ${branchId} had failures`);
  }
}
```

### 6. HandleBranchDecisionHookOptions

Called after branch decision is made (observability).

```typescript
interface HandleBranchDecisionHookOptions<ResponseDataType = any> {
  decision: BranchExecutionDecision;
  branchResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
  branchId: string;
  maxSerializableChars?: number;
}
```

**Usage:**
```typescript
handleBranchDecision: ({ decision, branchId }) => {
  console.log(`Branch ${branchId} decision: ${decision.action}`);
  
  if (decision.action === PHASE_DECISION_ACTIONS.JUMP) {
    console.log(`Jumping to branch: ${decision.targetBranchId}`);
  }
}
```

### 7. PreBranchExecutionHookOptions

Called before each branch executes.

```typescript
interface PreBranchExecutionHookOptions<RequestDataType = any, ResponseDataType = any> {
  workflowId: string;
  branchId: string;
  branchIndex: number;
  branch: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType>;
  sharedBuffer?: Record<string, any>;
  params?: any;
}
```

**Usage:**
```typescript
preBranchExecutionHook: async ({ branch, sharedBuffer, branchId }) => {
  // Modify branch configuration dynamically
  const config = await getBranchConfig(branchId);
  
  return {
    ...branch,
    commonConfig: {
      ...branch.commonConfig,
      commonAttempts: config.retryAttempts,
      commonWait: config.retryDelay
    }
  };
}
```

---

## Execution Lifecycle

### Workflow Execution Flow

The execution flow varies based on the mode selected:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INITIALIZATION                                               │
│    - Generate workflowId (if not provided)                      │
│    - Extract configuration options                              │
│    - Initialize shared buffer                                   │
│    - Setup execution context                                    │
│    - Determine execution mode from flags                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 2. MODE SELECTION                                               │
│    Check enabled flags:                                         │
│    ┌─ enableBranchExecution? ──────────────► Branch Mode        │
│    ├─ enableNonLinearExecution? ──────────► Non-Linear Mode     │
│    ├─ concurrentPhaseExecution? ──────────► Concurrent Mode     │
│    ├─ enableMixedExecution? ──────────────► Mixed Mode          │
│    └─ else ────────────────────────────────► Sequential Mode    │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 3. BRANCH MODE EXECUTION (if enableBranchExecution: true)       │
│    ┌────────────────────────────────────────────────────┐       │
│    │ Check if enableBranchRacing: true                  │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│         ┌──────────────┴───────────────┐                        │
│         │                              │                        │
│         ▼ Yes (Racing Mode)            ▼ No (Standard Mode)     │
│    ┌────────────────────────┐    ┌─────────────────────────┐    │
│    │ Promise.race() Branches│    │ Execute Branches        │    │
│    │ • Start all concurrent │    │   Normally              │    │
│    │   branches marked with │    │ • Sequential or         │    │
│    │   markConcurrentBranch │    │   concurrent based on   │    │
│    │ • Wait for FIRST       │    │   markConcurrentBranch  │    │
│    │   successful branch    │    │ • All branches complete │    │
│    │ • Execute winner's     │    │ • All decision hooks    │    │
│    │   decision hook only   │    │   execute               │    │
│    │ • Mark losers as       │    │ • Full execution        │    │
│    │   cancelled            │    │   history recorded      │    │
│    │ • Record only winner's │    │                         │    │
│    │   execution history    │    │                         │    │
│    └───────────┬────────────┘    └────────────┬────────────┘    │
│                │                              │                 │
│                └──────────────┬───────────────┘                 │
│                               │                                 │
│    ┌──────────────────────────▼────────────────────────────┐    │
│    │ For each branch:                                      │    │
│    │   • Call preBranchExecutionHook (if configured)       │    │
│    │   • Execute branch phases sequentially                │    │
│    │   • Apply branch decision hook (if not racing or      │    │
│    │     if winner in racing mode)                         │    │
│    │   • Call handleBranchCompletion (if configured)       │    │
│    │   • Store branch results                              │    │
│    └───────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 4. RESULT AGGREGATION                                           │
│    - Collect all phase/branch results                           │
│    - Calculate workflow metrics                                 │
│    - Validate against guardrails (if configured)                │
│    - Build execution history                                    │
│    - Return STABLE_WORKFLOW_RESULT                              │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Racing mode only applies when `enableBranchRacing: true` and branches have `markConcurrentBranch: true`
- In racing mode, only the winning branch's decision hook executes
- Losing branches are immediately marked as cancelled with appropriate error message
- Execution history only records the winning branch in racing mode
- Standard mode records all branch executions and decision hooks

---

## Result Interfaces

### STABLE_WORKFLOW_PHASE_RESULT

Result for individual phase execution.

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
  infrastructureMetrics?: WorkflowInfrastructureMetrics;
}
```

### STABLE_WORKFLOW_RESULT

Final workflow result.

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
  validation?: MetricsValidationResult;
  metrics?: WorkflowMetrics;
  requestGroupMetrics?: RequestGroupMetrics[];
  infrastructureMetrics?: WorkflowInfrastructureMetrics;
}
```

**Key Fields:**
- `success`: True only if all completed phases/branches succeeded
- `totalPhases`: Total number of phases defined
- `completedPhases`: Number of phases actually executed (may differ in non-linear mode)
- `phases`: Array of phase results (includes replayed/skipped phases)
- `executionHistory`: Ordered record of phase executions with decisions
- `branches`: Array of branch execution results (only present in branched mode)
- `branchExecutionHistory`: Ordered record of branch executions with decisions (only in branched mode)
- `terminatedEarly`: True if workflow stopped via TERMINATE decision
- `validation`: Metrics validation results when `metricsGuardrails` are configured
- `metrics`: Aggregated workflow-level statistics

### BranchExecutionResult

Result for individual branch execution.

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

---

## Execution Lifecycle

### Sequential Mode Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INITIALIZATION                                               │
│    - Generate workflowId (if not provided)                      │
│    - Initialize circuit breaker (if configured)                 │
│    - Initialize metrics collection                              │
│    - Set up shared buffer                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 2. SEQUENTIAL PHASE EXECUTION                                   │
│    For each phase in order:                                     │
│    ┌────────────────────────────────────────────────────┐       │
│    │ 2a. Pre-Phase Execution Hook (if configured)       │       │
│    │     - Receive phase config and context             │       │
│    │     - Return modified phase config                 │       │
│    │     - Can inject dynamic configuration             │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 2b. Execute Phase                                  │       │
│    │     - Merge phase.commonConfig with global config  │       │
│    │     - Call stableApiGateway with phase items       │       │
│    │     - Execute concurrently or sequentially         │       │
│    │       (based on phase.concurrentExecution)         │       │
│    │     - Respect phase.stopOnFirstError               │       │
│    │     - Apply phase circuit breaker/rate limit       │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 2c. Handle Phase Completion                        │       │
│    │     - Build STABLE_WORKFLOW_PHASE_RESULT           │       │
│    │     - Call handlePhaseCompletion hook              │       │
│    │     - Update shared buffer (if modified in hooks)  │       │
│    │     - Store state (if persistence configured)      │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 2d. Error Handling (if phase failed)               │       │
│    │     - Create error phase result                    │       │
│    │     - Call handlePhaseError hook                   │       │
│    │     - If stopOnFirstPhaseError: Break loop         │       │
│    │     - Else: Continue to next phase                 │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    └────────────────────┴─────────────► Next Phase              │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 3. WORKFLOW COMPLETION                                          │
│    - Calculate workflow metrics                                 │
│    - Aggregate phase results                                    │
│    - Extract infrastructure metrics                             │
│    - Build STABLE_WORKFLOW_RESULT                               │
│    - Log final summary (if logPhaseResults: true)               │
└─────────────────────────────────────────────────────────────────┘
```

### Mixed Mode Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ MIXED MODE: Sequential + Concurrent Groups                      │
│                                                                 │
│    Phase 1 (sequential)                                         │
│         │                                                       │
│         ▼                                                       │
│    ┌────────────────────────┐                                   │
│    │ Phase 2 (marked) ────┐ │ Concurrent Group                  │
│    │ Phase 3 (marked)     │◄┤ Execute in parallel               │
│    │ Phase 4 (marked) ────┘ │                                   │
│    └───────────┬────────────┘                                   │
│                │                                                │
│                ▼                                                │
│    Phase 5 (sequential)                                         │
│         │                                                       │
│         ▼                                                       │
│    Phase 6 (sequential)                                         │
│                                                                 │
│ Key:                                                            │
│ - markConcurrentPhase: true → Added to concurrent group         │
│ - markConcurrentPhase: false/undefined → Sequential             │
│ - Groups execute via Promise.all()                              │
│ - Workflow continues after group completes                      │
└─────────────────────────────────────────────────────────────────┘
```

### Non-Linear Mode Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ NON-LINEAR MODE: Dynamic Control Flow                           │ 
│                                                                 │
│    Phase A                                                      │
│       │                                                         │
│       ├──► Execute Phase                                        │
│       │                                                         │
│       ├──► Call phaseDecisionHook                               │
│       │                                                         │
│       └──► Decision?                                            │
│              │                                                  │
│              ├─ CONTINUE ──────► Phase B                        │
│              │                                                  │
│              ├─ SKIP ───────────► Phase C (skip B)              │
│              │                                                  │
│              ├─ REPLAY ─────────► Phase A (re-execute)          │
│              │                                                  │
│              ├─ JUMP ───────────► Phase X (by ID)               │
│              │                                                  │
│              └─ TERMINATE ──────► Workflow End                  │
│                                                                 │
│ Safety Features:                                                │
│ - maxWorkflowIterations: Prevent infinite loops                 │
│ - maxReplayCount: Limit phase replays                           │
│ - executionHistory: Track all phase executions                  │
└─────────────────────────────────────────────────────────────────┘
```

### Branched Mode Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ BRANCHED MODE: Parallel Execution Paths                         │
│                                                                 │
│  Branch 1              Branch 2              Branch 3           │
│    │                    │                      │                │
│    ├─► Phase 1-1        ├─► Phase 2-1          ├─► Phase 3-1    │
│    │                    │                      │                │
│    ├─► Phase 1-2        ├─► Phase 2-2          ├─► Phase 3-2    │
│    │                    │                      │                │
│    ├─► Decision?        ├─► Decision?          ├─► Decision?    │
│    │                    │                      │                │
│    └─► Continue         └─► Continue           └─► Continue     │
│         │                    │                      │           │
│         └────────────────────┴──────────────────────┘           │
│                              │                                  │
│                              ▼                                  │
│                    Workflow Complete                            │
│                                                                 │
│ Branch Execution Modes:                                         │
│ - Sequential: Branches execute one after another                │
│ - Concurrent: All branches execute simultaneously               │
│   (default when enableBranchExecution: true)                    │
│ - Mixed: Some branches marked as concurrent via                 │
│   markConcurrentBranch                                          │
│                                                                 │
│ Branch Decision Actions:                                        │
│ - CONTINUE: Proceed to next branch                              │
│ - SKIP: Skip next branch                                        │
│ - REPLAY: Re-execute current branch                             │
│ - JUMP: Jump to specific branch by ID                           │
│ - TERMINATE: Stop workflow immediately                          │
│                                                                 │
│ Key Features:                                                   │
│ - Each branch has independent phase sequence                    │
│ - Shared buffer accessible across all branches                  │
│ - Branch-level hooks for observability                          │
│ - Dynamic branch configuration via preBranchExecutionHook       │
│ - Support for replaying and skipping branches                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration Examples

### Example 1: Basic Sequential Workflow

```typescript
import { stableWorkflow, REQUEST_METHODS } from '@emmvish/stable-request';

const result = await stableWorkflow([
  {
    id: 'fetch-users',
    requests: [
      { id: 'user-1', requestOptions: { reqData: { hostname: 'api.example.com', path: '/users/1' }, resReq: true } },
      { id: 'user-2', requestOptions: { reqData: { hostname: 'api.example.com', path: '/users/2' }, resReq: true } }
    ],
    concurrentExecution: true
  },
  {
    id: 'process-data',
    functions: [
      {
        id: 'transform',
        functionOptions: {
          fn: (users: any[]) => users.map(u => ({ ...u, processed: true })),
          args: [[]],
          returnResult: true
        }
      }
    ]
  },
  {
    id: 'save-results',
    requests: [
      {
        id: 'save',
        requestOptions: {
          reqData: { hostname: 'api.example.com', path: '/results', method: REQUEST_METHODS.POST }
        }
      }
    ]
  }
], {
  workflowId: 'user-processing-workflow',
  logPhaseResults: true,
  commonAttempts: 3,
  commonWait: 500
});

console.log(`Workflow completed: ${result.completedPhases}/${result.totalPhases} phases`);
console.log(`Success rate: ${(result.successfulRequests / result.totalRequests * 100).toFixed(2)}%`);
```

### Example 2: Concurrent Phase Execution

```typescript
import { stableWorkflow } from '@emmvish/stable-request';

const result = await stableWorkflow([
  {
    id: 'fetch-api-1',
    requests: [{ id: 'api-1', requestOptions: { reqData: { hostname: 'api1.example.com', path: '/data' }, resReq: true } }]
  },
  {
    id: 'fetch-api-2',
    requests: [{ id: 'api-2', requestOptions: { reqData: { hostname: 'api2.example.com', path: '/data' }, resReq: true } }]
  },
  {
    id: 'fetch-api-3',
    requests: [{ id: 'api-3', requestOptions: { reqData: { hostname: 'api3.example.com', path: '/data' }, resReq: true } }]
  }
], {
  concurrentPhaseExecution: true,  // All phases execute at once
  logPhaseResults: true
});

console.log(`Execution time: ${result.executionTime}ms`);
```

### Example 3: Mixed Mode with Concurrent Groups

```typescript
import { stableWorkflow } from '@emmvish/stable-request';

const result = await stableWorkflow([
  {
    id: 'validate',
    requests: [{ id: 'check', requestOptions: { reqData: { hostname: 'api.example.com', path: '/validate' }, resReq: true } }]
  },
  // Concurrent group starts
  {
    id: 'fetch-users',
    markConcurrentPhase: true,
    requests: [{ id: 'users', requestOptions: { reqData: { hostname: 'api.example.com', path: '/users' }, resReq: true } }]
  },
  {
    id: 'fetch-products',
    markConcurrentPhase: true,
    requests: [{ id: 'products', requestOptions: { reqData: { hostname: 'api.example.com', path: '/products' }, resReq: true } }]
  },
  {
    id: 'fetch-orders',
    markConcurrentPhase: true,
    requests: [{ id: 'orders', requestOptions: { reqData: { hostname: 'api.example.com', path: '/orders' }, resReq: true } }]
  },
  // Back to sequential
  {
    id: 'aggregate',
    functions: [
      {
        id: 'merge',
        functionOptions: {
          fn: (data: any) => ({ merged: true, ...data }),
          args: [{}],
          returnResult: true
        }
      }
    ]
  }
], {
  enableMixedExecution: true,
  logPhaseResults: true
});

console.log('Mixed workflow completed with concurrent group optimization');
```

### Example 4: Shared Buffer for Data Passing

```typescript
import { stableWorkflow } from '@emmvish/stable-request';

const sharedBuffer: Record<string, any> = {};

const result = await stableWorkflow([
  {
    id: 'fetch-config',
    requests: [{
      id: 'config',
      requestOptions: {
        reqData: { hostname: 'api.example.com', path: '/config' },
        resReq: true,
        logAllSuccessfulAttempts: true,
        handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
          commonBuffer.config = successfulAttemptData.data;
        }
      }
    }]
  },
  {
    id: 'process-with-config',
    functions: [{
      id: 'process',
      functionOptions: {
        fn: (config: any) => {
          console.log('Processing with config:', config);
          return { processed: true };
        },
        args: [null],
        returnResult: true,
        preExecution: {
          preExecutionHook: ({ commonBuffer }) => ({
            args: [commonBuffer.config]
          }),
          applyPreExecutionConfigOverride: true
        }
      }
    }]
  }
], {
  sharedBuffer,
  logPhaseResults: true
});
```

### Example 5: Non-Linear Workflow with Decisions

```typescript
import { stableWorkflow, PHASE_DECISION_ACTIONS } from '@emmvish/stable-request';

const result = await stableWorkflow([
  {
    id: 'validation',
    requests: [{
      id: 'validate',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/validate' }, resReq: true }
    }],
    phaseDecisionHook: ({ phaseResult, sharedBuffer }) => {
      if (phaseResult.failedRequests > 0) {
        return {
          action: PHASE_DECISION_ACTIONS.TERMINATE,
          metadata: { reason: 'Validation failed' }
        };
      }
      
      sharedBuffer.validated = true;
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  },
  {
    id: 'processing',
    requests: [{
      id: 'process',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/process' }, resReq: true }
    }],
    maxReplayCount: 3,
    phaseDecisionHook: ({ phaseResult, executionHistory }) => {
      const replayCount = executionHistory.filter(
        e => e.phaseId === 'processing' && e.executionNumber !== undefined
      ).length;
      
      if (phaseResult.failedRequests > 0 && replayCount < 3) {
        return {
          action: PHASE_DECISION_ACTIONS.REPLAY,
          replayCount: replayCount + 1
        };
      }
      
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  },
  {
    id: 'verification',
    requests: [{
      id: 'verify',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/verify' }, resReq: true }
    }],
    phaseDecisionHook: ({ phaseResult, sharedBuffer }) => {
      if (phaseResult.responses[0]?.data?.needsRevalidation) {
        return {
          action: PHASE_DECISION_ACTIONS.JUMP,
          targetPhaseId: 'validation'
        };
      }
      
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  }
], {
  enableNonLinearExecution: true,
  maxWorkflowIterations: 10,
  logPhaseResults: true,
  handlePhaseDecision: ({ decision, phaseResult }) => {
    console.log(`Phase ${phaseResult.phaseId} decided: ${decision.action}`);
  }
});

console.log(`Workflow: ${result.terminatedEarly ? 'Terminated Early' : 'Completed'}`);
console.log(`Execution history:`, result.executionHistory);
```

### Example 6: Phase-Level Configuration

```typescript
import { stableWorkflow, RETRY_STRATEGIES } from '@emmvish/stable-request';

const result = await stableWorkflow([
  {
    id: 'critical-phase',
    requests: [{
      id: 'critical',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/critical' }, resReq: true }
    }],
    stopOnFirstError: true,
    commonConfig: {
      commonAttempts: 5,
      commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
      commonMaxAllowedWait: 30000
    },
    circuitBreaker: {
      failureThresholdPercentage: 50,
      minimumRequests: 3,
      recoveryTimeoutMs: 60000
    },
    rateLimit: {
      maxRequests: 10,
      windowMs: 1000
    }
  },
  {
    id: 'standard-phase',
    requests: [{
      id: 'standard',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/data' }, resReq: true }
    }],
    commonConfig: {
      commonAttempts: 2,
      commonRetryStrategy: RETRY_STRATEGIES.LINEAR
    }
  }
], {
  // Global defaults
  commonAttempts: 3,
  commonWait: 1000,
  logPhaseResults: true
});
```

### Example 7: Pre-Phase Execution Hook

```typescript
import { stableWorkflow } from '@emmvish/stable-request';

const result = await stableWorkflow([
  {
    id: 'auth-required',
    requests: [{
      id: 'fetch',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/protected' }, resReq: true }
    }]
  }
], {
  prePhaseExecutionHook: async ({ phase, sharedBuffer, phaseId }) => {
    // Inject auth token before each phase
    const token = await getAuthToken();
    
    return {
      ...phase,
      commonConfig: {
        ...phase.commonConfig,
        commonRequestData: {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Phase-Id': phaseId
          }
        }
      }
    };
  },
  logPhaseResults: true
});
```

### Example 8: Branched Workflow

```typescript
import { stableWorkflow, PHASE_DECISION_ACTIONS } from '@emmvish/stable-request';

const result = await stableWorkflow([], {  // Empty phases array for branched mode
  workflowId: 'multi-tenant-workflow',
  enableBranchExecution: true,
  branches: [
    {
      id: 'tenant-1-branch',
      phases: [
        {
          id: 'fetch-tenant-1-data',
          requests: [{
            id: 'tenant-1',
            requestOptions: {
              reqData: { hostname: 'api.example.com', path: '/tenants/1/data' },
              resReq: true
            }
          }]
        },
        {
          id: 'process-tenant-1',
          functions: [{
            id: 'process',
            functionOptions: {
              fn: (data: any) => ({ processed: true, ...data }),
              args: [{}],
              returnResult: true
            }
          }]
        }
      ],
      commonConfig: {
        commonAttempts: 3
      }
    },
    {
      id: 'tenant-2-branch',
      markConcurrentBranch: true,  // Execute concurrently with other marked branches
      phases: [
        {
          id: 'fetch-tenant-2-data',
          requests: [{
            id: 'tenant-2',
            requestOptions: {
              reqData: { hostname: 'api.example.com', path: '/tenants/2/data' },
              resReq: true
            }
          }]
        },
        {
          id: 'process-tenant-2',
          functions: [{
            id: 'process',
            functionOptions: {
              fn: (data: any) => ({ processed: true, ...data }),
              args: [{}],
              returnResult: true
            }
          }]
        }
      ],
      branchDecisionHook: ({ branchResults, executionNumber }) => {
        const hasFailed = branchResults.some(p => !p.success);
        
        if (hasFailed && executionNumber < 3) {
          return {
            action: PHASE_DECISION_ACTIONS.REPLAY,
            metadata: { reason: 'Retry failed branch' }
          };
        }
        
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      }
    },
    {
      id: 'aggregation-branch',
      phases: [
        {
          id: 'aggregate-results',
          functions: [{
            id: 'aggregate',
            functionOptions: {
              fn: (buffer: any) => {
                console.log('Aggregating results from all tenants');
                return { aggregated: true };
              },
              args: [{}],
              returnResult: true
            }
          }]
        }
      ]
    }
  ],
  handleBranchCompletion: ({ branchId, branchResults, success }) => {
    console.log(`Branch ${branchId}: ${branchResults.length} phases, success: ${success}`);
  },
  logPhaseResults: true
});

console.log(`Branches completed: ${result.branches?.length}`);
console.log(`Branch execution history:`, result.branchExecutionHistory);
```

---

## Advanced Use Cases

### Use Case 1: ETL Pipeline

```typescript
import { stableWorkflow, REQUEST_METHODS } from '@emmvish/stable-request';

const sharedBuffer: Record<string, any> = { extractedData: [] };

const result = await stableWorkflow([
  {
    id: 'extract',
    requests: [
      { id: 'source-1', requestOptions: { reqData: { hostname: 'api1.example.com', path: '/data' }, resReq: true } },
      { id: 'source-2', requestOptions: { reqData: { hostname: 'api2.example.com', path: '/data' }, resReq: true } },
      { id: 'source-3', requestOptions: { reqData: { hostname: 'api3.example.com', path: '/data' }, resReq: true } }
    ],
    concurrentExecution: true,
    commonConfig: {
      commonLogAllSuccessfulAttempts: true,
      commonHandleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
        commonBuffer.extractedData.push(successfulAttemptData.data);
      }
    }
  },
  {
    id: 'transform',
    functions: [{
      id: 'transform-data',
      functionOptions: {
        fn: (data: any[]) => {
          return data.map(item => ({
            ...item,
            transformed: true,
            timestamp: Date.now()
          }));
        },
        args: [[]],
        returnResult: true,
        preExecution: {
          preExecutionHook: ({ commonBuffer }) => ({
            args: [commonBuffer.extractedData]
          }),
          applyPreExecutionConfigOverride: true
        },
        handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
          commonBuffer.transformedData = successfulAttemptData.data;
        }
      }
    }]
  },
  {
    id: 'load',
    requests: [{
      id: 'save-to-db',
      requestOptions: {
        reqData: {
          hostname: 'database.example.com',
          path: '/bulk-insert',
          method: REQUEST_METHODS.POST
        },
        preExecution: {
          preExecutionHook: ({ commonBuffer }) => ({
            reqData: {
              body: commonBuffer.transformedData
            }
          }),
          applyPreExecutionConfigOverride: true
        }
      }
    }]
  }
], {
  sharedBuffer,
  workflowId: 'etl-pipeline',
  stopOnFirstPhaseError: true,
  logPhaseResults: true,
  commonAttempts: 3
});

console.log(`ETL Pipeline: ${result.success ? 'Success' : 'Failed'}`);
console.log(`Processed ${result.totalRequests} operations in ${result.executionTime}ms`);
```

### Use Case 2: Conditional Workflow with Recovery

```typescript
import { stableWorkflow, PHASE_DECISION_ACTIONS } from '@emmvish/stable-request';

const result = await stableWorkflow([
  {
    id: 'primary-processing',
    requests: [{
      id: 'primary',
      requestOptions: { reqData: { hostname: 'primary-api.example.com', path: '/process' }, resReq: true }
    }],
    phaseDecisionHook: ({ phaseResult }) => {
      if (phaseResult.success) {
        // Skip fallback if primary succeeds
        return {
          action: PHASE_DECISION_ACTIONS.SKIP,
          metadata: { reason: 'Primary processing succeeded' }
        };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  },
  {
    id: 'fallback-processing',
    requests: [{
      id: 'fallback',
      requestOptions: { reqData: { hostname: 'fallback-api.example.com', path: '/process' }, resReq: true }
    }],
    allowSkip: true
  },
  {
    id: 'verification',
    requests: [{
      id: 'verify',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/verify' }, resReq: true }
    }]
  }
], {
  enableNonLinearExecution: true,
  logPhaseResults: true
});

const skippedPhases = result.phases.filter(p => p.skipped);
console.log(`Skipped ${skippedPhases.length} phases`);
```

### Use Case 3: State Machine Workflow

```typescript
import { stableWorkflow, PHASE_DECISION_ACTIONS } from '@emmvish/stable-request';

const sharedBuffer: Record<string, any> = { state: 'IDLE' };

const result = await stableWorkflow([
  {
    id: 'idle-state',
    functions: [{
      id: 'check-trigger',
      functionOptions: {
        fn: () => ({ triggered: Math.random() > 0.5 }),
        args: [],
        returnResult: true
      }
    }],
    phaseDecisionHook: ({ phaseResult, sharedBuffer }) => {
      if (phaseResult.responses[0]?.data?.triggered) {
        sharedBuffer.state = 'PROCESSING';
        return {
          action: PHASE_DECISION_ACTIONS.JUMP,
          targetPhaseId: 'processing-state'
        };
      }
      // Stay in idle
      return {
        action: PHASE_DECISION_ACTIONS.REPLAY,
        metadata: { reason: 'Waiting for trigger' }
      };
    },
    maxReplayCount: 5
  },
  {
    id: 'processing-state',
    requests: [{
      id: 'process',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/process' }, resReq: true }
    }],
    phaseDecisionHook: ({ phaseResult, sharedBuffer }) => {
      if (phaseResult.success) {
        sharedBuffer.state = 'COMPLETED';
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      } else {
        sharedBuffer.state = 'ERROR';
        return {
          action: PHASE_DECISION_ACTIONS.JUMP,
          targetPhaseId: 'error-state'
        };
      }
    }
  },
  {
    id: 'completed-state',
    functions: [{
      id: 'finalize',
      functionOptions: {
        fn: () => console.log('Workflow completed successfully'),
        args: [],
        returnResult: true
      }
    }],
    phaseDecisionHook: () => ({
      action: PHASE_DECISION_ACTIONS.TERMINATE,
      metadata: { reason: 'Workflow completed' }
    })
  },
  {
    id: 'error-state',
    functions: [{
      id: 'error-handler',
      functionOptions: {
        fn: () => console.log('Error occurred, handling...'),
        args: [],
        returnResult: true
      }
    }],
    phaseDecisionHook: ({ sharedBuffer }) => {
      sharedBuffer.state = 'IDLE';
      return {
        action: PHASE_DECISION_ACTIONS.JUMP,
        targetPhaseId: 'idle-state'
      };
    }
  }
], {
  enableNonLinearExecution: true,
  maxWorkflowIterations: 20,
  sharedBuffer,
  logPhaseResults: true
});

console.log(`Final state: ${sharedBuffer.state}`);
console.log(`Total iterations: ${result.executionHistory.length}`);
```

### Use Case 4: Monitoring Dashboard Data Collection

```typescript
import { stableWorkflow, REQUEST_METHODS } from '@emmvish/stable-request';

const services = [
  { name: 'auth-service', url: 'auth.example.com/metrics' },
  { name: 'user-service', url: 'users.example.com/metrics' },
  { name: 'order-service', url: 'orders.example.com/metrics' },
  { name: 'payment-service', url: 'payments.example.com/metrics' }
];

const result = await stableWorkflow([
  {
    id: 'collect-metrics',
    requests: services.map(service => ({
      id: service.name,
      requestOptions: {
        reqData: {
          hostname: service.url.split('/')[0],
          path: `/${service.url.split('/')[1]}`
        },
        resReq: true,
        attempts: 2,
        wait: 500
      }
    })),
    concurrentExecution: true
  },
  {
    id: 'aggregate-metrics',
    functions: [{
      id: 'aggregate',
      functionOptions: {
        fn: (responses: any[]) => {
          const metrics = responses.reduce((acc, r) => ({ ...acc, ...r }), {});
          return {
            timestamp: Date.now(),
            services: services.length,
            metrics
          };
        },
        args: [[]],
        returnResult: true
      }
    }]
  },
  {
    id: 'store-dashboard-data',
    requests: [{
      id: 'store',
      requestOptions: {
        reqData: {
          hostname: 'dashboard.example.com',
          path: '/data',
          method: REQUEST_METHODS.POST
        },
        resReq: true
      }
    }]
  }
], {
  workflowId: 'dashboard-refresh',
  concurrentPhaseExecution: false,
  circuitBreaker: {
    failureThresholdPercentage: 70,
    minimumRequests: 3,
    recoveryTimeoutMs: 30000
  }
});
```

### Use Case 5: Multi-Region Data Synchronization

```typescript
import { stableWorkflow, PHASE_DECISION_ACTIONS, REQUEST_METHODS } from '@emmvish/stable-request';

const regions = ['us-east', 'us-west', 'eu-west', 'ap-south'];
const sharedBuffer: Record<string, any> = {};

const result = await stableWorkflow([], {
  workflowId: 'multi-region-sync',
  enableBranchExecution: true,
  branches: regions.map(region => ({
    id: `${region}-branch`,
    markConcurrentBranch: true,  // All regions sync in parallel
    phases: [
      {
        id: `fetch-${region}`,
        requests: [{
          id: `fetch-${region}`,
          requestOptions: {
            reqData: {
              hostname: `${region}.api.example.com`,
              path: '/data',
              method: REQUEST_METHODS.GET
            },
            resReq: true,
            handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
              commonBuffer[`${region}-data`] = successfulAttemptData.data;
            }
          }
        }]
      },
      {
        id: `sync-${region}`,
        requests: [{
          id: `sync-${region}`,
          requestOptions: {
            reqData: {
              hostname: `${region}.api.example.com`,
              path: '/sync',
              method: REQUEST_METHODS.POST
            },
            preExecution: {
              preExecutionHook: ({ commonBuffer }) => ({
                reqData: {
                  body: commonBuffer[`${region}-data`]
                }
              }),
              applyPreExecutionConfigOverride: true
            }
          }
        }]
      },
      {
        id: `verify-${region}`,
        requests: [{
          id: `verify-${region}`,
          requestOptions: {
            reqData: {
              hostname: `${region}.api.example.com`,
              path: '/verify',
              method: REQUEST_METHODS.GET
            },
            resReq: true
          }
        }]
      }
    ],
    branchDecisionHook: ({ branchResults, executionNumber, sharedBuffer }) => {
      const verifyPhase = branchResults.find(p => p.phaseId.startsWith('verify'));
      
      if (verifyPhase && !verifyPhase.success && executionNumber < 3) {
        console.log(`Region ${region} verification failed, replaying branch`);
        return {
          action: PHASE_DECISION_ACTIONS.REPLAY,
          metadata: { attempt: executionNumber + 1 }
        };
      }
      
      if (verifyPhase?.success) {
        sharedBuffer[`${region}-synced`] = true;
      }
      
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    },
    maxReplayCount: 3,
    commonConfig: {
      commonAttempts: 2,
      commonWait: 1000
    }
  })),
  sharedBuffer,
  handleBranchCompletion: ({ branchId, success }) => {
    console.log(`Region ${branchId.replace('-branch', '')} sync: ${success ? 'Success' : 'Failed'}`);
  },
  handleBranchDecision: ({ decision, branchId }) => {
    if (decision.action === PHASE_DECISION_ACTIONS.REPLAY) {
      console.log(`Replaying ${branchId}: ${decision.metadata?.attempt}`);
    }
  },
  maxWorkflowIterations: 50,
  logPhaseResults: true
});

const syncedRegions = regions.filter(r => sharedBuffer[`${r}-synced`]);
console.log(`Successfully synced regions: ${syncedRegions.join(', ')}`);
console.log(`Total branches: ${result.branches?.length}`);
console.log(`Successful branches: ${result.branches?.filter(b => b.success).length}`);
```

### Use Case 6: A/B Testing Workflow

```typescript
import { stableWorkflow, PHASE_DECISION_ACTIONS, REQUEST_METHODS } from '@emmvish/stable-request';

const variants = ['control', 'variant-a', 'variant-b'];

const result = await stableWorkflow([], {
  workflowId: 'ab-test-experiment',
  enableBranchExecution: true,
  branches: variants.map(variant => ({
    id: `${variant}-branch`,
    markConcurrentBranch: true,
    phases: [
      {
        id: `run-${variant}`,
        requests: [{
          id: `test-${variant}`,
          requestOptions: {
            reqData: {
              hostname: 'api.example.com',
              path: `/experiment/${variant}`,
              method: REQUEST_METHODS.POST,
              body: { userId: 'test-user-123' }
            },
            resReq: true
          }
        }]
      },
      {
        id: `collect-metrics-${variant}`,
        requests: [{
          id: `metrics-${variant}`,
          requestOptions: {
            reqData: {
              hostname: 'analytics.example.com',
              path: `/metrics/${variant}`,
              method: REQUEST_METHODS.GET
            },
            resReq: true
          }
        }]
      }
    ],
    commonConfig: {
      commonAttempts: 3,
      commonTimeout: 5000
    }
  })),
  handleBranchCompletion: ({ branchId, branchResults }) => {
    const metrics = branchResults.find(p => p.phaseId.startsWith('collect-metrics'));
    console.log(`${branchId} metrics:`, metrics?.responses[0]?.data);
  },
  logPhaseResults: true
});

const successfulVariants = result.branches?.filter(b => b.success).map(b => b.branchId) || [];
console.log(`Successful variants: ${successfulVariants.join(', ')}`);
```

---

## Best Practices

1. **Use Appropriate Execution Mode** based on phase dependencies
   ```typescript
   // Independent phases → concurrentPhaseExecution: true
   // Dependent phases → sequential (default)
   // Mix of both → enableMixedExecution: true
   ```

2. **Leverage Shared Buffer** for inter-phase communication
   ```typescript
   const sharedBuffer: Record<string, any> = {};
   // Phase 1 writes, Phase 2 reads
   ```

3. **Set Workflow IDs** for tracing and debugging
   ```typescript
   workflowId: 'user-onboarding-workflow-' + userId
   ```

4. **Use Phase IDs** for clear identification
   ```typescript
   { id: 'validation-phase', requests: [...] }
   ```

5. **Enable Logging** during development
   ```typescript
   logPhaseResults: true
   ```

6. **Set Safety Limits** for non-linear workflows
   ```typescript
   maxWorkflowIterations: 100,  // Prevent infinite loops
   maxReplayCount: 3            // Limit phase replays
   ```

7. **Use stopOnFirstPhaseError** for critical workflows
   ```typescript
   stopOnFirstPhaseError: true  // Fail fast
   ```

8. **Implement Phase Hooks** for observability
   ```typescript
   handlePhaseCompletion: ({ phaseResult }) => {
     logToMonitoring(phaseResult);
   }
   ```

9. **Use prePhaseExecutionHook** for dynamic configuration
   ```typescript
   prePhaseExecutionHook: async ({ phase }) => {
     const token = await getToken();
     return { ...phase, headers: { Authorization: token } };
   }
   ```

10. **Analyze Execution History** for debugging
    ```typescript
    result.executionHistory.forEach(record => {
      console.log(`${record.phaseId}: ${record.decision?.action}`);
    });
    ```

11. **Configure Metrics Guardrails** for validation
    ```typescript
    metricsGuardrails: {
      workflow: {
        phaseCompletionRate: { min: 90 },
        requestSuccessRate: { min: 95 },
        executionTime: { max: 30000 }
      },
      phase: {
        requestSuccessRate: { min: 90 },
        executionTime: { max: 5000 }
      }
    }
    ```

---

## Metrics Guardrails and Validation

Metrics guardrails allow you to define validation rules at both workflow and phase levels. Validation results are included when guardrails are configured.

### Workflow-Level Guardrails

Configure guardrails for overall workflow metrics:

```typescript
const result = await stableWorkflow(phases, {
  workflowId: 'data-pipeline',
  metricsGuardrails: {
    workflow: {
      phaseCompletionRate: { min: 90 },
      requestSuccessRate: { min: 95 },
      executionTime: { max: 30000 },
      totalRequests: { expected: 100, tolerance: 10 }
    }
  }
});

if (result.validation && !result.validation.isValid) {
  console.error('Workflow validation failed:', result.validation.anomalies);
}
```

### Available Workflow Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `totalPhases` | `number` | Total number of phases defined |
| `completedPhases` | `number` | Number of phases executed |
| `failedPhases` | `number` | Number of failed phases |
| `phaseCompletionRate` | `number` | Percentage of phases completed (0-100) |
| `totalRequests` | `number` | Total requests across all phases |
| `successfulRequests` | `number` | Total successful requests |
| `failedRequests` | `number` | Total failed requests |
| `requestSuccessRate` | `number` | Overall request success rate (0-100) |
| `requestFailureRate` | `number` | Overall request failure rate (0-100) |
| `executionTime` | `number` | Total workflow execution time in milliseconds |
| `averagePhaseExecutionTime` | `number` | Average time per phase in milliseconds |

### Phase-Level Guardrails

Configure guardrails for individual phases:

```typescript
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'critical-phase',
    requests: [...],
    metricsGuardrails: {
      phase: {
        requestSuccessRate: { min: 100 },  // Must succeed 100%
        executionTime: { max: 5000 },
        failedRequests: { max: 0 }
      }
    }
  },
  {
    id: 'best-effort-phase',
    requests: [...],
    metricsGuardrails: {
      phase: {
        requestSuccessRate: { min: 80 },  // More lenient
        executionTime: { max: 10000 }
      }
    }
  }
];
```

### Available Phase Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `totalRequests` | `number` | Number of requests in phase |
| `successfulRequests` | `number` | Number of successful requests |
| `failedRequests` | `number` | Number of failed requests |
| `requestSuccessRate` | `number` | Phase success rate (0-100) |
| `requestFailureRate` | `number` | Phase failure rate (0-100) |
| `executionTime` | `number` | Phase execution time in milliseconds |

### Branch-Level Guardrails

Configure guardrails for branches in branched workflows:

```typescript
const result = await stableWorkflow([], {
  enableBranchExecution: true,
  branches: [
    {
      id: 'tenant-a',
      phases: [...],
      metricsGuardrails: {
        branch: {
          phaseCompletionRate: { min: 100 },
          requestSuccessRate: { min: 95 }
        }
      }
    }
  ],
  metricsGuardrails: {
    workflow: {
      phaseCompletionRate: { min: 90 }
    }
  }
});
```

### Multi-Level Validation

Validation occurs at all configured levels:

```typescript
const result = await stableWorkflow(phases, {
  // Workflow-level guardrails
  metricsGuardrails: {
    workflow: {
      requestSuccessRate: { min: 95 }
    }
  }
});

// Check workflow-level validation
if (result.validation && !result.validation.isValid) {
  console.error('Workflow validation failed');
}

// Check phase-level validation
result.phases?.forEach(phase => {
  if (phase.validation && !phase.validation.isValid) {
    console.error(`Phase ${phase.phaseId} validation failed:`, 
      phase.validation.anomalies);
  }
});

// Check branch-level validation (if branched mode)
result.branches?.forEach(branch => {
  if (branch.validation && !branch.validation.isValid) {
    console.error(`Branch ${branch.branchId} validation failed:`,
      branch.validation.anomalies);
  }
});
```

### Use Cases

1. **Data Pipeline Validation**: Ensure all phases complete successfully
   ```typescript
   metricsGuardrails: {
     workflow: {
       phaseCompletionRate: { min: 100 },
       requestSuccessRate: { min: 100 }
     }
   }
   ```

2. **SLA Monitoring**: Track workflow execution time
   ```typescript
   metricsGuardrails: {
     workflow: {
       executionTime: { max: 60000 }  // 1-minute SLA
     },
     phase: {
       executionTime: { max: 10000 }  // 10-second per phase
     }
   }
   ```

3. **Quality Gates**: Validate critical phases strictly
   ```typescript
   {
     id: 'validation-phase',
     requests: [...],
     metricsGuardrails: {
       phase: {
         requestSuccessRate: { min: 100 },
         failedRequests: { max: 0 }
       }
     }
   }
   ```

4. **Performance Baselines**: Detect degradation
   ```typescript
   metricsGuardrails: {
     workflow: {
       averagePhaseExecutionTime: { expected: 2000, tolerance: 25 },
       executionTime: { expected: 10000, tolerance: 20 }
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
