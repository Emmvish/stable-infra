import { executeNonLinearWorkflow } from './execute-non-linear-workflow.js';
import { executeWithPersistence } from './execute-with-persistence.js';
import { formatLogContext } from './format-log-context.js';
import { MetricsAggregator } from './metrics-aggregator.js';
import { MetricsValidator } from './metrics-validator.js';
import { PHASE_DECISION_ACTIONS } from '../enums/index.js';
import {
  STABLE_WORKFLOW_BRANCH,
  STABLE_WORKFLOW_PHASE_RESULT,
  EXECUTE_BRANCH_WORKFLOW_RESPONSE,
  BranchExecutionResult,
  BranchExecutionDecision,
  BranchWorkflowContext,
  PhaseExecutionRecord,
  BranchExecutionRecord,
  PreBranchExecutionHookOptions
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
    preBranchExecutionHook,
    prePhaseExecutionHook,
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
    const branchId = branch.id || `branch-${branchIndex + 1}`;
    
    let modifiedBranch = branch;
    if (preBranchExecutionHook) {
      try {
        const hookOptions: PreBranchExecutionHookOptions<RequestDataType, ResponseDataType> = {
          workflowId,
          branchId,
          branchIndex,
          branch: { ...branch },
          sharedBuffer,
          params: workflowHookParams?.preBranchExecutionHookParams
        };
        
        const result = await executeWithPersistence<STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType>>(
          preBranchExecutionHook,
          hookOptions,
          branch.statePersistence,
          { workflowId, branchId },
          sharedBuffer || {}
        );
        if (result) {
          modifiedBranch = result;
          console.info(
            `${formatLogContext({ workflowId, branchId })}stable-request: Branch configuration modified by preBranchExecutionHook`
          );
        }
      } catch (error) {
        console.error(
          `${formatLogContext({ workflowId, branchId })}stable-request: Error in preBranchExecutionHook:`,
          error
        );
      }
    }
    
    try {
      const branchConfig = mergeBranchConfig(modifiedBranch);
      
      const result = await executeNonLinearWorkflow({
        phases: modifiedBranch.phases,
        workflowId: `${workflowId}-branch-${branchId}`,
        branchId,
        commonGatewayOptions: branchConfig,
        requestGroups,
        logPhaseResults,
        handlePhaseCompletion,
        handlePhaseError,
        handlePhaseDecision: workflowHookParams?.handlePhaseDecision,
        prePhaseExecutionHook,
        maxSerializableChars,
        workflowHookParams,
        sharedBuffer,
        stopOnFirstPhaseError,
        maxWorkflowIterations
      });

      const branchExecutionTime = Date.now() - branchStartTime;

      const branchResult: BranchExecutionResult<ResponseDataType> = {
        workflowId,
        branchId,
        branchIndex,
        success: result.failedRequests === 0,
        executionTime: branchExecutionTime,
        completedPhases: result.phaseResults.length,
        phaseResults: result.phaseResults,
        executionNumber
      };

      branchResult.metrics = MetricsAggregator.extractBranchMetrics(branchResult);
      
      if (modifiedBranch.metricsGuardrails && branchResult.metrics) {
        branchResult.validation = MetricsValidator.validateBranchMetrics(
          branchResult.metrics,
          modifiedBranch.metricsGuardrails
        );
      }

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
        `${formatLogContext({ workflowId })}stable-request: Branch ${branchId} failed:`,
        error
      );

      const errorBranchResult: BranchExecutionResult<ResponseDataType> = {
        workflowId,
        branchId,
        branchIndex,
        success: false,
        executionTime: Date.now() - branchStartTime,
        completedPhases: 0,
        phaseResults: [],
        executionNumber,
        error: error?.message || 'Branch execution failed',
        decision: undefined
      };

      errorBranchResult.metrics = MetricsAggregator.extractBranchMetrics(errorBranchResult);
      
      if (branch.metricsGuardrails && errorBranchResult.metrics) {
        errorBranchResult.validation = MetricsValidator.validateBranchMetrics(
          errorBranchResult.metrics,
          branch.metricsGuardrails
        );
      }

      return {
        branchResult: errorBranchResult,
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
        `${formatLogContext({ workflowId })}stable-request: Branch '${currentBranchId}' not found`
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
          `${formatLogContext({ workflowId })}stable-request: Branch '${currentBranchId}' exceeded max replay count (${maxReplayCount}). Skipping.`
        );
      }

      const skippedResult: BranchExecutionResult<ResponseDataType> = {
        workflowId,
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

      skippedResult.metrics = MetricsAggregator.extractBranchMetrics(skippedResult);
      
      if (currentBranch.metricsGuardrails && skippedResult.metrics) {
        skippedResult.validation = MetricsValidator.validateBranchMetrics(
          skippedResult.metrics,
          currentBranch.metricsGuardrails
        );
      }

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
          `${formatLogContext({ workflowId })}\nstable-request: Executing ${concurrentGroup.length} branches in parallel: [${branchIds}]`
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
            await executeWithPersistence<void>(
              handleBranchCompletion,
              {
                workflowId,
                branchId: result.branchResult.branchId,
                branchResults: result.branchResult.phaseResults,
                success: result.branchResult.success,
                maxSerializableChars
              },
              branch.statePersistence,
              { workflowId, branchId: result.branchResult.branchId },
              sharedBuffer || {}
            );
          } catch (hookError) {
            console.error(
              `${formatLogContext({ workflowId, branchId: result.branchResult.branchId })}stable-request: Error in handleBranchCompletion hook:`,
              hookError
            );
          }
        }

        if (branch.branchDecisionHook) {
          try {
            const decision: BranchExecutionDecision = await executeWithPersistence<BranchExecutionDecision>(
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
              },
              branch.statePersistence,
              { workflowId, branchId: branch.id },
              sharedBuffer || {}
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
                const wrappedHook = (options: any) => handleBranchDecision(
                  options.decision,
                  options.branchResult,
                  options.maxSerializableChars
                );
                
                await executeWithPersistence<void>(
                  wrappedHook,
                  { decision, branchResult: result.branchResult, maxSerializableChars },
                  workflowHookParams?.statePersistence,
                  { workflowId, branchId: branch.id },
                  sharedBuffer || {}
                );
              } catch (hookError) {
                console.error(
                  `${formatLogContext({ workflowId, branchId: branch.id })}stable-request: Error in handleBranchDecision hook:`,
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
                  `${formatLogContext({ workflowId })}stable-request: Concurrent group decision: ${decision.action}`,
                  decision.targetBranchId ? `-> ${decision.targetBranchId}` : ''
                );
              }
            }
          } catch (decisionError) {
            console.error(
              `${formatLogContext({ workflowId, branchId: branch.id })}stable-request: Error in branch decision hook for ${branch.id}:`,
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

      const lastBranchDecision = concurrentGroup[concurrentGroup.length - 1]?.branch.branchDecisionHook ? 
        groupResults[groupResults.length - 1].branchResult.decision : undefined;
      
      if (lastBranchDecision) {
        if (lastBranchDecision.addBranches && Array.isArray(lastBranchDecision.addBranches) && lastBranchDecision.addBranches.length > 0) {
          if (logPhaseResults) {
            console.info(
              `${formatLogContext({ workflowId })}stable-request: Adding ${lastBranchDecision.addBranches.length} dynamic branch(es) after concurrent group`
            );
          }

          lastBranchDecision.addBranches.forEach((newBranch, idx) => {
            const newBranchId = newBranch.id || `dynamic-branch-${Date.now()}-${idx}`;
            const newBranchWithId = { ...newBranch, id: newBranchId };
            
            branches.splice(j + idx, 0, newBranchWithId);
            
            if (logPhaseResults) {
              console.info(
                `${formatLogContext({ workflowId })}stable-request: Added dynamic branch '${newBranchId}' at index ${j + idx}`
              );
            }
          });
        }

        if (lastBranchDecision.addPhases && Array.isArray(lastBranchDecision.addPhases) && lastBranchDecision.addPhases.length > 0) {
          const lastBranch = concurrentGroup[concurrentGroup.length - 1].branch;
          
          if (logPhaseResults) {
            console.info(
              `${formatLogContext({ workflowId, branchId: lastBranch.id })}stable-request: Adding ${lastBranchDecision.addPhases.length} dynamic phase(s) to branch '${lastBranch.id}'`
            );
          }

          lastBranchDecision.addPhases.forEach((newPhase) => {
            lastBranch.phases.push(newPhase);
          });
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
              workflowId,
              branchId: skippedBranch.id,
              branchIndex: skipIdx,
              success: true,
              executionTime: 0,
              completedPhases: 0,
              phaseResults: [],
              executionNumber: 1,
              skipped: true
            };

            skippedResult.metrics = MetricsAggregator.extractBranchMetrics(skippedResult);
            
            if (skippedBranch.metricsGuardrails && skippedResult.metrics) {
              skippedResult.validation = MetricsValidator.validateBranchMetrics(
                skippedResult.metrics,
                skippedBranch.metricsGuardrails
              );
            }

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
          `${formatLogContext({ workflowId })}\nstable-request: Executing branch: ${currentBranch.id} (execution #${executionNumber})`
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
          await executeWithPersistence<void>(
            handleBranchCompletion,
            {
              workflowId,
              branchId: result.branchResult.branchId,
              branchResults: result.branchResult.phaseResults,
              success: result.branchResult.success,
              maxSerializableChars
            },
            currentBranch.statePersistence,
            { workflowId, branchId: currentBranchId },
            sharedBuffer || {}
          );
        } catch (hookError) {
          console.error(
            `${formatLogContext({ workflowId, branchId: currentBranchId })}stable-request: Error in handleBranchCompletion hook:`,
            hookError
          );
        }
      }

      let decision: BranchExecutionDecision = { action: PHASE_DECISION_ACTIONS.CONTINUE };

      if (currentBranch.branchDecisionHook) {
        try {
          decision = await executeWithPersistence<BranchExecutionDecision>(
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
            },
            currentBranch.statePersistence,
            { workflowId, branchId: currentBranchId },
            sharedBuffer || {}
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
              `${formatLogContext({ workflowId, branchId: currentBranchId })}stable-request: Branch '${currentBranchId}' decision: ${decision.action}`,
              decision.targetBranchId ? `-> ${decision.targetBranchId}` : ''
            );
          }

          if (handleBranchDecision) {
            try {
              const wrappedHook = (options: any) => handleBranchDecision(
                options.decision,
                options.branchResult,
                options.maxSerializableChars
              );
              
              await executeWithPersistence<void>(
                wrappedHook,
                { decision, branchResult: result.branchResult, maxSerializableChars },
                workflowHookParams?.statePersistence,
                { workflowId, branchId: currentBranchId },
                sharedBuffer || {}
              );
            } catch (hookError) {
              console.error(
                `${formatLogContext({ workflowId, branchId: currentBranchId })}stable-request: Error in handleBranchDecision hook:`,
                hookError
              );
            }
          }
        } catch (decisionError) {
          console.error(
            `${formatLogContext({ workflowId, branchId: currentBranch.id })}stable-request: Error in branch decision hook for ${currentBranch.id}:`,
            decisionError
          );
          decision = { action: PHASE_DECISION_ACTIONS.CONTINUE };
        }
      }

      if (decision.addBranches && Array.isArray(decision.addBranches) && decision.addBranches.length > 0) {
        if (logPhaseResults) {
          console.info(
            `${formatLogContext({ workflowId, branchId: currentBranchId })}stable-request: Adding ${decision.addBranches.length} dynamic branch(es) after '${currentBranchId}'`
          );
        }

        decision.addBranches.forEach((newBranch, idx) => {
          const newBranchId = newBranch.id || `dynamic-branch-${Date.now()}-${idx}`;
          const newBranchWithId = { ...newBranch, id: newBranchId };
          
          branches.splice(branchIndex + 1 + idx, 0, newBranchWithId);
          
          if (logPhaseResults) {
            console.info(
              `${formatLogContext({ workflowId })}stable-request: Added dynamic branch '${newBranchId}' at index ${branchIndex + 1 + idx}`
            );
          }
        });
      }

      if (decision.addPhases && Array.isArray(decision.addPhases) && decision.addPhases.length > 0) {
        if (logPhaseResults) {
          console.info(
            `${formatLogContext({ workflowId, branchId: currentBranchId })}stable-request: Adding ${decision.addPhases.length} dynamic phase(s) to branch '${currentBranchId}' and re-executing`
          );
        }

        decision.addPhases.forEach((newPhase) => {
          currentBranch.phases.push(newPhase);
        });

        if (logPhaseResults) {
          console.info(
            `${formatLogContext({ workflowId })}\nstable-request: Re-executing branch: ${currentBranch.id} with ${decision.addPhases.length} additional phase(s) (execution #${executionNumber + 1})`
          );
        }

        const reExecutionResult = await executeSingleBranch(currentBranch, branchIndex, executionNumber + 1);
        
        branchResults[branchResults.length - 1] = reExecutionResult.branchResult;
        allPhaseResults.push(...reExecutionResult.phaseResults);
        executionHistory.push(...reExecutionResult.executionHistory);
        totalRequests += reExecutionResult.totalRequests;
        successfulRequests += reExecutionResult.successfulRequests;
        failedRequests += reExecutionResult.failedRequests;
        
        branchExecutionHistory.push({
          branchId: currentBranchId,
          branchIndex,
          executionNumber: executionNumber + 1,
          timestamp: new Date().toISOString(),
          success: reExecutionResult.branchResult.success,
          executionTime: reExecutionResult.branchResult.executionTime
        });

        result.branchResult = reExecutionResult.branchResult;
        result.phaseResults = reExecutionResult.phaseResults;
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
                `${formatLogContext({ workflowId, branchId: currentBranchId })}stable-request: Jump target branch '${decision.targetBranchId}' not found`
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
              `${formatLogContext({ workflowId, branchId: currentBranchId })}stable-request: Branch '${currentBranchId}' attempted to skip but allowSkip is false. Continuing normally.`
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
                  workflowId,
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
                workflowId,
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
              `${formatLogContext({ workflowId, branchId: currentBranchId })}stable-request: Branch '${currentBranchId}' attempted to replay but allowReplay is false. Continuing normally.`
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
        `${formatLogContext({ workflowId })}stable-request: ${terminationReason}`
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