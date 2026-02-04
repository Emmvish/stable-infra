# Stable Workflow Graph API Reference

## Table of Contents

1. [Overview](#overview)
2. [Core Interfaces](#core-interfaces)
3. [Node Types](#node-types)
4. [Edge Conditions](#edge-conditions)
5. [Graph Builder](#graph-builder)
6. [Graph Options](#graph-options)
7. [Execution Lifecycle](#execution-lifecycle)
8. [Configuration Examples](#configuration-examples)
9. [Advanced Use Cases](#advanced-use-cases)
10. [Best Practices](#best-practices)

---

## Overview

`stableWorkflowGraph` is a graph-based workflow orchestration engine that executes workflows defined as directed graphs with nodes and edges. It provides advanced control flow with conditional routing, parallel execution, merge points, and complex dependencies beyond linear workflow execution.

### Key Features

- ✅ **Graph-Based Execution**: Define workflows as directed acyclic graphs (DAGs)
- ✅ **Node Types**: PHASE, BRANCH, CONDITIONAL, PARALLEL_GROUP, MERGE_POINT
- ✅ **Edge Conditions**: SUCCESS, FAILURE, CUSTOM, ALWAYS
- ✅ **Conditional Routing**: Dynamic path selection based on execution results
- ✅ **Parallel Execution**: Execute multiple nodes simultaneously
- ✅ **Merge Points**: Synchronize parallel paths before continuing
- ✅ **Graph Builder**: Fluent API for constructing complex workflows
- ✅ **Cycle Detection**: Automatic validation to prevent infinite loops
- ✅ **State Management**: Shared buffer and execution context across nodes
- ✅ **Comprehensive Validation**: Pre-execution graph validation with error reporting

### Function Signature

```typescript
async function stableWorkflowGraph<
  RequestDataType = any,
  ResponseDataType = any,
  FunctionArgsType extends any[] = any[],
  FunctionReturnType = any
>(
  graph: WorkflowGraph<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>,
  options: WorkflowGraphOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> = {}
): Promise<STABLE_WORKFLOW_RESULT<ResponseDataType | FunctionReturnType>>
```

---

## Core Interfaces

### WorkflowGraph

The main graph structure containing nodes and edges.

```typescript
interface WorkflowGraph<
  RequestDataType = any,
  ResponseDataType = any,
  FunctionArgsType extends any[] = any[],
  FunctionReturnType = any
> {
  nodes: Map<string, WorkflowNode<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>;
  edges: Map<string, WorkflowEdge[]>;
  entryPoint: string;
  exitPoints?: string[];
  metadata?: Record<string, any>;
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodes` | `Map<string, WorkflowNode>` | Yes | Map of node IDs to node definitions. |
| `edges` | `Map<string, WorkflowEdge[]>` | Yes | Map of node IDs to outgoing edges. |
| `entryPoint` | `string` | Yes | ID of the starting node for execution. |
| `exitPoints` | `string[]?` | No | Array of node IDs that are valid end points (auto-detected if not provided). |
| `metadata` | `Record<string, any>?` | No | Custom metadata for the graph. |

### WorkflowNode

Configuration for individual graph nodes.

```typescript
interface WorkflowNode<
  RequestDataType = any,
  ResponseDataType = any,
  FunctionArgsType extends any[] = any[],
  FunctionReturnType = any
> {
  id: string;
  type: WorkflowNodeType;
  phase?: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
  branch?: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
  condition?: ConditionalNode<ResponseDataType>;
  parallelNodes?: string[];
  waitForNodes?: string[];
  metadata?: Record<string, any>;
  phaseDecisionHook?: (context: PhaseDecisionHookOptions<ResponseDataType>) => PhaseExecutionDecision | Promise<PhaseExecutionDecision>;
}
```

#### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the node. |
| `type` | `WorkflowNodeType` | Node type (PHASE, BRANCH, CONDITIONAL, PARALLEL_GROUP, MERGE_POINT). |
| `phase` | `STABLE_WORKFLOW_PHASE?` | Phase configuration (required for PHASE nodes). |
| `branch` | `STABLE_WORKFLOW_BRANCH?` | Branch configuration (required for BRANCH nodes). |
| `condition` | `ConditionalNode?` | Conditional evaluator (required for CONDITIONAL nodes). |
| `parallelNodes` | `string[]?` | Array of node IDs to execute in parallel (required for PARALLEL_GROUP nodes). |
| `waitForNodes` | `string[]?` | Array of node IDs to wait for (required for MERGE_POINT nodes). |
| `metadata` | `Record<string, any>?` | Custom metadata for the node. |
| `phaseDecisionHook` | `Function?` | Hook for phase-level decisions (PHASE nodes only). |

### WorkflowEdge

Directed connection between nodes.

```typescript
interface WorkflowEdge {
  from: string;
  to: string;
  condition?: EdgeCondition;
  weight?: number;
  label?: string;
  metadata?: Record<string, any>;
}
```

#### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `from` | `string` | Source node ID. |
| `to` | `string` | Destination node ID. |
| `condition` | `EdgeCondition?` | Condition for traversing this edge. |
| `weight` | `number?` | Edge weight for optimization (not used in current implementation). |
| `label` | `string?` | Human-readable label for the edge. |
| `metadata` | `Record<string, any>?` | Custom metadata for the edge. |

### EdgeCondition

Condition for edge traversal.

```typescript
interface EdgeCondition {
  type: EdgeConditionType;
  evaluate?: (context: EdgeEvaluationContext) => boolean | Promise<boolean>;
}
```

**EdgeConditionType** uses `WorkflowEdgeConditionTypes` enum:
- `SUCCESS`: Traverse only if source node succeeded
- `FAILURE`: Traverse only if source node failed
- `CUSTOM`: Traverse based on custom evaluation function
- `ALWAYS`: Always traverse (default if no condition)

### EdgeEvaluationContext

Context provided to custom edge condition evaluators.

```typescript
interface EdgeEvaluationContext {
  results: Map<string, STABLE_WORKFLOW_PHASE_RESULT<any>>;
  sharedBuffer?: Record<string, any>;
  executionHistory: PhaseExecutionRecord[];
  currentNodeId: string;
}
```

---

## Node Types

The `WorkflowNodeTypes` enum defines five node types for graph-based workflows.

### WorkflowNodeTypes Enum

```typescript
enum WorkflowNodeTypes {
  PHASE = 'phase',
  BRANCH = 'branch',
  CONDITIONAL = 'conditional',
  PARALLEL_GROUP = 'parallel-group',
  MERGE_POINT = 'merge-point'
}
```

### 1. PHASE Node

Executes a single workflow phase with requests/functions.

```typescript
{
  id: 'fetch-users',
  type: WorkflowNodeTypes.PHASE,
  phase: {
    requests: [
      { id: 'user-1', requestOptions: { reqData: { hostname: 'api.example.com', path: '/users/1' }, resReq: true } }
    ]
  }
}
```

**Characteristics:**
- Executes a single `STABLE_WORKFLOW_PHASE`
- Can contain requests, functions, or items
- Supports all phase-level configuration (retry, circuit breaker, etc.)
- Can have phase decision hooks

**Use Cases:**
- Data fetching
- Data transformation
- API calls
- Business logic execution

### 2. BRANCH Node

Executes a multi-phase branch workflow.

```typescript
{
  id: 'tenant-processing',
  type: WorkflowNodeTypes.BRANCH,
  branch: {
    id: 'tenant-1-branch',
    phases: [
      { id: 'fetch', requests: [...] },
      { id: 'process', functions: [...] }
    ]
  }
}
```

**Characteristics:**
- Executes a `STABLE_WORKFLOW_BRANCH` with multiple phases
- Self-contained workflow segment
- All phases in branch execute sequentially or concurrently
- Branch-level decision hooks supported

**Use Cases:**
- Multi-step sub-workflows
- Tenant-specific processing
- Feature-specific logic paths

### 3. CONDITIONAL Node

Routes execution based on runtime evaluation.

```typescript
{
  id: 'route-by-status',
  type: WorkflowNodeTypes.CONDITIONAL,
  condition: {
    evaluate: ({ results, sharedBuffer }) => {
      const prevResult = results.get('validation');
      return prevResult?.success ? 'success-path' : 'failure-path';
    }
  }
}
```

**Characteristics:**
- Evaluates condition to determine next node
- Returns node ID as string
- No outgoing edges defined (runtime determined)
- Access to all execution context

**Use Cases:**
- Dynamic routing
- Error handling paths
- Feature flag routing
- Result-based branching

### 4. PARALLEL_GROUP Node

Executes multiple nodes simultaneously.

```typescript
{
  id: 'parallel-fetch',
  type: WorkflowNodeTypes.PARALLEL_GROUP,
  parallelNodes: ['fetch-users', 'fetch-products', 'fetch-orders']
}
```

**Characteristics:**
- Executes all specified nodes in parallel
- Waits for all to complete before continuing
- Nodes execute via `Promise.all()`
- No partial success handling

**Use Cases:**
- Independent data fetching
- Concurrent API calls
- Parallel processing of different data sources

### 5. MERGE_POINT Node

Synchronization point for parallel execution paths.

```typescript
{
  id: 'sync-point',
  type: WorkflowNodeTypes.MERGE_POINT,
  waitForNodes: ['path-a', 'path-b', 'path-c']
}
```

**Characteristics:**
- Waits for all specified nodes to complete
- Does not execute any work itself
- Ensures synchronization before continuing
- Required after parallel paths that need to converge

**Use Cases:**
- Synchronizing parallel branches
- Waiting for multiple dependencies
- Convergence points in complex workflows

---

## Edge Conditions

The `WorkflowEdgeConditionTypes` enum defines four condition types for edge traversal.

### WorkflowEdgeConditionTypes Enum

```typescript
enum WorkflowEdgeConditionTypes {
  SUCCESS = 'success',
  FAILURE = 'failure',
  CUSTOM = 'custom',
  ALWAYS = 'always'
}
```

### Condition Type Details

**SUCCESS**
- Edge traversed only if source node execution succeeded
- `phaseResult.success === true`

```typescript
builder.connect('validation', 'processing', {
  condition: { type: WorkflowEdgeConditionTypes.SUCCESS }
});
```

**FAILURE**
- Edge traversed only if source node execution failed
- `phaseResult.success === false`

```typescript
builder.connect('validation', 'error-handler', {
  condition: { type: WorkflowEdgeConditionTypes.FAILURE }
});
```

**CUSTOM**
- Edge traversed based on custom evaluation function
- Receives full execution context

```typescript
builder.connect('processing', 'next-step', {
  condition: {
    type: WorkflowEdgeConditionTypes.CUSTOM,
    evaluate: ({ results, sharedBuffer }) => {
      const result = results.get('processing');
      return result && result.successfulRequests > 5;
    }
  }
});
```

**ALWAYS**
- Edge always traversed (default behavior)
- No condition checking

```typescript
builder.connect('step-1', 'step-2', {
  condition: { type: WorkflowEdgeConditionTypes.ALWAYS }
});

// Or simply:
builder.connect('step-1', 'step-2');
```

---

## Graph Builder

The `WorkflowGraphBuilder` class provides a fluent API for constructing workflow graphs.

### Creating a Builder

```typescript
import { WorkflowGraphBuilder } from '@emmvish/stable-infra';

const builder = new WorkflowGraphBuilder<RequestDataType, ResponseDataType>();
```

### Builder Methods

#### addPhase(id: string, phase: STABLE_WORKFLOW_PHASE)

Add a PHASE node to the graph.

```typescript
builder.addPhase('fetch-data', {
  requests: [
    { id: 'api-call', requestOptions: { reqData: { hostname: 'api.example.com', path: '/data' }, resReq: true } }
  ]
});
```

#### addBranch(id: string, branch: STABLE_WORKFLOW_BRANCH)

Add a BRANCH node to the graph.

```typescript
builder.addBranch('process-tenant', {
  id: 'tenant-processing',
  phases: [
    { id: 'fetch', requests: [...] },
    { id: 'transform', functions: [...] }
  ]
});
```

#### addConditional(id: string, evaluate: Function)

Add a CONDITIONAL node to the graph.

```typescript
builder.addConditional('route-by-result', ({ results }) => {
  const validation = results.get('validation');
  return validation?.success ? 'success-handler' : 'error-handler';
});
```

#### addParallelGroup(id: string, nodeIds: string[])

Add a PARALLEL_GROUP node to the graph.

```typescript
builder.addParallelGroup('parallel-fetch', [
  'fetch-users',
  'fetch-products',
  'fetch-orders'
]);
```

#### addMergePoint(id: string, waitForNodes: string[])

Add a MERGE_POINT node to the graph.

```typescript
builder.addMergePoint('sync-point', [
  'branch-a',
  'branch-b',
  'branch-c'
]);
```

#### connect(from: string, to: string, options?)

Connect two nodes with an edge.

```typescript
builder.connect('step-1', 'step-2');

// With condition
builder.connect('validation', 'processing', {
  condition: { type: WorkflowEdgeConditionTypes.SUCCESS },
  label: 'on-success',
  metadata: { priority: 'high' }
});
```

#### connectSequence(...nodeIds: string[])

Connect multiple nodes in sequence.

```typescript
builder.connectSequence('step-1', 'step-2', 'step-3', 'step-4');
// Equivalent to:
// builder.connect('step-1', 'step-2')
//        .connect('step-2', 'step-3')
//        .connect('step-3', 'step-4');
```

#### connectToMany(from: string, toNodes: string[], condition?)

Connect one node to multiple destination nodes.

```typescript
builder.connectToMany('validation', ['success-path', 'alternate-path']);
```

#### connectManyTo(fromNodes: string[], to: string, condition?)

Connect multiple source nodes to one destination node.

```typescript
builder.connectManyTo(['path-a', 'path-b'], 'merge-point');
```

#### setEntryPoint(id: string)

Set the starting node for execution.

```typescript
builder.setEntryPoint('start-node');
```

#### addExitPoint(id: string)

Add a valid exit point node.

```typescript
builder.addExitPoint('success-end');
builder.addExitPoint('failure-end');
```

#### setMetadata(metadata: Record<string, any>)

Set graph-level metadata.

```typescript
builder.setMetadata({
  version: '1.0.0',
  description: 'User processing workflow',
  author: 'team@example.com'
});
```

#### setEnforceDAG(enforce: boolean)

Enable/disable DAG (Directed Acyclic Graph) validation.

```typescript
builder.setEnforceDAG(true);  // Default - prevents cycles
builder.setEnforceDAG(false); // Allow cycles (use with maxWorkflowIterations)
```

#### build(): WorkflowGraph

Build and return the workflow graph.

```typescript
const graph = builder.build();
```

**Note:** `build()` throws an error if:
- Entry point is not set
- DAG validation fails (cycles detected)
- Required node configurations are missing

---

## Graph Options

### WorkflowGraphOptions

Configuration for graph execution.

```typescript
interface WorkflowGraphOptions<
  RequestDataType = any,
  ResponseDataType = any,
  FunctionArgsType extends any[] = any[],
  FunctionReturnType = any
> extends Omit<STABLE_WORKFLOW_OPTIONS, 'branches' | 'enableBranchExecution' | 'concurrentPhaseExecution' | 'enableMixedExecution' | 'enableNonLinearExecution'> {
  validateGraph?: boolean;           // Pre-execution graph validation (default: true)
  optimizeExecution?: boolean;       // Execution optimization hints (default: false)
  maxGraphDepth?: number;            // Maximum graph traversal depth (default: 1000)
  // Inherits from STABLE_WORKFLOW_OPTIONS:
  // - workflowId, stopOnFirstPhaseError, logPhaseResults
  // - maxWorkflowIterations, statePersistence
  // - handlePhaseCompletion, handlePhaseError, handlePhaseDecision
  // - handleBranchCompletion, preBranchExecutionHook, prePhaseExecutionHook
  // - maxSerializableChars, workflowHookParams
  // - enableBranchRacing (for racing parallel branch nodes)
  // - Plus all API_GATEWAY_OPTIONS fields (commonAttempts, commonWait, etc.)
}
```

**Key Options:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `validateGraph` | `boolean?` | `true` | Validate graph structure before execution (cycles, reachability, orphans). |
| `optimizeExecution` | `boolean?` | `false` | Remove unreachable/orphan nodes using `detectUnreachableNodes()` and `detectOrphanNodes()`. |
| `maxGraphDepth` | `number?` | `1000` | Maximum graph traversal depth enforced via `calculateGraphDepth()`. |
| `maxTimeout` | `number?` | `undefined` | Workflow-level timeout (ms) for graph execution. |
| `enableBranchRacing` | `boolean?` | `false` | Enable branch racing for parallel group nodes containing branch nodes. First successful branch wins, others cancelled. |

**Inherited from STABLE_WORKFLOW_OPTIONS:**
- All workflow configuration (workflowId, logPhaseResults, etc.)
- All phase hooks (handlePhaseCompletion, handlePhaseError, etc.)
- Branch hooks (handleBranchCompletion, preBranchExecutionHook)
- State persistence and shared buffer
- Metrics guardrails

**Inherited from API_GATEWAY_OPTIONS:**
- All `common*` fields (commonAttempts, commonWait, commonRetryStrategy, etc.)
- Circuit breaker, rate limiter, concurrency limiter
- Request groups for configuration organization

### Branch Racing in Graphs

When a parallel group node contains multiple branch nodes and `enableBranchRacing: true`, the graph execution uses racing:

```typescript
const graph = new WorkflowGraphBuilder()
  .addBranch('provider-a', { id: 'provider-a', phases: [/* ... */] })
  .addBranch('provider-b', { id: 'provider-b', phases: [/* ... */] })
  .addParallelGroup('race-group', ['provider-a', 'provider-b'])
  .setEntryPoint('race-group')
  .build();

await stableWorkflowGraph(graph, {
  enableBranchRacing: true  // First successful branch wins
});
```

**Characteristics:**
- Applies only to parallel groups where all nodes are branch nodes
- First branch to complete successfully wins
- Losing branches marked as cancelled
- Standard parallel execution when racing is disabled

---

## Execution Lifecycle

### Graph Validation

Before execution (if `validateGraph: true`):

1. **Cycle Detection**: Ensures graph is acyclic (DAG)
2. **Reachability Check**: All nodes reachable from entry point
3. **Orphan Detection**: No disconnected nodes
4. **Configuration Validation**: Required fields present

**Example:**
```typescript
import { validateWorkflowGraph } from '@emmvish/stable-infra';

const validation = validateWorkflowGraph(graph);

if (!validation.valid) {
  console.error('Invalid graph:', validation.errors);
  // validation.cycles, validation.unreachableNodes, validation.orphanNodes
}
```

Internally, `detectUnreachableNodes()` powers reachability checks, `detectOrphanNodes()` flags disconnected nodes, and `calculateGraphDepth()` is used when enforcing `maxGraphDepth`.

### Execution Flow

1. **Initialization**
   - Validate graph structure
   - Initialize shared buffer
   - Setup execution context

2. **Node Execution**
   - Start from entry point
   - Execute nodes based on type
   - Respect edge conditions
   - Track visited nodes

3. **Parallel Execution**
   - PARALLEL_GROUP: Execute all parallel nodes simultaneously
   - MERGE_POINT: Wait for all dependencies
   - Branch racing: Use Promise.race() when enabled
   
   ```
   ┌──────────────────────────────────────────────────────┐
   │ PARALLEL_GROUP Node Execution                        │
   │                                                      │
   │ Check if all parallel nodes are BRANCH nodes         │
   │ AND enableBranchRacing: true                         │
   │                                                      │
   │         ┌────────────┴─────────────┐                 │
   │         │                          │                 │
   │         ▼ Yes (Racing)             ▼ No (Standard)   │
   │    ┌─────────────────┐      ┌──────────────────┐     │
   │    │ Promise.race()  │      │ Promise.all()    │     │
   │    │ • First branch  │      │ • All branches   │     │
   │    │   to succeed    │      │   complete       │     │
   │    │   wins          │      │ • Continue to    │     │
   │    │ • Others marked │      │   next node      │     │
   │    │   cancelled     │      │                  │     │
   │    └────────┬────────┘      └────────┬─────────┘     │
   │             │                        │               │
   │             └───────────┬────────────┘               │
   │                         │                            │
   │                         ▼                            │
   │              Continue graph traversal                │
   └──────────────────────────────────────────────────────┘
   ```

4. **Conditional Routing**
   - CONDITIONAL: Evaluate and route to next node
   - Edge conditions: Check SUCCESS/FAILURE/CUSTOM

5. **Completion**
   - Aggregate metrics
   - Validate against guardrails
   - Return workflow result

### State Management

**Shared Buffer:**
```typescript
  RequestDataType = any,
  ResponseDataType = any,
  FunctionArgsType extends any[] = any[],
  FunctionReturnType = any
> extends Omit<STABLE_WORKFLOW_OPTIONS, 'branches' | 'enableBranchExecution' | 'concurrentPhaseExecution' | 'enableMixedExecution' | 'enableNonLinearExecution'> {
  validateGraph?: boolean;
  optimizeExecution?: boolean;
  maxGraphDepth?: number;
}
```

#### Field Descriptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `validateGraph` | `boolean?` | `true` | Validate graph structure before execution. |
| `optimizeExecution` | `boolean?` | `false` | Remove unreachable/orphan nodes using `detectUnreachableNodes()` and `detectOrphanNodes()`. |
| `maxGraphDepth` | `number?` | `undefined` | Maximum graph traversal depth enforced via `calculateGraphDepth()`. |

**Inherited from STABLE_WORKFLOW_OPTIONS:**
- `workflowId`, `stopOnFirstPhaseError`, `logPhaseResults`
- `handlePhaseCompletion`, `handlePhaseError`, `handlePhaseDecision`
- `prePhaseExecutionHook`
- `sharedBuffer`, `statePersistence`
- `maxWorkflowIterations` (for cycle protection)
- `metricsGuardrails` (workflow-level and phase-level validation via `MetricsGuardrailsWorkflow`, `MetricsGuardrailsPhase`, `MetricsGuardrailsInfrastructure`)
- All `common*` configuration fields

---

## Execution Lifecycle

### Graph Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INITIALIZATION                                               │
│    - Generate workflowId (if not provided)                      │
│    - Validate graph structure (if validateGraph: true)          │
│      * Check cycles (DAG constraint)                            │
│      * Check unreachable nodes                                  │
│      * Check orphan nodes                                       │
│    - Initialize execution context                               │
│    - Set up shared buffer                                       │
│    - Initialize results map                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ 2. GRAPH TRAVERSAL                                              │
│    Starting from entryPoint:                                    │
│    ┌────────────────────────────────────────────────────┐       │
│    │ 2a. Check Node Type                                │       │
│    │     - PHASE: Execute phase                         │       │
│    │     - BRANCH: Execute branch workflow              │       │
│    │     - CONDITIONAL: Evaluate and route              │       │
│    │     - PARALLEL_GROUP: Execute nodes in parallel    │       │
│    │     - MERGE_POINT: Wait for dependencies           │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 2b. Execute Node                                   │       │
│    │     - Run node-specific logic                      │       │
│    │     - Store result in results map                  │       │
│    │     - Mark node as visited                         │       │
│    │     - Update execution history                     │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 2c. Evaluate Outgoing Edges                        │       │
│    │     For each edge from current node:               │       │
│    │     - Check edge condition (if present)            │       │
│    │       * SUCCESS: Check if node succeeded           │       │
│    │       * FAILURE: Check if node failed              │       │
│    │       * CUSTOM: Call evaluate function             │       │
│    │       * ALWAYS: Always traverse                    │       │
│    │     - If condition met: Traverse to next node      │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    ┌───────────────────▼────────────────────────────────┐       │
│    │ 2d. Continue Traversal                             │       │
│    │     - Recursively execute next nodes               │       │
│    │     - Respect visited nodes (no re-execution)      │       │
│    │     - Handle terminatedEarly flag                  │       │
│    │     - Process until exit point reached             │       │
│    └───────────────────┬────────────────────────────────┘       │
│                        │                                        │
│    └────────────────────┴─────────────► Next Node               │
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

### Node Type Execution Details

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE NODE EXECUTION                                            │
│                                                                 │
│  1. Check if node has phase configuration                       │
│  2. Call prePhaseExecutionHook (if configured)                  │
│  3. Execute phase via executePhase()                            │
│  4. Store result in results map                                 │
│  5. Call phaseDecisionHook (if configured)                      │
│     - Support REPLAY action (re-execute phase)                  │
│     - Support TERMINATE action (stop workflow)                  │
│  6. Call handlePhaseCompletion hook                             │
│  7. Check stopOnFirstPhaseError                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ BRANCH NODE EXECUTION                                           │
│                                                                 │
│  1. Check if node has branch configuration                      │
│  2. Execute branch via executeBranchWorkflow()                  │
│  3. Create aggregate phase result for branch                    │
│  4. Store in results map                                        │
│  5. Add branch phase results to overall results                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ CONDITIONAL NODE EXECUTION                                      │
│                                                                 │
│  1. Check if node has condition evaluator                       │
│  2. Mark node as visited                                        │
│  3. Call condition.evaluate() with context                      │
│     - Returns next node ID as string                            │
│  4. Validate next node exists in graph                          │
│  5. Execute next node (no edge traversal)                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PARALLEL_GROUP NODE EXECUTION                                   │
│                                                                 │
│  1. Check if node has parallelNodes array                       │
│  2. Execute all nodes via Promise.all()                         │
│  3. Wait for all to complete                                    │
│  4. Continue with next nodes                                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ MERGE_POINT NODE EXECUTION                                      │
│                                                                 │
│  1. Check if node has waitForNodes array                        │
│  2. Check if all dependencies are visited                       │
│  3. If not satisfied: Return early (wait)                       │
│  4. If satisfied: Mark as visited                               │
│  5. Traverse outgoing edges                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration Examples

### Example 1: Simple Sequential Graph

```typescript
import { WorkflowGraphBuilder, stableWorkflowGraph, WorkflowNodeTypes } from '@emmvish/stable-infra';

const builder = new WorkflowGraphBuilder();

builder
  .addPhase('fetch', {
    requests: [{
      id: 'fetch-data',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/data' }, resReq: true }
    }]
  })
  .addPhase('transform', {
    functions: [{
      id: 'transform-data',
      functionOptions: {
        fn: (data: any) => ({ ...data, transformed: true }),
        args: [{}],
        returnResult: true
      }
    }]
  })
  .addPhase('save', {
    requests: [{
      id: 'save-data',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/save', method: 'POST' } }
    }]
  })
  .connectSequence('fetch', 'transform', 'save')
  .setEntryPoint('fetch')
  .addExitPoint('save');

const graph = builder.build();

const result = await stableWorkflowGraph(graph, {
  workflowId: 'simple-pipeline',
  logPhaseResults: true
});

console.log(`Workflow: ${result.success ? 'Success' : 'Failed'}`);
```

### Example 2: Conditional Routing

```typescript
import { WorkflowGraphBuilder, stableWorkflowGraph, WorkflowNodeTypes, WorkflowEdgeConditionTypes } from '@emmvish/stable-infra';

const builder = new WorkflowGraphBuilder();

builder
  .addPhase('validation', {
    requests: [{
      id: 'validate',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/validate' }, resReq: true }
    }]
  })
  .addConditional('route-by-validation', ({ results }) => {
    const validation = results.get('validation');
    return validation?.success ? 'process-data' : 'error-handler';
  })
  .addPhase('process-data', {
    requests: [{
      id: 'process',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/process' }, resReq: true }
    }]
  })
  .addPhase('error-handler', {
    functions: [{
      id: 'log-error',
      functionOptions: {
        fn: () => console.error('Validation failed'),
        args: [],
        returnResult: true
      }
    }]
  })
  .connect('validation', 'route-by-validation')
  .setEntryPoint('validation')
  .addExitPoint('process-data')
  .addExitPoint('error-handler');

const graph = builder.build();

const result = await stableWorkflowGraph(graph, {
  logPhaseResults: true
});
```

### Example 3: Parallel Execution with Merge Point

```typescript
import { WorkflowGraphBuilder, stableWorkflowGraph, WorkflowNodeTypes } from '@emmvish/stable-infra';

const builder = new WorkflowGraphBuilder();

builder
  .addPhase('start', {
    functions: [{
      id: 'init',
      functionOptions: { fn: () => console.log('Starting'), args: [], returnResult: true }
    }]
  })
  .addParallelGroup('parallel-fetch', [
    'fetch-users',
    'fetch-products',
    'fetch-orders'
  ])
  .addPhase('fetch-users', {
    requests: [{
      id: 'users',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/users' }, resReq: true }
    }]
  })
  .addPhase('fetch-products', {
    requests: [{
      id: 'products',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/products' }, resReq: true }
    }]
  })
  .addPhase('fetch-orders', {
    requests: [{
      id: 'orders',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/orders' }, resReq: true }
    }]
  })
  .addMergePoint('sync-point', ['fetch-users', 'fetch-products', 'fetch-orders'])
  .addPhase('aggregate', {
    functions: [{
      id: 'merge-results',
      functionOptions: {
        fn: (buffer: any) => {
          console.log('Aggregating all fetched data');
          return { aggregated: true };
        },
        args: [{}],
        returnResult: true
      }
    }]
  })
  .connectSequence('start', 'parallel-fetch')
  .connect('sync-point', 'aggregate')
  .setEntryPoint('start')
  .addExitPoint('aggregate');

const graph = builder.build();

const result = await stableWorkflowGraph(graph, {
  logPhaseResults: true
});

console.log(`Parallel execution completed in ${result.executionTime}ms`);
```

### Example 4: Success/Failure Edge Conditions

```typescript
import { WorkflowGraphBuilder, stableWorkflowGraph, WorkflowEdgeConditionTypes } from '@emmvish/stable-infra';

const builder = new WorkflowGraphBuilder();

builder
  .addPhase('risky-operation', {
    requests: [{
      id: 'risky',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/risky' }, resReq: true }
    }]
  })
  .addPhase('success-handler', {
    functions: [{
      id: 'success',
      functionOptions: { fn: () => console.log('Success!'), args: [], returnResult: true }
    }]
  })
  .addPhase('failure-handler', {
    functions: [{
      id: 'failure',
      functionOptions: { fn: () => console.log('Failed!'), args: [], returnResult: true }
    }]
  })
  .addPhase('retry', {
    requests: [{
      id: 'retry-operation',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/retry' }, resReq: true }
    }]
  })
  .connect('risky-operation', 'success-handler', {
    condition: { type: WorkflowEdgeConditionTypes.SUCCESS },
    label: 'on-success'
  })
  .connect('risky-operation', 'failure-handler', {
    condition: { type: WorkflowEdgeConditionTypes.FAILURE },
    label: 'on-failure'
  })
  .connect('failure-handler', 'retry')
  .setEntryPoint('risky-operation')
  .addExitPoint('success-handler')
  .addExitPoint('retry');

const graph = builder.build();

const result = await stableWorkflowGraph(graph, {
  logPhaseResults: true
});
```

### Example 5: Custom Edge Conditions

```typescript
import { WorkflowGraphBuilder, stableWorkflowGraph, WorkflowEdgeConditionTypes } from '@emmvish/stable-infra';

const builder = new WorkflowGraphBuilder();

builder
  .addPhase('data-fetch', {
    requests: [{
      id: 'fetch',
      requestOptions: {
        reqData: { hostname: 'api.example.com', path: '/data' },
        resReq: true,
        handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
          commonBuffer.recordCount = successfulAttemptData.data?.length || 0;
        }
      }
    }]
  })
  .addPhase('bulk-process', {
    functions: [{
      id: 'bulk',
      functionOptions: { fn: () => console.log('Bulk processing'), args: [], returnResult: true }
    }]
  })
  .addPhase('single-process', {
    functions: [{
      id: 'single',
      functionOptions: { fn: () => console.log('Single processing'), args: [], returnResult: true }
    }]
  })
  .connect('data-fetch', 'bulk-process', {
    condition: {
      type: WorkflowEdgeConditionTypes.CUSTOM,
      evaluate: ({ sharedBuffer }) => {
        return (sharedBuffer?.recordCount || 0) > 100;
      }
    },
    label: 'if-large-dataset'
  })
  .connect('data-fetch', 'single-process', {
    condition: {
      type: WorkflowEdgeConditionTypes.CUSTOM,
      evaluate: ({ sharedBuffer }) => {
        return (sharedBuffer?.recordCount || 0) <= 100;
      }
    },
    label: 'if-small-dataset'
  })
  .setEntryPoint('data-fetch')
  .addExitPoint('bulk-process')
  .addExitPoint('single-process');

const graph = builder.build();

const result = await stableWorkflowGraph(graph, {
  sharedBuffer: {},
  logPhaseResults: true
});
```

### Example 6: Branch Nodes in Graph

```typescript
import { WorkflowGraphBuilder, stableWorkflowGraph, PHASE_DECISION_ACTIONS } from '@emmvish/stable-infra';

const builder = new WorkflowGraphBuilder();

builder
  .addPhase('init', {
    functions: [{
      id: 'initialize',
      functionOptions: { fn: () => ({ initialized: true }), args: [], returnResult: true }
    }]
  })
  .addBranch('tenant-a-processing', {
    id: 'tenant-a',
    phases: [
      {
        id: 'fetch-a',
        requests: [{
          id: 'a-data',
          requestOptions: { reqData: { hostname: 'api.example.com', path: '/tenant-a/data' }, resReq: true }
        }]
      },
      {
        id: 'process-a',
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
    branchDecisionHook: ({ branchResults }) => {
      const allSuccess = branchResults.every(p => p.success);
      return {
        action: allSuccess ? PHASE_DECISION_ACTIONS.CONTINUE : PHASE_DECISION_ACTIONS.REPLAY,
        metadata: { retry: !allSuccess }
      };
    },
    maxReplayCount: 2
  })
  .addBranch('tenant-b-processing', {
    id: 'tenant-b',
    phases: [
      {
        id: 'fetch-b',
        requests: [{
          id: 'b-data',
          requestOptions: { reqData: { hostname: 'api.example.com', path: '/tenant-b/data' }, resReq: true }
        }]
      }
    ]
  })
  .addMergePoint('wait-tenants', ['tenant-a-processing', 'tenant-b-processing'])
  .addPhase('finalize', {
    functions: [{
      id: 'complete',
      functionOptions: { fn: () => console.log('All tenants processed'), args: [], returnResult: true }
    }]
  })
  .connect('init', 'tenant-a-processing')
  .connect('init', 'tenant-b-processing')
  .connect('wait-tenants', 'finalize')
  .setEntryPoint('init')
  .addExitPoint('finalize');

const graph = builder.build();

const result = await stableWorkflowGraph(graph, {
  logPhaseResults: true,
  maxWorkflowIterations: 50
});
```

---

## Advanced Use Cases

### Use Case 1: Complex ETL Pipeline with Error Handling

```typescript
import { WorkflowGraphBuilder, stableWorkflowGraph, WorkflowEdgeConditionTypes } from '@emmvish/stable-infra';

const builder = new WorkflowGraphBuilder();

const sharedBuffer: Record<string, any> = {};

builder
  // Extract phase
  .addParallelGroup('parallel-extract', [
    'extract-source-1',
    'extract-source-2',
    'extract-source-3'
  ])
  .addPhase('extract-source-1', {
    requests: [{
      id: 'source-1',
      requestOptions: {
        reqData: { hostname: 'api1.example.com', path: '/data' },
        resReq: true,
        handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
          commonBuffer.source1Data = successfulAttemptData.data;
        }
      }
    }]
  })
  .addPhase('extract-source-2', {
    requests: [{
      id: 'source-2',
      requestOptions: {
        reqData: { hostname: 'api2.example.com', path: '/data' },
        resReq: true,
        handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
          commonBuffer.source2Data = successfulAttemptData.data;
        }
      }
    }]
  })
  .addPhase('extract-source-3', {
    requests: [{
      id: 'source-3',
      requestOptions: {
        reqData: { hostname: 'api3.example.com', path: '/data' },
        resReq: true,
        handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
          commonBuffer.source3Data = successfulAttemptData.data;
        }
      }
    }]
  })
  
  // Merge and validate
  .addMergePoint('sync-extract', ['extract-source-1', 'extract-source-2', 'extract-source-3'])
  .addPhase('validate-extraction', {
    functions: [{
      id: 'validate',
      functionOptions: {
        fn: (buffer: any) => {
          const valid = buffer.source1Data && buffer.source2Data && buffer.source3Data;
          return { valid, message: valid ? 'All sources extracted' : 'Missing data' };
        },
        args: [sharedBuffer],
        returnResult: true
      }
    }]
  })
  
  // Transform or retry extraction
  .addConditional('route-after-validation', ({ results, sharedBuffer }) => {
    const validation = results.get('validate-extraction');
    const validData = validation?.responses[0]?.data?.valid;
    return validData ? 'transform' : 'retry-extraction';
  })
  
  .addPhase('transform', {
    functions: [{
      id: 'transform-data',
      functionOptions: {
        fn: (buffer: any) => {
          return {
            combined: [
              ...buffer.source1Data,
              ...buffer.source2Data,
              ...buffer.source3Data
            ].map((item: any) => ({ ...item, transformed: true }))
          };
        },
        args: [sharedBuffer],
        returnResult: true,
        handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
          commonBuffer.transformedData = successfulAttemptData.data;
        }
      }
    }]
  })
  
  .addPhase('retry-extraction', {
    functions: [{
      id: 'log-retry',
      functionOptions: {
        fn: () => console.warn('Extraction failed, retrying...'),
        args: [],
        returnResult: true
      }
    }]
  })
  
  // Load phase
  .addPhase('load-to-database', {
    requests: [{
      id: 'bulk-insert',
      requestOptions: {
        reqData: {
          hostname: 'database.example.com',
          path: '/bulk-insert',
          method: 'POST'
        },
        preExecution: {
          preExecutionHook: ({ commonBuffer }) => ({
            reqData: { body: commonBuffer.transformedData }
          }),
          applyPreExecutionConfigOverride: true
        }
      }
    }]
  })
  
  // Final validation
  .addPhase('verify-load', {
    requests: [{
      id: 'verify',
      requestOptions: { reqData: { hostname: 'database.example.com', path: '/verify' }, resReq: true }
    }]
  })
  
  // Connections
  .connect('parallel-extract', 'sync-extract')
  .connect('sync-extract', 'validate-extraction')
  .connect('validate-extraction', 'route-after-validation')
  .connect('retry-extraction', 'parallel-extract')
  .connect('transform', 'load-to-database')
  .connect('load-to-database', 'verify-load')
  
  .setEntryPoint('parallel-extract')
  .addExitPoint('verify-load')
  .addExitPoint('retry-extraction')
  .setEnforceDAG(false); // Allow retry loop

const graph = builder.build();

const result = await stableWorkflowGraph(graph, {
  workflowId: 'etl-pipeline',
  sharedBuffer,
  logPhaseResults: true,
  maxWorkflowIterations: 10,
  commonAttempts: 3
});

console.log(`ETL Pipeline: ${result.success ? 'Success' : 'Failed'}`);
console.log(`Total execution time: ${result.executionTime}ms`);
```

### Use Case 2: Multi-Stage Approval Workflow

```typescript
import { WorkflowGraphBuilder, stableWorkflowGraph, WorkflowEdgeConditionTypes } from '@emmvish/stable-infra';

const builder = new WorkflowGraphBuilder();
const sharedBuffer: Record<string, any> = { approvals: [] };

builder
  .addPhase('submit-request', {
    requests: [{
      id: 'submit',
      requestOptions: {
        reqData: { hostname: 'api.example.com', path: '/requests', method: 'POST' },
        resReq: true,
        handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
          commonBuffer.requestId = successfulAttemptData.data?.id;
        }
      }
    }]
  })
  
  // Parallel approval stages
  .addParallelGroup('parallel-approvals', [
    'manager-approval',
    'finance-approval',
    'legal-approval'
  ])
  
  .addPhase('manager-approval', {
    requests: [{
      id: 'manager',
      requestOptions: {
        reqData: { hostname: 'api.example.com', path: '/approvals/manager' },
        resReq: true,
        handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
          commonBuffer.approvals.push({ role: 'manager', approved: successfulAttemptData.data?.approved });
        }
      }
    }]
  })
  
  .addPhase('finance-approval', {
    requests: [{
      id: 'finance',
      requestOptions: {
        reqData: { hostname: 'api.example.com', path: '/approvals/finance' },
        resReq: true,
        handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
          commonBuffer.approvals.push({ role: 'finance', approved: successfulAttemptData.data?.approved });
        }
      }
    }]
  })
  
  .addPhase('legal-approval', {
    requests: [{
      id: 'legal',
      requestOptions: {
        reqData: { hostname: 'api.example.com', path: '/approvals/legal' },
        resReq: true,
        handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
          commonBuffer.approvals.push({ role: 'legal', approved: successfulAttemptData.data?.approved });
        }
      }
    }]
  })
  
  .addMergePoint('sync-approvals', ['manager-approval', 'finance-approval', 'legal-approval'])
  
  .addConditional('check-approvals', ({ sharedBuffer }) => {
    const allApproved = sharedBuffer?.approvals?.every((a: any) => a.approved);
    return allApproved ? 'finalize-approved' : 'handle-rejection';
  })
  
  .addPhase('finalize-approved', {
    requests: [{
      id: 'finalize',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/requests/finalize', method: 'POST' } }
    }]
  })
  
  .addPhase('handle-rejection', {
    functions: [{
      id: 'notify-rejection',
      functionOptions: {
        fn: (buffer: any) => {
          console.log('Request rejected:', buffer.approvals);
          return { rejected: true };
        },
        args: [sharedBuffer],
        returnResult: true
      }
    }]
  })
  
  .connectSequence('submit-request', 'parallel-approvals', 'sync-approvals', 'check-approvals')
  .setEntryPoint('submit-request')
  .addExitPoint('finalize-approved')
  .addExitPoint('handle-rejection');

const graph = builder.build();

const result = await stableWorkflowGraph(graph, {
  workflowId: 'approval-workflow',
  sharedBuffer,
  logPhaseResults: true
});

console.log(`Approval workflow: ${result.success ? 'Completed' : 'Failed'}`);
```

### Use Case 3: Adaptive Processing Pipeline

```typescript
import { WorkflowGraphBuilder, stableWorkflowGraph, WorkflowEdgeConditionTypes } from '@emmvish/stable-infra';

const builder = new WorkflowGraphBuilder();
const sharedBuffer: Record<string, any> = {};

builder
  .addPhase('analyze-data', {
    requests: [{
      id: 'analyze',
      requestOptions: {
        reqData: { hostname: 'api.example.com', path: '/analyze' },
        resReq: true,
        handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }) => {
          commonBuffer.dataType = successfulAttemptData.data?.type;
          commonBuffer.complexity = successfulAttemptData.data?.complexity;
        }
      }
    }]
  })
  
  .addConditional('route-by-type', ({ sharedBuffer }) => {
    const type = sharedBuffer?.dataType;
    if (type === 'image') return 'process-image';
    if (type === 'video') return 'process-video';
    if (type === 'text') return 'process-text';
    return 'process-generic';
  })
  
  .addPhase('process-image', {
    functions: [{
      id: 'image-processing',
      functionOptions: {
        fn: () => ({ processed: true, type: 'image' }),
        args: [],
        returnResult: true
      }
    }]
  })
  
  .addPhase('process-video', {
    functions: [{
      id: 'video-processing',
      functionOptions: {
        fn: () => ({ processed: true, type: 'video' }),
        args: [],
        returnResult: true
      }
    }]
  })
  
  .addPhase('process-text', {
    functions: [{
      id: 'text-processing',
      functionOptions: {
        fn: () => ({ processed: true, type: 'text' }),
        args: [],
        returnResult: true
      }
    }]
  })
  
  .addPhase('process-generic', {
    functions: [{
      id: 'generic-processing',
      functionOptions: {
        fn: () => ({ processed: true, type: 'generic' }),
        args: [],
        returnResult: true
      }
    }]
  })
  
  .addMergePoint('processing-complete', ['process-image', 'process-video', 'process-text', 'process-generic'])
  
  .addConditional('route-by-complexity', ({ sharedBuffer }) => {
    const complexity = sharedBuffer?.complexity;
    return complexity === 'high' ? 'advanced-optimization' : 'basic-optimization';
  })
  
  .addPhase('advanced-optimization', {
    functions: [{
      id: 'advanced',
      functionOptions: {
        fn: () => console.log('Advanced optimization'),
        args: [],
        returnResult: true
      }
    }]
  })
  
  .addPhase('basic-optimization', {
    functions: [{
      id: 'basic',
      functionOptions: {
        fn: () => console.log('Basic optimization'),
        args: [],
        returnResult: true
      }
    }]
  })
  
  .addMergePoint('optimization-complete', ['advanced-optimization', 'basic-optimization'])
  
  .addPhase('finalize', {
    requests: [{
      id: 'save',
      requestOptions: { reqData: { hostname: 'api.example.com', path: '/save', method: 'POST' } }
    }]
  })
  
  .connect('analyze-data', 'route-by-type')
  .connect('processing-complete', 'route-by-complexity')
  .connect('optimization-complete', 'finalize')
  .setEntryPoint('analyze-data')
  .addExitPoint('finalize');

const graph = builder.build();

const result = await stableWorkflowGraph(graph, {
  workflowId: 'adaptive-pipeline',
  sharedBuffer,
  logPhaseResults: true
});
```

---

## Best Practices

1. **Always Set Entry Point** before building
   ```typescript
   builder.setEntryPoint('start-node');
   ```

2. **Define Exit Points** for clarity
   ```typescript
   builder.addExitPoint('success-end')
          .addExitPoint('error-end');
   ```

3. **Use Descriptive Node IDs** for debugging
   ```typescript
   builder.addPhase('fetch-user-data', { ... });  // Good
   builder.addPhase('node1', { ... });            // Bad
   ```

4. **Leverage Edge Conditions** for control flow
   ```typescript
   builder.connect('validation', 'process', {
     condition: { type: WorkflowEdgeConditionTypes.SUCCESS }
   });
   ```

5. **Use Conditional Nodes** for complex routing
   ```typescript
   builder.addConditional('route', ({ results, sharedBuffer }) => {
     // Dynamic routing logic
     return determineNextNode(results, sharedBuffer);
   });
   ```

6. **Add Merge Points** after parallel execution
   ```typescript
   builder.addParallelGroup('parallel', ['a', 'b', 'c'])
          .addMergePoint('sync', ['a', 'b', 'c'])
          .connect('parallel', 'sync');
   ```

7. **Validate Graphs** before production
   ```typescript
   await stableWorkflowGraph(graph, {
     validateGraph: true  // Default, catches errors early
   });
   ```

8. **Use Shared Buffer** for inter-node communication
   ```typescript
   const sharedBuffer: Record<string, any> = {};
   // Nodes can read/write to sharedBuffer
   ```

9. **Set maxWorkflowIterations** when allowing cycles
   ```typescript
   builder.setEnforceDAG(false);  // Allow cycles
   await stableWorkflowGraph(graph, {
     maxWorkflowIterations: 100  // Prevent infinite loops
   });
   ```

10. **Log Phase Results** during development
    ```typescript
    await stableWorkflowGraph(graph, {
      logPhaseResults: true
    });
    ```

11. **Use Metadata** for documentation
    ```typescript
    builder.setMetadata({
      version: '1.0.0',
      description: 'User onboarding workflow',
      author: 'team@example.com'
    });
    ```

12. **Prefer connectSequence** for linear flows
    ```typescript
    builder.connectSequence('a', 'b', 'c', 'd');
    // Instead of multiple .connect() calls
    ```

13. **Configure Metrics Guardrails** for validation
    ```typescript
    const result = await stableWorkflowGraph(graph, {
      metricsGuardrails: {
        workflow: {
          phaseCompletionRate: { min: 90 },
          requestSuccessRate: { min: 95 }
        }
      }
    });
    ```

---

## Metrics Guardrails and Validation

Workflow graphs support the same comprehensive metrics validation as `stableWorkflow`, allowing you to define guardrails at both workflow and phase levels.

### Workflow-Level Guardrails

Configure guardrails for overall graph execution metrics:

```typescript
const graph = new WorkflowGraphBuilder()
  .addPhase('fetch', { id: 'fetch', requests: [...] })
  .addPhase('process', { id: 'process', requests: [...] })
  .connectSequence('fetch', 'process')
  .setEntryPoint('fetch')
  .build();

const result = await stableWorkflowGraph(graph, {
  workflowId: 'data-pipeline',
  metricsGuardrails: {
    workflow: {
      phaseCompletionRate: { min: 100 },
      requestSuccessRate: { min: 95 },
      executionTime: { max: 30000 }
    }
  }
});

if (result.validation && !result.validation.isValid) {
  console.error('Graph validation failed:', result.validation.anomalies);
}
```

### Phase-Level Guardrails in Graph Nodes

Each PHASE node can have its own metrics guardrails:

```typescript
const graph = new WorkflowGraphBuilder()
  .addPhase('critical-validation', {
    id: 'critical-validation',
    requests: [...],
    metricsGuardrails: {
      phase: {
        requestSuccessRate: { min: 100 },  // Must succeed 100%
        executionTime: { max: 5000 },
        failedRequests: { max: 0 }
      }
    }
  })
  .addPhase('best-effort-processing', {
    id: 'best-effort-processing',
    requests: [...],
    metricsGuardrails: {
      phase: {
        requestSuccessRate: { min: 80 },  // More lenient
        executionTime: { max: 10000 }
      }
    }
  })
  .connectSequence('critical-validation', 'best-effort-processing')
  .setEntryPoint('critical-validation')
  .build();

const result = await stableWorkflowGraph(graph);

// Check phase-level validation
result.phases?.forEach(phase => {
  if (phase.validation && !phase.validation.isValid) {
    console.error(`Phase ${phase.phaseId} failed validation:`,
      phase.validation.anomalies);
  }
});
```

### Validation in Complex Graphs

Validation works seamlessly with all graph features:

**Parallel Branches:**
```typescript
const graph = new WorkflowGraphBuilder()
  .addPhase('start', { id: 'start', requests: [...] })
  .addPhase('branch-a', {
    id: 'branch-a',
    requests: [...],
    metricsGuardrails: {
      phase: { executionTime: { max: 5000 } }
    }
  })
  .addPhase('branch-b', {
    id: 'branch-b',
    requests: [...],
    metricsGuardrails: {
      phase: { executionTime: { max: 5000 } }
    }
  })
  .addPhase('merge', { id: 'merge', requests: [...] })
  .connectToMany('start', ['branch-a', 'branch-b'])
  .connectManyTo(['branch-a', 'branch-b'], 'merge')
  .setEntryPoint('start')
  .build();

const result = await stableWorkflowGraph(graph, {
  metricsGuardrails: {
    workflow: {
      phaseCompletionRate: { min: 100 }  // All branches must complete
    }
  }
});
```

**Conditional Paths:**
```typescript
const graph = new WorkflowGraphBuilder()
  .addPhase('check', { id: 'check', requests: [...] })
  .addPhase('path-a', {
    id: 'path-a',
    requests: [...],
    metricsGuardrails: {
      phase: { requestSuccessRate: { min: 90 } }
    }
  })
  .addPhase('path-b', {
    id: 'path-b',
    requests: [...],
    metricsGuardrails: {
      phase: { requestSuccessRate: { min: 90 } }
    }
  })
  .connect('check', 'path-a', {
    condition: {
      type: WorkflowEdgeConditionTypes.CUSTOM,
      evaluate: (context) => {
        const result = context.results.get('check');
        return result?.responses?.[0]?.data?.value > 50;
      }
    }
  })
  .connect('check', 'path-b', {
    condition: {
      type: WorkflowEdgeConditionTypes.CUSTOM,
      evaluate: (context) => {
        const result = context.results.get('check');
        return result?.responses?.[0]?.data?.value <= 50;
      }
    }
  })
  .setEntryPoint('check')
  .build();

const result = await stableWorkflowGraph(graph, {
  metricsGuardrails: {
    workflow: {
      completedPhases: { min: 2 }  // Check + one conditional path
    }
  }
});
```

### Available Metrics

Same metrics as `stableWorkflow`:

**Workflow-Level:**
- `phaseCompletionRate`, `requestSuccessRate`, `executionTime`
- `totalPhases`, `completedPhases`, `failedPhases`
- `totalRequests`, `successfulRequests`, `failedRequests`
- `averagePhaseExecutionTime`

**Phase-Level:**
- `requestSuccessRate`, `executionTime`
- `totalRequests`, `successfulRequests`, `failedRequests`

### Use Cases

1. **Graph Execution Validation**: Ensure all nodes execute successfully
   ```typescript
   metricsGuardrails: {
     workflow: {
       phaseCompletionRate: { min: 100 },
       requestSuccessRate: { min: 100 }
     }
   }
   ```

2. **Critical Path Monitoring**: Strict validation on critical nodes
   ```typescript
   {
     id: 'payment-processing',
     requests: [...],
     metricsGuardrails: {
       phase: {
         requestSuccessRate: { min: 100 },
         executionTime: { max: 3000 }
       }
     }
   }
   ```

3. **Parallel Branch SLAs**: Ensure all parallel paths meet requirements
   ```typescript
   // Each parallel branch with same guardrails
   metricsGuardrails: {
     phase: {
       executionTime: { max: 5000 },
       requestSuccessRate: { min: 95 }
     }
   }
   ```

4. **Complex Workflow Validation**: Multi-level validation
   ```typescript
   const result = await stableWorkflowGraph(graph, {
     metricsGuardrails: {
       workflow: {
         executionTime: { max: 60000 },
         phaseCompletionRate: { min: 90 }
       }
     }
   });
   
   // Workflow-level check
   if (result.validation && !result.validation.isValid) {
     // Handle workflow-level violations
   }
   
   // Phase-level checks
   result.phases?.forEach(phase => {
     if (phase.validation && !phase.validation.isValid) {
       // Handle phase-level violations
     }
   });
   ```

For detailed information on the validation result structure, severity levels, and guardrail configuration options, see the [stable-workflow documentation](./stable-workflow.md#metrics-guardrails-and-validation).

---

## Support

For issues, questions, or contributions:

- **GitHub**: [https://github.com/emmvish/stable-infra](https://github.com/emmvish/stable-infra)
- **NPM**: [https://www.npmjs.com/package/@emmvish/stable-infra](https://www.npmjs.com/package/@emmvish/stable-infra)
- **Issues**: [https://github.com/emmvish/stable-infra/issues](https://github.com/emmvish/stable-infra/issues)
