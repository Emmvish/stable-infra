import { WorkflowNodeTypes } from '../enums/index.js'

import {
  WorkflowGraph,
  WorkflowNode,
  WorkflowEdge,
  EdgeCondition,
  STABLE_WORKFLOW_PHASE,
  STABLE_WORKFLOW_BRANCH,
  ConditionalEvaluationContext
} from '../types/index.js';

import { detectCycles } from './validate-workflow-graph.js';

export class WorkflowGraphBuilder<RequestDataType = any, ResponseDataType = any> {
  private nodes = new Map<string, WorkflowNode<RequestDataType, ResponseDataType>>();
  private edges = new Map<string, WorkflowEdge[]>();
  private entryPointId?: string;
  private exitPointIds: string[] = [];
  private metadata: Record<string, any> = {};
  private enforceDAG: boolean = true;

  addPhase(id: string, phase: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>): this {
    if (this.nodes.has(id)) {
      throw new Error(`Node with id '${id}' already exists`);
    }
    
    this.nodes.set(id, {
      id,
      type: WorkflowNodeTypes.PHASE,
      phase: { ...phase, id }
    });
    
    return this;
  }

  addBranch(id: string, branch: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType>): this {
    if (this.nodes.has(id)) {
      throw new Error(`Node with id '${id}' already exists`);
    }
    
    this.nodes.set(id, {
      id,
      type: WorkflowNodeTypes.BRANCH,
      branch: { ...branch, id }
    });
    
    return this;
  }

  addConditional(
    id: string,
    evaluate: (context: ConditionalEvaluationContext<ResponseDataType>) => string | Promise<string>
  ): this {
    if (this.nodes.has(id)) {
      throw new Error(`Node with id '${id}' already exists`);
    }
    
    this.nodes.set(id, {
      id,
      type: WorkflowNodeTypes.CONDITIONAL,
      condition: { evaluate }
    });
    
    return this;
  }

  addParallelGroup(id: string, nodeIds: string[]): this {
    if (this.nodes.has(id)) {
      throw new Error(`Node with id '${id}' already exists`);
    }
    
    if (nodeIds.length === 0) {
      throw new Error('Parallel group must have at least one node');
    }
    
    this.nodes.set(id, {
      id,
      type: WorkflowNodeTypes.PARALLEL_GROUP,
      parallelNodes: [...nodeIds]
    });
    
    return this;
  }

  addMergePoint(id: string, waitForNodes: string[]): this {
    if (this.nodes.has(id)) {
      throw new Error(`Node with id '${id}' already exists`);
    }
    
    if (waitForNodes.length === 0) {
      throw new Error('Merge point must wait for at least one node');
    }
    
    this.nodes.set(id, {
      id,
      type: WorkflowNodeTypes.MERGE_POINT,
      waitForNodes: [...waitForNodes]
    });
    
    return this;
  }

  connect(from: string, to: string, options?: {
    condition?: EdgeCondition;
    weight?: number;
    label?: string;
    metadata?: Record<string, any>;
  }): this {
    if (!this.edges.has(from)) {
      this.edges.set(from, []);
    }
    
    this.edges.get(from)!.push({
      from,
      to,
      condition: options?.condition,
      weight: options?.weight,
      label: options?.label,
      metadata: options?.metadata
    });
    
    return this;
  }

  connectSequence(...nodeIds: string[]): this {
    for (let i = 0; i < nodeIds.length - 1; i++) {
      this.connect(nodeIds[i], nodeIds[i + 1]);
    }
    return this;
  }

  connectToMany(from: string, toNodes: string[], condition?: EdgeCondition): this {
    for (const to of toNodes) {
      this.connect(from, to, { condition });
    }
    return this;
  }

  connectManyTo(fromNodes: string[], to: string, condition?: EdgeCondition): this {
    for (const from of fromNodes) {
      this.connect(from, to, { condition });
    }
    return this;
  }

  setEntryPoint(id: string): this {
    if (!this.nodes.has(id)) {
      throw new Error(`Entry point node '${id}' does not exist`);
    }
    this.entryPointId = id;
    return this;
  }

  addExitPoint(id: string): this {
    if (!this.nodes.has(id)) {
      throw new Error(`Exit point node '${id}' does not exist`);
    }
    if (!this.exitPointIds.includes(id)) {
      this.exitPointIds.push(id);
    }
    return this;
  }

  setMetadata(metadata: Record<string, any>): this {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  setEnforceDAG(enforce: boolean): this {
    this.enforceDAG = enforce;
    return this;
  }

  build(): WorkflowGraph<RequestDataType, ResponseDataType> {
    if (!this.entryPointId) {
      throw new Error('Entry point must be set before building the graph');
    }

    if (this.exitPointIds.length === 0) {
      this.exitPointIds = this.detectExitPoints();
    }

    const graph: WorkflowGraph<RequestDataType, ResponseDataType> = {
      nodes: new Map(this.nodes),
      edges: new Map(this.edges),
      entryPoint: this.entryPointId,
      exitPoints: this.exitPointIds.length > 0 ? [...this.exitPointIds] : undefined,
      metadata: { ...this.metadata }
    };

    if (this.enforceDAG) {
      const cycles = detectCycles(graph);
      if (cycles.length > 0) {
        const cycleDescriptions = cycles.map((cycle: string[]) => cycle.join(' → ')).join('; ');
        throw new Error(
          `Cannot build graph: DAG constraint violated. Found ${cycles.length} cycle(s): ${cycleDescriptions}. ` +
          `Cycles must be removed to ensure workflow can complete. Use builder.setEnforceDAG(false) to disable this check.`
        );
      }
    }

    return graph;
  }

  private detectExitPoints(): string[] {
    const exitPoints: string[] = [];
    
    for (const [nodeId] of this.nodes) {
      const outgoingEdges = this.edges.get(nodeId);
      if (!outgoingEdges || outgoingEdges.length === 0) {
        exitPoints.push(nodeId);
      }
    }
    
    return exitPoints;
  }

  clear(): this {
    this.nodes.clear();
    this.edges.clear();
    this.entryPointId = undefined;
    this.exitPointIds = [];
    this.metadata = {};
    return this;
  }

  getNodeCount(): number {
    return this.nodes.size;
  }

  getEdgeCount(): number {
    let count = 0;
    for (const edges of this.edges.values()) {
      count += edges.length;
    }
    return count;
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  removeNode(id: string): this {
    this.nodes.delete(id);
    this.edges.delete(id);
    
    for (const [nodeId, edges] of this.edges) {
      const filteredEdges = edges.filter(edge => edge.to !== id);
      if (filteredEdges.length === 0) {
        this.edges.delete(nodeId);
      } else {
        this.edges.set(nodeId, filteredEdges);
      }
    }
    
    this.exitPointIds = this.exitPointIds.filter(exitId => exitId !== id);
    
    return this;
  }

  removeEdge(from: string, to: string): this {
    const edges = this.edges.get(from);
    if (edges) {
      const filteredEdges = edges.filter(edge => edge.to !== to);
      if (filteredEdges.length === 0) {
        this.edges.delete(from);
      } else {
        this.edges.set(from, filteredEdges);
      }
    }
    return this;
  }
}

export function createLinearWorkflowGraph<T = any, R = any>(
  phases: STABLE_WORKFLOW_PHASE<T, R>[]
): WorkflowGraph<T, R> {
  const builder = new WorkflowGraphBuilder<T, R>();
  
  if (phases.length === 0) {
    throw new Error('Cannot create workflow from empty phases array');
  }
  
  phases.forEach((phase, index) => {
    const phaseId = phase.id || `phase-${index + 1}`;
    builder.addPhase(phaseId, phase);
  });
  
  const phaseIds = phases.map((p, i) => p.id || `phase-${i + 1}`);
  builder.connectSequence(...phaseIds);
  builder.setEntryPoint(phaseIds[0]);
  
  return builder.build();
}
