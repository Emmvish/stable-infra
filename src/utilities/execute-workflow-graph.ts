import { WorkflowNodeTypes, WorkflowEdgeConditionTypes } from '../enums/index.js'
import {
  WorkflowGraph,
  WorkflowGraphOptions,
  STABLE_WORKFLOW_RESULT,
  STABLE_WORKFLOW_PHASE_RESULT,
  WorkflowNode,
  PhaseExecutionRecord,
} from '../types/index.js';
import { validateWorkflowGraph } from './validate-workflow-graph.js';
import { executePhase } from './execute-phase.js';
import { executeBranchWorkflow } from './execute-branch-workflow.js';
import { formatLogContext } from './format-log-context.js';
import { safelyStringify } from './safely-stringify.js';
import { MetricsAggregator } from './metrics-aggregator.js';
import { executeWithPersistence } from './execute-with-persistence.js';

export async function executeWorkflowGraph<RequestDataType = any, ResponseDataType = any>(
  graph: WorkflowGraph<RequestDataType, ResponseDataType>,
  options: WorkflowGraphOptions<RequestDataType, ResponseDataType>
): Promise<STABLE_WORKFLOW_RESULT<ResponseDataType>> {
  const startTime = Date.now();
  const workflowId = options.workflowId || `workflow-graph-${Date.now()}`;
  
  if (options.validateGraph !== false) {
    const validation = validateWorkflowGraph(graph);
    if (!validation.valid) {
      throw new Error(`Invalid workflow graph:\n${validation.errors.join('\n')}`);
    }
    
    if (validation.warnings.length > 0 && options.logPhaseResults) {
      console.warn(`${formatLogContext({ workflowId })}stable-request: Workflow graph warnings:\n${validation.errors.join('\n')}`);
    }
  }
  
  const results = new Map<string, STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>>();
  const visited = new Set<string>();
  const executionHistory: PhaseExecutionRecord[] = [];
  const phaseResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[] = [];
  const sharedBuffer = options.sharedBuffer || {};
  
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  let terminatedEarly = false;
  let terminationReason: string | undefined;
  
  const areDependenciesSatisfied = (nodeId: string, waitForNodes: string[]): boolean => {
    return waitForNodes.every(depId => visited.has(depId));
  };
  
  const executeNode = async (nodeId: string): Promise<void> => {
    if (visited.has(nodeId) || terminatedEarly) {
      return;
    }
    
    const node = graph.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node '${nodeId}' not found in graph`);
    }
    
    if (node.type === WorkflowNodeTypes.MERGE_POINT && node.waitForNodes) {
      if (!areDependenciesSatisfied(nodeId, node.waitForNodes)) {
        return;
      }
      visited.add(nodeId);
      
      if (options.logPhaseResults) {
        console.info(`${formatLogContext({ workflowId })}stable-request: Merge point '${nodeId}' synchronized (waited for: ${node.waitForNodes.join(', ')})`);
      }
      
      const edges = graph.edges.get(nodeId) || [];
      for (const edge of edges) {
        if (terminatedEarly) break;
        await executeNode(edge.to);
      }
      return;
    }
    
    switch (node.type) {
      case WorkflowNodeTypes.PHASE:
        await executePhaseNode(node, nodeId);
        break;
        
      case WorkflowNodeTypes.BRANCH:
        await executeBranchNode(node, nodeId);
        break;
        
      case WorkflowNodeTypes.CONDITIONAL:
        await executeConditionalNode(node, nodeId);
        return;
        
      case WorkflowNodeTypes.PARALLEL_GROUP:
        await executeParallelGroupNode(node, nodeId);
        break;
    }
    
    visited.add(nodeId);
    
    if (terminatedEarly) {
      return;
    }
    
    const edges = graph.edges.get(nodeId) || [];
    for (const edge of edges) {
      if (edge.condition) {
        let shouldTraverse = false;
        
        if (edge.condition.type === WorkflowEdgeConditionTypes.ALWAYS) {
          shouldTraverse = true;
        } else if (edge.condition.type === WorkflowEdgeConditionTypes.SUCCESS) {
          const result = results.get(nodeId);
          shouldTraverse = result?.success === true;
        } else if (edge.condition.type === WorkflowEdgeConditionTypes.FAILURE) {
          const result = results.get(nodeId);
          shouldTraverse = result?.success === false;
        } else if (edge.condition.type === WorkflowEdgeConditionTypes.CUSTOM && edge.condition.evaluate) {
          shouldTraverse = await edge.condition.evaluate({
            results,
            sharedBuffer,
            executionHistory,
            currentNodeId: nodeId
          });
        }
        
        if (!shouldTraverse) {
          continue;
        }
      }
      
      if (terminatedEarly) break;
      await executeNode(edge.to);
    }
  };
  
  const executePhaseNode = async (node: WorkflowNode<RequestDataType, ResponseDataType>, nodeId: string): Promise<void> => {
    if (!node.phase) {
      throw new Error(`Phase node '${nodeId}' has no phase configuration`);
    }
    
    const phaseIndex = phaseResults.length;
    const phaseId = node.phase.id || nodeId;
    
    try {
      let phase = node.phase;
      if (options.prePhaseExecutionHook) {
        phase = await executeWithPersistence(
          options.prePhaseExecutionHook,
          {
            phase,
            phaseId,
            phaseIndex,
            workflowId,
            sharedBuffer,
            params: options.workflowHookParams?.prePhaseExecutionHookParams
          },
          options.statePersistence,
          { workflowId, phaseId },
          sharedBuffer
        );
      }
      
      const phaseResult = await executePhase(
        phase,
        phaseIndex,
        workflowId,
        options,
        options.requestGroups || [],
        options.logPhaseResults || false,
        options.handlePhaseCompletion || (async () => {}),
        options.maxSerializableChars || 1000,
        options.workflowHookParams || {},
        sharedBuffer,
        undefined,
        options.prePhaseExecutionHook
      );
      
      results.set(nodeId, phaseResult);
      phaseResults.push(phaseResult);
      
      totalRequests += phaseResult.totalRequests;
      successfulRequests += phaseResult.successfulRequests;
      failedRequests += phaseResult.failedRequests;
      
      executionHistory.push({
        phaseId,
        phaseIndex,
        executionNumber: 1,
        timestamp: phaseResult.timestamp,
        success: phaseResult.success,
        executionTime: phaseResult.executionTime
      });
      
      if (options.logPhaseResults) {
        const logContext = formatLogContext({
          workflowId,
          phaseId
        });
        console.info(`${logContext}stable-request: Phase completed - Success: ${phaseResult.success}, Requests: ${phaseResult.totalRequests}`);
        console.info(`${logContext}stable-request: ${safelyStringify(phaseResult, options.maxSerializableChars || 1000)}`);
      }
      
      if (!phaseResult.success && options.stopOnFirstPhaseError) {
        terminatedEarly = true;
        terminationReason = `Phase '${phaseId}' failed`;
        return;
      }
      
    } catch (error: any) {
      const errorResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType> = {
        workflowId,
        phaseId,
        phaseIndex,
        success: false,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responses: [],
        error: error.message || 'Unknown error'
      };
      
      results.set(nodeId, errorResult);
      phaseResults.push(errorResult);
      
      if (options.stopOnFirstPhaseError) {
        terminatedEarly = true;
        terminationReason = `Phase '${phaseId}' threw error: ${error.message}`;
        throw error;
      }
    }
  };
  
  const executeBranchNode = async (node: WorkflowNode<RequestDataType, ResponseDataType>, nodeId: string): Promise<void> => {
    if (!node.branch) {
      throw new Error(`Branch node '${nodeId}' has no branch configuration`);
    }
    
    const branchResult = await executeBranchWorkflow({
      branches: [node.branch],
      workflowId,
      commonGatewayOptions: options,
      requestGroups: options.requestGroups || [],
      logPhaseResults: options.logPhaseResults || false,
      handlePhaseCompletion: options.handlePhaseCompletion || (async () => {}),
      handlePhaseError: options.handlePhaseError || (async () => {}),
      handleBranchCompletion: options.handleBranchCompletion,
      preBranchExecutionHook: options.preBranchExecutionHook,
      prePhaseExecutionHook: options.prePhaseExecutionHook,
      maxSerializableChars: options.maxSerializableChars || 1000,
      workflowHookParams: options.workflowHookParams || {},
      sharedBuffer,
      stopOnFirstPhaseError: options.stopOnFirstPhaseError || false,
      maxWorkflowIterations: options.maxWorkflowIterations || 1000
    });
    
    if (branchResult.branchResults.length > 0) {
      const branch = branchResult.branchResults[0];
      
      const branchPhaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType> = {
        workflowId,
        branchId: branch.branchId,
        phaseId: `branch-${branch.branchId}`,
        phaseIndex: phaseResults.length,
        success: branch.success,
        executionTime: branch.executionTime,
        timestamp: new Date().toISOString(),
        totalRequests: branchResult.totalRequests,
        successfulRequests: branchResult.successfulRequests,
        failedRequests: branchResult.failedRequests,
        responses: []
      };
      
      results.set(nodeId, branchPhaseResult);
      phaseResults.push(branchPhaseResult);
      
      totalRequests += branchResult.totalRequests;
      successfulRequests += branchResult.successfulRequests;
      failedRequests += branchResult.failedRequests;
      
      phaseResults.push(...branchResult.allPhaseResults);
    }
  };
  
  const executeConditionalNode = async (node: WorkflowNode<RequestDataType, ResponseDataType>, nodeId: string): Promise<void> => {
    if (!node.condition) {
      throw new Error(`Conditional node '${nodeId}' has no condition`);
    }
    
    visited.add(nodeId);
    
    const nextNodeId = await executeWithPersistence(
      node.condition.evaluate,
      {
        results,
        sharedBuffer,
        executionHistory,
        currentNodeId: nodeId
      },
      options.statePersistence,
      { workflowId, phaseId: nodeId },
      sharedBuffer
    );
    
    if (options.logPhaseResults) {
      console.info(`${formatLogContext({ workflowId, phaseId: nodeId })}stable-request: Conditional '${nodeId}' evaluated to: ${nextNodeId}`);
    }
    
    if (graph.nodes.has(nextNodeId)) {
      await executeNode(nextNodeId);
    } else {
      throw new Error(`Conditional node '${nodeId}' evaluated to non-existent node '${nextNodeId}'`);
    }
  };
  
  const executeParallelGroupNode = async (node: WorkflowNode<RequestDataType, ResponseDataType>, nodeId: string): Promise<void> => {
    if (!node.parallelNodes || node.parallelNodes.length === 0) {
      throw new Error(`Parallel group node '${nodeId}' has no parallel nodes`);
    }
    
    if (options.logPhaseResults) {
      console.info(`${formatLogContext({ workflowId })}stable-request: Starting parallel execution of: ${node.parallelNodes.join(', ')}`);
    }
    
    await Promise.all(
      node.parallelNodes.map(parallelNodeId => executeNode(parallelNodeId))
    );
    
    if (options.logPhaseResults) {
      console.info(`${formatLogContext({ workflowId })}stable-request: Parallel execution completed for: ${node.parallelNodes.join(', ')}`);
    }
  };
  
  try {
    await executeNode(graph.entryPoint);
  } catch (error: any) {
    if (!terminatedEarly) {
      terminatedEarly = true;
      terminationReason = error.message || 'Unknown error during execution';
    }
  }
  
  const executionTime = Date.now() - startTime;
  
  const result: STABLE_WORKFLOW_RESULT<ResponseDataType> = {
    workflowId,
    success: !terminatedEarly && failedRequests === 0,
    executionTime,
    timestamp: new Date().toISOString(),
    totalPhases: phaseResults.length,
    completedPhases: phaseResults.filter(p => p.success).length,
    totalRequests,
    successfulRequests,
    failedRequests,
    phases: phaseResults,
    executionHistory,
    terminatedEarly,
    terminationReason
  };
  
  try {
    result.metrics = MetricsAggregator.extractWorkflowMetrics(result);
  } catch (error) {
    
  }
  
  return result;
}
