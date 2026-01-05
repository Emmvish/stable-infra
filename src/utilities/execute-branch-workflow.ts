import { executeNonLinearWorkflow } from './execute-non-linear-workflow.js';
import { safelyExecuteUnknownFunction } from './safely-execute-unknown-function.js';
import { PHASE_DECISION_ACTIONS } from '../enums/index.js';
import {
  STABLE_WORKFLOW_BRANCH,
  STABLE_WORKFLOW_PHASE_RESULT,
  EXECUTE_BRANCH_WORKFLOW_RESPONSE,
  BranchExecutionResult,
  BranchExecutionDecision,
  BranchWorkflowContext,
  PhaseExecutionRecord,
  BranchExecutionRecord
} from '../types/index.js';

export async function executeBranchWorkflow<RequestDataType = any, ResponseDataType = any>(
  context: BranchWorkflowContext<RequestDataType, ResponseDataType>
): Promise<EXECUTE_BRANCH_WORKFLOW_RESPONSE<ResponseDataType>> {
  const {
    branches,
    workflowId,
    commonGatewayOptions,
    requestGroups,
    logPhaseResults,
    handlePhaseCompletion,
    handlePhaseError = () => {},
    handleBranchCompletion,
    handleBranchDecision,
    maxSerializableChars,
    workflowHookParams,
    sharedBuffer,
    stopOnFirstPhaseError,
    maxWorkflowIterations
  } = context;

  const branchResults: BranchExecutionResult<ResponseDataType>[] = [];
  const allPhaseResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[] = [];
  const executionHistory: PhaseExecutionRecord[] = [];
  const branchExecutionHistory: BranchExecutionRecord[] = [];
  const branchExecutionCounts: Map<string, number> = new Map();
  
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  let terminatedEarly = false;
  let terminationReason: string | undefined;
  let iterationCount = 0;

  const mergeBranchConfig = (branch: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType>) => {
    if (!branch.commonConfig) {
      return commonGatewayOptions;
    }

    return {
      ...commonGatewayOptions,
      ...branch.commonConfig
    };
  };

  const executeSingleBranch = async (
    branch: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType>,
    branchIndex: number,
    executionNumber: number
  ) => {
    const branchStartTime = Date.now();
    
    try {
      const branchConfig = mergeBranchConfig(branch);
      
      const result = await executeNonLinearWorkflow({
        phases: branch.phases,
        workflowId: `${workflowId}-branch-${branch.id}`,
        commonGatewayOptions: branchConfig,
        requestGroups,
        logPhaseResults,
        handlePhaseCompletion,
        handlePhaseError,
        handlePhaseDecision: workflowHookParams?.handlePhaseDecision,
        maxSerializableChars,
        workflowHookParams,
        sharedBuffer,
        stopOnFirstPhaseError,
        maxWorkflowIterations
      });

      const branchExecutionTime = Date.now() - branchStartTime;

      const branchResult: BranchExecutionResult<ResponseDataType> = {
        branchId: branch.id,
        branchIndex,
        success: result.failedRequests === 0,
        executionTime: branchExecutionTime,
        completedPhases: result.phaseResults.length,
        phaseResults: result.phaseResults,
        executionNumber
      };

      return {
        branchResult,
        phaseResults: result.phaseResults,
        executionHistory: result.executionHistory,
        totalRequests: result.totalRequests,
        successfulRequests: result.successfulRequests,
        failedRequests: result.failedRequests
      };
    } catch (error: any) {
      console.error(
        `stable-request: [Workflow: ${workflowId}] Branch ${branch.id} failed:`,
        error
      );

      return {
        branchResult: {
          branchId: branch.id,
          branchIndex,
          success: false,
          executionTime: Date.now() - branchStartTime,
          completedPhases: 0,
          phaseResults: [],
          executionNumber,
          error: error?.message || 'Branch execution failed',
          decision: undefined
        },
        phaseResults: [],
        executionHistory: [],
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 1
      };
    }
  };

  let currentBranchId: string | null = branches[0]?.id || null;

  while (currentBranchId !== null && iterationCount < maxWorkflowIterations) {
    iterationCount++;

    const branchIndex = branches.findIndex(b => b.id === currentBranchId);
    if (branchIndex === -1) {
      console.error(
        `stable-request: [Workflow: ${workflowId}] Branch '${currentBranchId}' not found`
      );
      terminatedEarly = true;
      terminationReason = `Branch '${currentBranchId}' not found`;
      break;
    }

    const currentBranch = branches[branchIndex];
    const executionNumber = (branchExecutionCounts.get(currentBranchId) || 0) + 1;
    branchExecutionCounts.set(currentBranchId, executionNumber);

    const maxReplayCount = currentBranch.maxReplayCount ?? Infinity;
    if (executionNumber > maxReplayCount + 1) {
      if (logPhaseResults) {
        console.warn(
          `stable-request: [Workflow: ${workflowId}] Branch '${currentBranchId}' exceeded max replay count (${maxReplayCount}). Skipping.`
        );
      }

      const skippedResult: BranchExecutionResult<ResponseDataType> = {
        branchId: currentBranchId,
        branchIndex,
        success: false,
        executionTime: 0,
        completedPhases: 0,
        phaseResults: [],
        executionNumber,
        skipped: true,
        error: `Exceeded max replay count of ${maxReplayCount}`
      };

      branchResults.push(skippedResult);

      branchExecutionHistory.push({
        branchId: currentBranchId,
        branchIndex,
        executionNumber,
        timestamp: new Date().toISOString(),
        success: false,
        executionTime: 0
      });

      currentBranchId = branches[branchIndex + 1]?.id || null;
      continue;
    }

    const isConcurrent = currentBranch.markConcurrentBranch;
    
    if (isConcurrent) {
      const concurrentGroup: { 
        branch: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType>; 
        index: number;
        executionNumber: number;
      }[] = [
        { branch: currentBranch, index: branchIndex, executionNumber }
      ];
      
      let j = branchIndex + 1;
      while (j < branches.length && branches[j].markConcurrentBranch) {
        const concurrentBranch = branches[j];
        const concurrentExecNum = (branchExecutionCounts.get(concurrentBranch.id) || 0) + 1;
        branchExecutionCounts.set(concurrentBranch.id, concurrentExecNum);
        concurrentGroup.push({ branch: concurrentBranch, index: j, executionNumber: concurrentExecNum });
        j++;
      }

      if (logPhaseResults) {
        const branchIds = concurrentGroup.map(({ branch }) => branch.id).join(', ');
        console.info(
          `\nstable-request: [Workflow: ${workflowId}] Executing ${concurrentGroup.length} branches in parallel: [${branchIds}]`
        );
      }

      const groupPromises = concurrentGroup.map(({ branch, index, executionNumber }) => 
        executeSingleBranch(branch, index, executionNumber)
      );
      const groupResults = await Promise.all(groupPromises);

      const concurrentBranchResults: BranchExecutionResult<ResponseDataType>[] = [];
      let concurrentGroupJumpTarget: string | null = null;
      let concurrentGroupSkipTarget: string | null = null;
      let shouldTerminate = false;
      
      for (let k = 0; k < groupResults.length; k++) {
        const result = groupResults[k];
        const { branch, index, executionNumber } = concurrentGroup[k];
        
        concurrentBranchResults.push(result.branchResult);
        branchResults.push(result.branchResult);
        allPhaseResults.push(...result.phaseResults);
        executionHistory.push(...result.executionHistory);
        totalRequests += result.totalRequests;
        successfulRequests += result.successfulRequests;
        failedRequests += result.failedRequests;
        branchExecutionHistory.push({
          branchId: branch.id,
          branchIndex: index,
          executionNumber,
          timestamp: new Date().toISOString(),
          success: result.branchResult.success,
          executionTime: result.branchResult.executionTime
        });

        if (handleBranchCompletion) {
          try {
            await safelyExecuteUnknownFunction(
              handleBranchCompletion,
              {
                branchId: result.branchResult.branchId,
                branchResults: result.branchResult.phaseResults,
                success: result.branchResult.success
              }
            );
          } catch (hookError) {
            console.error(
              `stable-request: [Workflow: ${workflowId}] Error in handleBranchCompletion hook:`,
              hookError
            );
          }
        }

        if (branch.branchDecisionHook) {
          try {
            const decision: BranchExecutionDecision = await safelyExecuteUnknownFunction(
              branch.branchDecisionHook,
              {
                workflowId,
                branchResults: result.phaseResults,
                branchId: branch.id,
                branchIndex: index,
                executionNumber,
                executionHistory: result.executionHistory,
                branchExecutionHistory,
                sharedBuffer,
                params: workflowHookParams?.handleBranchDecisionParams,
                concurrentBranchResults: concurrentBranchResults
              }
            );

            result.branchResult.decision = decision;

            const historyRecord = branchExecutionHistory.find(
              h => h.branchId === branch.id && h.executionNumber === executionNumber
            );
            if (historyRecord) {
              historyRecord.decision = decision;
            }

            if (handleBranchDecision) {
              try {
                await safelyExecuteUnknownFunction(
                  handleBranchDecision,
                  decision,
                  result.branchResult
                );
              } catch (hookError) {
                console.error(
                  `stable-request: [Workflow: ${workflowId}] Error in handleBranchDecision hook:`,
                  hookError
                );
              }
            }

            if (k === groupResults.length - 1) {
              if (decision.action === PHASE_DECISION_ACTIONS.TERMINATE) {
                shouldTerminate = true;
                terminationReason = decision.metadata?.reason || `Branch ${branch.id} terminated workflow`;
              } else if (decision.action === PHASE_DECISION_ACTIONS.JUMP) {
                concurrentGroupJumpTarget = decision.targetBranchId || null;
              } else if (decision.action === PHASE_DECISION_ACTIONS.SKIP) {
                concurrentGroupSkipTarget = decision.targetBranchId || null;
              }

              if (logPhaseResults && decision.action !== PHASE_DECISION_ACTIONS.CONTINUE) {
                console.info(
                  `stable-request: [Workflow: ${workflowId}] Concurrent group decision: ${decision.action}`,
                  decision.targetBranchId ? `-> ${decision.targetBranchId}` : ''
                );
              }
            }
          } catch (decisionError) {
            console.error(
              `stable-request: [Workflow: ${workflowId}] Error in branch decision hook for ${branch.id}:`,
              decisionError
            );
          }
        }

        if (stopOnFirstPhaseError && result.failedRequests > 0) {
          shouldTerminate = true;
          terminationReason = `Branch ${branch.id} in concurrent group failed`;
          break;
        }
      }

      if (shouldTerminate) {
        terminatedEarly = true;
        break;
      }

      if (concurrentGroupJumpTarget) {
        currentBranchId = concurrentGroupJumpTarget;
      } else if (concurrentGroupSkipTarget) {
        const skipTargetIndex = branches.findIndex(b => b.id === concurrentGroupSkipTarget);
        if (skipTargetIndex !== -1) {
          for (let skipIdx = j; skipIdx < skipTargetIndex; skipIdx++) {
            const skippedBranch = branches[skipIdx];
            const skippedResult: BranchExecutionResult<ResponseDataType> = {
              branchId: skippedBranch.id,
              branchIndex: skipIdx,
              success: true,
              executionTime: 0,
              completedPhases: 0,
              phaseResults: [],
              executionNumber: 1,
              skipped: true
            };
            branchResults.push(skippedResult);

            branchExecutionHistory.push({
              branchId: skippedBranch.id,
              branchIndex: skipIdx,
              executionNumber: 1,
              timestamp: new Date().toISOString(),
              success: true,
              executionTime: 0,
              decision: { action: PHASE_DECISION_ACTIONS.SKIP }
            });
          }
          currentBranchId = concurrentGroupSkipTarget;
        } else {
          currentBranchId = branches[j]?.id || null;
        }
      } else {
        currentBranchId = branches[j]?.id || null;
      }

    } else {
      if (logPhaseResults) {
        console.info(
          `\nstable-request: [Workflow: ${workflowId}] Executing branch: ${currentBranch.id} (execution #${executionNumber})`
        );
      }

      const result = await executeSingleBranch(currentBranch, branchIndex, executionNumber);
      
      branchResults.push(result.branchResult);
      allPhaseResults.push(...result.phaseResults);
      executionHistory.push(...result.executionHistory);
      totalRequests += result.totalRequests;
      successfulRequests += result.successfulRequests;
      failedRequests += result.failedRequests;
      branchExecutionHistory.push({
        branchId: currentBranchId,
        branchIndex,
        executionNumber,
        timestamp: new Date().toISOString(),
        success: result.branchResult.success,
        executionTime: result.branchResult.executionTime
      });

      if (handleBranchCompletion) {
        try {
          await safelyExecuteUnknownFunction(
            handleBranchCompletion,
            {
              branchId: result.branchResult.branchId,
              branchResults: result.branchResult.phaseResults,
              success: result.branchResult.success
            }
          );
        } catch (hookError) {
          console.error(
            `stable-request: [Workflow: ${workflowId}] Error in handleBranchCompletion hook:`,
            hookError
          );
        }
      }

      let decision: BranchExecutionDecision = { action: PHASE_DECISION_ACTIONS.CONTINUE };

      if (currentBranch.branchDecisionHook) {
        try {
          decision = await safelyExecuteUnknownFunction(
            currentBranch.branchDecisionHook,
            {
              workflowId,
              branchResults: result.phaseResults,
              branchId: currentBranch.id,
              branchIndex,
              executionNumber,
              executionHistory: result.executionHistory,
              branchExecutionHistory,
              sharedBuffer,
              params: workflowHookParams?.handleBranchDecisionParams
            }
          );

          result.branchResult.decision = decision;

          const historyRecord = branchExecutionHistory.find(
            h => h.branchId === currentBranchId && h.executionNumber === executionNumber
          );
          if (historyRecord) {
            historyRecord.decision = decision;
          }

          if (logPhaseResults) {
            console.info(
              `stable-request: [Workflow: ${workflowId}] Branch '${currentBranchId}' decision: ${decision.action}`,
              decision.targetBranchId ? `-> ${decision.targetBranchId}` : ''
            );
          }

          if (handleBranchDecision) {
            try {
              await safelyExecuteUnknownFunction(
                handleBranchDecision,
                decision,
                result.branchResult
              );
            } catch (hookError) {
              console.error(
                `stable-request: [Workflow: ${workflowId}] Error in handleBranchDecision hook:`,
                hookError
              );
            }
          }
        } catch (decisionError) {
          console.error(
            `stable-request: [Workflow: ${workflowId}] Error in branch decision hook for ${currentBranch.id}:`,
            decisionError
          );
          decision = { action: PHASE_DECISION_ACTIONS.CONTINUE };
        }
      }

      switch (decision.action) {
        case PHASE_DECISION_ACTIONS.TERMINATE:
          terminatedEarly = true;
          terminationReason = decision.metadata?.reason || `Branch ${currentBranchId} terminated workflow`;
          currentBranchId = null;
          break;

        case PHASE_DECISION_ACTIONS.JUMP:
          if (decision.targetBranchId) {
            const targetIndex = branches.findIndex(b => b.id === decision.targetBranchId);
            if (targetIndex === -1) {
              console.error(
                `stable-request: [Workflow: ${workflowId}] Jump target branch '${decision.targetBranchId}' not found`
              );
              terminatedEarly = true;
              terminationReason = `Jump target branch '${decision.targetBranchId}' not found`;
              currentBranchId = null;
            } else {
              currentBranchId = decision.targetBranchId;
            }
          } else {
            currentBranchId = branches[branchIndex + 1]?.id || null;
          }
          break;

        case PHASE_DECISION_ACTIONS.SKIP:
          if (!currentBranch.allowSkip && currentBranch.allowSkip !== undefined) {
            console.warn(
              `stable-request: [Workflow: ${workflowId}] Branch '${currentBranchId}' attempted to skip but allowSkip is false. Continuing normally.`
            );
            currentBranchId = branches[branchIndex + 1]?.id || null;
            break;
          }

          if (decision.targetBranchId) {
            const skipTargetIndex = branches.findIndex(b => b.id === decision.targetBranchId);
            if (skipTargetIndex !== -1) {
              for (let skipIdx = branchIndex + 1; skipIdx < skipTargetIndex; skipIdx++) {
                const skippedBranch = branches[skipIdx];
                const skippedResult: BranchExecutionResult<ResponseDataType> = {
                  branchId: skippedBranch.id,
                  branchIndex: skipIdx,
                  success: true,
                  executionTime: 0,
                  completedPhases: 0,
                  phaseResults: [],
                  executionNumber: 1,
                  skipped: true
                };
                branchResults.push(skippedResult);

                branchExecutionHistory.push({
                  branchId: skippedBranch.id,
                  branchIndex: skipIdx,
                  executionNumber: 1,
                  timestamp: new Date().toISOString(),
                  success: true,
                  executionTime: 0,
                  decision: { action: PHASE_DECISION_ACTIONS.SKIP }
                });
              }
              currentBranchId = decision.targetBranchId;
            } else {
              currentBranchId = branches[branchIndex + 1]?.id || null;
            }
          } else {
            const nextBranch = branches[branchIndex + 1];
            if (nextBranch) {
              const skippedResult: BranchExecutionResult<ResponseDataType> = {
                branchId: nextBranch.id,
                branchIndex: branchIndex + 1,
                success: true,
                executionTime: 0,
                completedPhases: 0,
                phaseResults: [],
                executionNumber: 1,
                skipped: true
              };
              branchResults.push(skippedResult);

              branchExecutionHistory.push({
                branchId: nextBranch.id,
                branchIndex: branchIndex + 1,
                executionNumber: 1,
                timestamp: new Date().toISOString(),
                success: true,
                executionTime: 0,
                decision: { action: PHASE_DECISION_ACTIONS.SKIP }
              });
            }
            currentBranchId = branches[branchIndex + 2]?.id || null;
          }
          break;

        case PHASE_DECISION_ACTIONS.REPLAY:
          if (!currentBranch.allowReplay && currentBranch.allowReplay !== undefined) {
            console.warn(
              `stable-request: [Workflow: ${workflowId}] Branch '${currentBranchId}' attempted to replay but allowReplay is false. Continuing normally.`
            );
            currentBranchId = branches[branchIndex + 1]?.id || null;
            break;
          }
          currentBranchId = currentBranch.id;
          break;

        case PHASE_DECISION_ACTIONS.CONTINUE:
        default:
          currentBranchId = branches[branchIndex + 1]?.id || null;
          break;
      }

      if (stopOnFirstPhaseError && result.failedRequests > 0) {
        terminatedEarly = true;
        terminationReason = `Branch ${currentBranch.id} failed`;
        break;
      }
    }
  }

  if (iterationCount >= maxWorkflowIterations) {
    terminatedEarly = true;
    terminationReason = `Exceeded maximum workflow iterations (${maxWorkflowIterations})`;
    
    if (logPhaseResults) {
      console.warn(
        `stable-request: [Workflow: ${workflowId}] ${terminationReason}`
      );
    }
  }

  return {
    branchResults,
    allPhaseResults,
    executionHistory,
    branchExecutionHistory,
    totalRequests,
    successfulRequests,
    failedRequests,
    terminatedEarly,
    terminationReason
  };
}