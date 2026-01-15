import { WorkflowNodeTypes } from '../enums/index.js'
import {
  WorkflowGraph,
  WorkflowGraphValidationResult,
  WorkflowNode
} from '../types/index.js';

export function validateWorkflowGraph<T = any, R = any>(
  graph: WorkflowGraph<T, R>
): WorkflowGraphValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!graph.entryPoint) {
    errors.push('Graph must have an entry point');
  } else if (!graph.nodes.has(graph.entryPoint)) {
    errors.push(`Entry point '${graph.entryPoint}' does not exist in graph nodes`);
  }
  
  if (graph.exitPoints) {
    for (const exitPoint of graph.exitPoints) {
      if (!graph.nodes.has(exitPoint)) {
        errors.push(`Exit point '${exitPoint}' does not exist in graph nodes`);
      }
    }
  }
  
  for (const [fromId, edges] of graph.edges) {
    if (!graph.nodes.has(fromId)) {
      errors.push(`Edge source node '${fromId}' does not exist in graph`);
    }
    
    for (const edge of edges) {
      if (!graph.nodes.has(edge.to)) {
        errors.push(`Edge target node '${edge.to}' (from '${fromId}') does not exist in graph`);
      }
    }
  }
  
  for (const [nodeId, node] of graph.nodes) {
    const nodeErrors = validateNode(node, graph);
    errors.push(...nodeErrors);
  }
  
  const cycles = detectCycles(graph);
  if (cycles.length > 0) {
    errors.push(`Graph contains ${cycles.length} cycle(s), violating DAG constraints. Cycles: ${cycles.map(c => c.join(' → ')).join('; ')}`);
  }
  
  const unreachableNodes = detectUnreachableNodes(graph);
  if (unreachableNodes.length > 0) {
    warnings.push(`Found ${unreachableNodes.length} unreachable node(s): ${unreachableNodes.join(', ')}`);
  }
  
  const orphanNodes = detectOrphanNodes(graph);
  if (orphanNodes.length > 0) {
    warnings.push(`Found ${orphanNodes.length} orphan node(s) with no connections: ${orphanNodes.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    cycles: cycles.length > 0 ? cycles : undefined,
    unreachableNodes: unreachableNodes.length > 0 ? unreachableNodes : undefined,
    orphanNodes: orphanNodes.length > 0 ? orphanNodes : undefined
  };
}

function validateNode<T, R>(node: WorkflowNode<T, R>, graph: WorkflowGraph<T, R>): string[] {
  const errors: string[] = [];
  
  switch (node.type) {
    case WorkflowNodeTypes.PHASE:
      if (!node.phase) {
        errors.push(`Phase node '${node.id}' is missing phase configuration`);
      } else if (!node.phase.requests || node.phase.requests.length === 0) {
        errors.push(`Phase node '${node.id}' has no requests`);
      }
      break;
      
    case WorkflowNodeTypes.BRANCH:
      if (!node.branch) {
        errors.push(`Branch node '${node.id}' is missing branch configuration`);
      } else if (!node.branch.phases || node.branch.phases.length === 0) {
        errors.push(`Branch node '${node.id}' has no phases`);
      }
      break;
      
    case WorkflowNodeTypes.CONDITIONAL:
      if (!node.condition || typeof node.condition.evaluate !== 'function') {
        errors.push(`Conditional node '${node.id}' is missing evaluation function`);
      }
      break;
      
    case WorkflowNodeTypes.PARALLEL_GROUP:
      if (!node.parallelNodes || node.parallelNodes.length === 0) {
        errors.push(`Parallel group node '${node.id}' has no parallel nodes specified`);
      } else {
        for (const parallelNodeId of node.parallelNodes) {
          if (!graph.nodes.has(parallelNodeId)) {
            errors.push(`Parallel group node '${node.id}' references non-existent node '${parallelNodeId}'`);
          }
        }
      }
      break;
      
    case WorkflowNodeTypes.MERGE_POINT:
      if (!node.waitForNodes || node.waitForNodes.length === 0) {
        errors.push(`Merge point node '${node.id}' has no nodes to wait for`);
      } else {
        for (const waitForNodeId of node.waitForNodes) {
          if (!graph.nodes.has(waitForNodeId)) {
            errors.push(`Merge point node '${node.id}' references non-existent node '${waitForNodeId}'`);
          }
        }
      }
      break;
  }
  
  return errors;
}

export function detectCycles<T = any, R = any>(
  graph: WorkflowGraph<T, R>
): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const currentPath: string[] = [];
  
  function dfs(nodeId: string): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    currentPath.push(nodeId);
    
    const edges = graph.edges.get(nodeId) || [];
    
    for (const edge of edges) {
      const targetId = edge.to;
      
      if (!visited.has(targetId)) {
        dfs(targetId);
      } else if (recursionStack.has(targetId)) {
        const cycleStartIndex = currentPath.indexOf(targetId);
        const cycle = currentPath.slice(cycleStartIndex);
        cycle.push(targetId);
        cycles.push(cycle);
      }
    }
    
    currentPath.pop();
    recursionStack.delete(nodeId);
  }
  
  if (graph.entryPoint && graph.nodes.has(graph.entryPoint)) {
    dfs(graph.entryPoint);
  }
  
  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  }
  
  return cycles;
}

/**
 * Detect nodes that cannot be reached from the entry point
 */
export function detectUnreachableNodes<T = any, R = any>(
  graph: WorkflowGraph<T, R>
): string[] {
  if (!graph.entryPoint) {
    return Array.from(graph.nodes.keys());
  }
  
  const reachable = new Set<string>();
  const queue: string[] = [graph.entryPoint];
  
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    
    if (reachable.has(nodeId)) {
      continue;
    }
    
    reachable.add(nodeId);
    
    const node = graph.nodes.get(nodeId);
    if (!node) continue;
    
    const edges = graph.edges.get(nodeId) || [];
    for (const edge of edges) {
      if (!reachable.has(edge.to)) {
        queue.push(edge.to);
      }
    }
    
    if (node.type === WorkflowNodeTypes.PARALLEL_GROUP && node.parallelNodes) {
      for (const parallelNodeId of node.parallelNodes) {
        if (!reachable.has(parallelNodeId)) {
          queue.push(parallelNodeId);
        }
      }
    }
    
    if (node.type === WorkflowNodeTypes.MERGE_POINT && node.waitForNodes) {
      for (const waitForNodeId of node.waitForNodes) {
        if (!reachable.has(waitForNodeId)) {
          queue.push(waitForNodeId);
        }
      }
    }
  }
  
  const unreachable: string[] = [];
  for (const nodeId of graph.nodes.keys()) {
    if (!reachable.has(nodeId)) {
      unreachable.push(nodeId);
    }
  }
  
  return unreachable;
}

export function detectOrphanNodes<T = any, R = any>(
  graph: WorkflowGraph<T, R>
): string[] {
  const hasOutgoing = new Set<string>();
  const hasIncoming = new Set<string>();
  
  for (const [fromId, edges] of graph.edges) {
    if (edges.length > 0) {
      hasOutgoing.add(fromId);
    }
    
    for (const edge of edges) {
      hasIncoming.add(edge.to);
    }
  }
  
  const orphans: string[] = [];
  
  for (const nodeId of graph.nodes.keys()) {
    if (nodeId === graph.entryPoint) {
      continue;
    }
    
    if (graph.exitPoints && graph.exitPoints.includes(nodeId)) {
      continue;
    }
    
    if (!hasOutgoing.has(nodeId) && !hasIncoming.has(nodeId)) {
      orphans.push(nodeId);
    }
  }
  
  return orphans;
}

export function calculateGraphDepth<T = any, R = any>(
  graph: WorkflowGraph<T, R>
): number {
  if (!graph.entryPoint) {
    return 0;
  }
  
  const depths = new Map<string, number>();
  const visited = new Set<string>();
  
  function dfs(nodeId: string, depth: number): number {
    if (visited.has(nodeId)) {
      return depths.get(nodeId) || 0;
    }
    
    visited.add(nodeId);
    depths.set(nodeId, depth);
    
    const edges = graph.edges.get(nodeId) || [];
    let maxDepth = depth;
    
    for (const edge of edges) {
      const childDepth = dfs(edge.to, depth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }
    
    return maxDepth;
  }
  
  return dfs(graph.entryPoint, 0);
}
