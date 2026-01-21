import { WorkflowNodeTypes, WorkflowEdgeConditionTypes } from '../enums/index.js'
import {
  WorkflowGraph,
  WorkflowGraphOptions,
  STABLE_WORKFLOW_RESULT,
  STABLE_WORKFLOW_PHASE_RESULT,
  WorkflowNode,
  PhaseExecutionRecord,
} from '../types/index.js';
import { 
  validateWorkflowGraph,
  detectUnreachableNodes,
  detectOrphanNodes,
  calculateGraphDepth
} from './validate-workflow-graph.js';
import { executePhase } from './execute-phase.js';
import { executeBranchWorkflow } from './execute-branch-workflow.js';
import { formatLogContext } from './format-log-context.js';
import { safelyStringify } from './safely-stringify.js';
import { MetricsAggregator } from './metrics-aggregator.js';
import { executeWithPersistence } from './execute-with-persistence.js';
import { MetricsValidator } from './metrics-validator.js';

export async function executeWorkflowGraph<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
  graph: WorkflowGraph<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>,
  options: WorkflowGraphOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
): Promise<STABLE_WORKFLOW_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>> {
  const workflowId = options.workflowId || `workflow-graph-${Date.now()}`;

  if (options.maxTimeout) {
    const timeoutPromise = new Promise<STABLE_WORKFLOW_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>>((_, reject) => {
      setTimeout(() => {
        const contextStr = `workflowId=${workflowId}`;
        reject(new Error(`stable-request: Workflow graph execution exceeded maxTimeout of ${options.maxTimeout}ms [${contextStr}]`));
      }, options.maxTimeout);
    });

    const executionPromise = executeWorkflowGraphInternal(graph, options, workflowId);
    return Promise.race([executionPromise, timeoutPromise]);
  }

  return executeWorkflowGraphInternal(graph, options, workflowId);
}

async function executeWorkflowGraphInternal<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
  graph: WorkflowGraph<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>,
  options: WorkflowGraphOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>,
  workflowId: string
): Promise<STABLE_WORKFLOW_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>> {
  const startTime = Date.now();

  const removeNodes = (nodeIds: string[]) => {
    if (nodeIds.length === 0) {
      return;
    }

    for (const nodeId of nodeIds) {
      graph.nodes.delete(nodeId);
      graph.edges.delete(nodeId);
    }

    for (const [fromId, edges] of graph.edges) {
      graph.edges.set(
        fromId,
        edges.filter(edge => !nodeIds.includes(edge.to))
      );
    }
  };
  
  if (options.validateGraph !== false) {
    const validation = validateWorkflowGraph(graph);
    if (!validation.valid) {
      throw new Error(`Invalid workflow graph:\n${validation.errors.join('\n')}`);
    }
    
    if (validation.warnings.length > 0 && options.logPhaseResults) {
      console.warn(`${formatLogContext({ workflowId })}stable-request: Workflow graph warnings:\n${validation.errors.join('\n')}`);
    }
  }

  if (options.optimizeExecution) {
    const unreachableNodes = detectUnreachableNodes(graph);
    const orphanNodes = detectOrphanNodes(graph);
    const nodesToRemove = Array.from(new Set([...unreachableNodes, ...orphanNodes]));

    if (nodesToRemove.length > 0 && options.logPhaseResults) {
      console.info(
        `${formatLogContext({ workflowId })}stable-request: Optimizing graph by removing nodes: ${nodesToRemove.join(', ')}`
      );
    }

    removeNodes(nodesToRemove);
  }

  if (options.maxGraphDepth !== undefined) {
    const depth = calculateGraphDepth(graph);
    if (depth > options.maxGraphDepth) {
      throw new Error(
        `${formatLogContext({ workflowId })}stable-request: Workflow graph depth ${depth} exceeds maxGraphDepth of ${options.maxGraphDepth}`
      );
    }
  }
  
  const results = new Map<string, STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType>>();
  const visited = new Set<string>();
  const executionHistory: PhaseExecutionRecord<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[] = [];
  const phaseResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType>[] = [];
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
      throw new Error(`${formatLogContext({ workflowId })}Node '${nodeId}' not found in graph`);
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
  
  const executePhaseNode = async (node: WorkflowNode<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>, nodeId: string): Promise<void> => {
    if (!node.phase) {
      throw new Error(`${formatLogContext({ workflowId })}Phase node '${nodeId}' has no phase configuration`);
    }
    
    const phaseIndex = phaseResults.length;
    const phaseId = node.phase.id || nodeId;
    let executionNumber = 1;
    let shouldReplay = false;
    
    do {
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
        
        const executionRecord: PhaseExecutionRecord<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> = {
          phaseId,
          phaseIndex,
          executionNumber,
          timestamp: phaseResult.timestamp,
          success: phaseResult.success,
          executionTime: phaseResult.executionTime
        };
        
        shouldReplay = false;
        if (node.phaseDecisionHook) {
          const decision = await executeWithPersistence(
            node.phaseDecisionHook,
            {
              workflowId,
              phaseResult,
              phaseId,
              phaseIndex,
              executionHistory,
              sharedBuffer,
              params: options.workflowHookParams?.handlePhaseDecisionParams
            },
            options.statePersistence,
            { workflowId, phaseId },
            sharedBuffer
          );
          
          executionRecord.decision = decision;
          
          if (decision.action === 'replay') {
            shouldReplay = true;
            executionNumber++;
            
            if (options.logPhaseResults) {
              console.info(`${formatLogContext({ workflowId, phaseId })}stable-request: Phase decision - REPLAY (execution ${executionNumber})`);
            }
          } else if (decision.action === 'terminate') {
            terminatedEarly = true;
            terminationReason = decision.reason || 'Phase decision hook requested termination';
            
            if (options.logPhaseResults) {
              console.info(`${formatLogContext({ workflowId, phaseId })}stable-request: Phase decision - TERMINATE: ${terminationReason}`);
            }
          }
        }
        
        executionHistory.push(executionRecord);
        
        if (options.logPhaseResults) {
          const logContext = formatLogContext({
            workflowId,
            phaseId
          });
          console.info(`${logContext}stable-request: Phase completed - Success: ${phaseResult.success}, Requests: ${phaseResult.totalRequests}`);
          console.info(`${logContext}stable-request: ${safelyStringify(phaseResult, options.maxSerializableChars || 1000)}`);
        }
        
        if (options.handlePhaseCompletion) {
          await executeWithPersistence(
            options.handlePhaseCompletion,
            {
              phaseResult,
              phaseId,
              phaseIndex,
              workflowId,
              sharedBuffer,
              params: options.workflowHookParams?.handlePhaseCompletionParams
            },
            options.statePersistence,
            { workflowId, phaseId },
            sharedBuffer
          );
        }
      
        if (!phaseResult.success && options.stopOnFirstPhaseError) {
          terminatedEarly = true;
          terminationReason = `Phase '${phaseId}' failed`;
          shouldReplay = false;
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
        
        terminatedEarly = true;
        terminationReason = error.message || `${formatLogContext({ workflowId })}stable-request: Unknown error during execution`;
        shouldReplay = false;
      }
    } while (shouldReplay && !terminatedEarly);
  };
  
  const executeBranchNode = async (node: WorkflowNode<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>, nodeId: string): Promise<void> => {
    if (!node.branch) {
      throw new Error(`${formatLogContext({ workflowId })}Branch node '${nodeId}' has no branch configuration`);
    }
    
    const branchResult = await executeBranchWorkflow<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>({
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
      
      const branchPhaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType> = {
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
  
  const executeConditionalNode = async (node: WorkflowNode<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>, nodeId: string): Promise<void> => {
    if (!node.condition) {
      throw new Error(`${formatLogContext({ workflowId })}Conditional node '${nodeId}' has no condition`);
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
      throw new Error(`${formatLogContext({ workflowId })}Conditional node '${nodeId}' evaluated to non-existent node '${nextNodeId}'`);
    }
  };
  
  const executeParallelGroupNode = async (node: WorkflowNode<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>, nodeId: string): Promise<void> => {
    if (!node.parallelNodes || node.parallelNodes.length === 0) {
      throw new Error(`${formatLogContext({ workflowId })}Parallel group node '${nodeId}' has no parallel nodes`);
    }
    
    const allBranchNodes = node.parallelNodes.every(parallelNodeId => {
      const parallelNode = graph.nodes.get(parallelNodeId);
      return parallelNode?.type === WorkflowNodeTypes.BRANCH;
    });
    
    if (options.enableBranchRacing && allBranchNodes && node.parallelNodes.length > 1) {
      if (options.logPhaseResults) {
        console.info(`${formatLogContext({ workflowId })}stable-request: Starting branch racing with ${node.parallelNodes.length} branches`);
      }
      
      const branchPromises = node.parallelNodes.map((parallelNodeId, index) => 
        executeNode(parallelNodeId)
          .then(() => ({ success: true as const, nodeId: parallelNodeId, index }))
          .catch(error => ({ success: false as const, nodeId: parallelNodeId, index, error }))
      );
      
      try {
        const winner = await Promise.race(branchPromises);
        
        if (options.logPhaseResults) {
          console.info(`${formatLogContext({ workflowId })}stable-request: Branch '${winner.nodeId}' won the race`);
        }
        
        for (let i = 0; i < node.parallelNodes.length; i++) {
          if (i !== winner.index) {
            const losingNodeId = node.parallelNodes[i];
            const losingNode = graph.nodes.get(losingNodeId);
            
            if (losingNode?.branch) {
              const cancelledBranchResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType> = {
                workflowId,
                branchId: losingNode.branch.id,
                phaseId: `branch-${losingNode.branch.id}`,
                phaseIndex: phaseResults.length,
                success: false,
                executionTime: 0,
                timestamp: new Date().toISOString(),
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                responses: [],
                skipped: true,
                error: 'stable-request: Cancelled - another branch won the race'
              };
              
              results.set(losingNodeId, cancelledBranchResult);
              phaseResults.push(cancelledBranchResult);
            }
          }
        }
        
        if (!winner.success) {
          console.error(
            `${formatLogContext({ workflowId })}stable-request: Winning branch '${winner.nodeId}' failed:`,
            winner.error
          );
          terminatedEarly = true;
          terminationReason = `Branch racing completed but winning branch failed: ${winner.error?.message || 'Unknown error'}`;
        }
      } catch (error: any) {
        console.error(
          `${formatLogContext({ workflowId })}stable-request: Error during branch racing:`,
          error
        );
        terminatedEarly = true;
        terminationReason = `Branch racing failed: ${error.message || 'Unknown error'}`;
      }
      
      return;
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
      terminationReason = error.message || `${formatLogContext({ workflowId })}stable-request: Unknown error during execution`;
    }
  }
  
  const executionTime = Date.now() - startTime;
  
  const result: STABLE_WORKFLOW_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType> = {
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
    
    if (options.metricsGuardrails && result.metrics) {
      result.validation = MetricsValidator.validateWorkflowMetrics(
        result.metrics,
        options.metricsGuardrails
      );
    }
  } catch (error) {
    
  }
  
  return result;
}
