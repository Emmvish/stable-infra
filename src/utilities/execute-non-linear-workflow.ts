import { executePhase } from './execute-phase.js';
import { safelyExecuteUnknownFunction } from './safely-execute-unknown-function.js';
import { formatLogContext } from './format-log-context.js';
import { PHASE_DECISION_ACTIONS } from '../enums/index.js';
import {
  EXECUTE_NON_LINEAR_WORKFLOW_RESPONSE,
  NonLinearWorkflowContext,
  STABLE_WORKFLOW_PHASE, 
  PhaseExecutionDecision,
  PhaseExecutionRecord,
  STABLE_WORKFLOW_PHASE_RESULT
} from '../types/index.js';

export async function executeNonLinearWorkflow<RequestDataType = any, ResponseDataType = any>(
  context: NonLinearWorkflowContext<RequestDataType, ResponseDataType>
): Promise<EXECUTE_NON_LINEAR_WORKFLOW_RESPONSE<ResponseDataType>> {
  const {
    phases,
    workflowId,
    branchId,
    commonGatewayOptions,
    requestGroups,
    logPhaseResults,
    handlePhaseCompletion,
    handlePhaseError,
    handlePhaseDecision,
    maxSerializableChars,
    workflowHookParams,
    sharedBuffer,
    stopOnFirstPhaseError,
    maxWorkflowIterations
  } = context;

  const phaseResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[] = [];
  const executionHistory: PhaseExecutionRecord[] = [];
  const phaseExecutionCounts: Map<string, number> = new Map();
  
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  let terminatedEarly = false;
  let terminationReason: string | undefined;

  const phaseMap = new Map<string, { phase: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>; index: number }>();
  phases.forEach((phase, index) => {
    const phaseId = phase.id || `phase-${index + 1}`;
    phaseMap.set(phaseId, { phase, index });
  });

  let currentPhaseId: string | null = phases[0]?.id || 'phase-1';
  let iterationCount = 0;

  while (currentPhaseId && iterationCount < maxWorkflowIterations) {
    iterationCount++;

    const phaseData = phaseMap.get(currentPhaseId);
    if (!phaseData) {
      if (logPhaseResults) {
        console.error(
          `${formatLogContext({ workflowId, branchId })}stable-request: Phase '${currentPhaseId}' not found. Terminating workflow.`
        );
      }
      terminatedEarly = true;
      terminationReason = `Phase '${currentPhaseId}' not found`;
      break;
    }

    const { phase, index: phaseIndex } = phaseData;

    if (phase.markConcurrentPhase) {
      const concurrentPhases: Array<{ phase: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>; index: number; id: string }> = [];
      let j = phaseIndex;
      
      while (j < phases.length && phases[j].markConcurrentPhase) {
        const concurrentPhaseId = phases[j].id || `phase-${j + 1}`;
        concurrentPhases.push({
          phase: phases[j],
          index: j,
          id: concurrentPhaseId
        });
        j++;
      }

      if (logPhaseResults) {
        console.info(
          `\nstable-request: [Workflow: ${workflowId}] Executing ${concurrentPhases.length} phases in parallel: [${concurrentPhases.map(p => p.id).join(', ')}]`
        );
      }

      const concurrentPromises = concurrentPhases.map(({ phase: p, index: idx, id }) => {
        const executionNumber = (phaseExecutionCounts.get(id) || 0) + 1;
        phaseExecutionCounts.set(id, executionNumber);
        
        return executePhase(
          p,
          idx,
          workflowId,
          commonGatewayOptions,
          requestGroups,
          logPhaseResults,
          handlePhaseCompletion,
          maxSerializableChars,
          workflowHookParams,
          sharedBuffer,
          branchId
        ).then(result => ({
          ...result,
          executionNumber,
          phaseId: id,
          phaseIndex: idx
        })).catch(error => ({
          workflowId,
          ...(branchId && { branchId }),
          phaseId: id,
          phaseIndex: idx,
          success: false,
          executionTime: 0,
          timestamp: new Date().toISOString(),
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          responses: [],
          executionNumber: (phaseExecutionCounts.get(id) || 0),
          error: error?.message || 'Phase execution failed'
        }));
      });

      const concurrentResults = await Promise.all(concurrentPromises);

      for (const phaseResult of concurrentResults) {
        totalRequests += phaseResult.totalRequests;
        successfulRequests += phaseResult.successfulRequests;
        failedRequests += phaseResult.failedRequests;
        phaseResults.push(phaseResult);

        executionHistory.push({
          phaseId: phaseResult.phaseId,
          phaseIndex: phaseResult.phaseIndex,
          executionNumber: phaseResult.executionNumber!,
          timestamp: phaseResult.timestamp,
          success: phaseResult.success,
          executionTime: phaseResult.executionTime
        });
      }

      const hasFailures = concurrentResults.some(r => !r.success);
      if (hasFailures && stopOnFirstPhaseError) {
        if (logPhaseResults) {
          console.error(
            `stable-request: [Workflow: ${workflowId}] One or more concurrent phases failed. Terminating workflow.`
          );
        }
        terminatedEarly = true;
        terminationReason = `One or more concurrent phases failed`;
        break;
      }

      const lastConcurrentPhase = concurrentPhases[concurrentPhases.length - 1];
      const lastResult = concurrentResults[concurrentResults.length - 1];
      let decision: PhaseExecutionDecision = { action: PHASE_DECISION_ACTIONS.CONTINUE };

      if (lastConcurrentPhase.phase.phaseDecisionHook) {
        try {
          decision = await safelyExecuteUnknownFunction(
            lastConcurrentPhase.phase.phaseDecisionHook,
            {
              workflowId,
              ...(branchId && { branchId }),
              phaseResult: lastResult,
              phaseId: lastConcurrentPhase.id,
              phaseIndex: lastConcurrentPhase.index,
              executionHistory,
              sharedBuffer,
              params: workflowHookParams?.handlePhaseDecisionParams,
              concurrentPhaseResults: concurrentResults
            }
          );

          if (!decision || typeof decision !== 'object') {
            decision = { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }

          if (logPhaseResults) {
            console.info(
              `${formatLogContext({ workflowId, branchId })}stable-request: Concurrent group decision: ${decision.action}`,
              decision.targetPhaseId ? `-> ${decision.targetPhaseId}` : ''
            );
          }

          if (handlePhaseDecision) {
            try {
              await safelyExecuteUnknownFunction(handlePhaseDecision, decision, lastResult);
            } catch (hookError) {
              console.error(
                `stable-request: [Workflow: ${workflowId}] Error in handlePhaseDecision hook:`,
                hookError
              );
            }
          }
        } catch (decisionError: any) {
          console.error(
            `${formatLogContext({ workflowId, branchId })}stable-request: Error in phaseDecisionHook for concurrent group:`,
            decisionError
          );
          decision = { action: PHASE_DECISION_ACTIONS.CONTINUE };
        }
      }

      switch (decision.action) {
        case PHASE_DECISION_ACTIONS.TERMINATE:
          if (logPhaseResults) {
            console.info(
              `stable-request: [Workflow: ${workflowId}] Workflow terminated by decision hook.`,
              decision.metadata ? `Metadata: ${JSON.stringify(decision.metadata)}` : ''
            );
          }
          terminatedEarly = true;
          terminationReason = decision.metadata?.reason || 'Terminated by phase decision';
          currentPhaseId = null;
          break;

        case PHASE_DECISION_ACTIONS.SKIP:
          if (decision.targetPhaseId) {
            currentPhaseId = decision.targetPhaseId;
          } else {
            currentPhaseId = phases[j + 1]?.id || `phase-${j + 2}`;
            if (j + 1 >= phases.length) {
              currentPhaseId = null;
            }
          }
          break;

        case PHASE_DECISION_ACTIONS.REPLAY:
          if (logPhaseResults) {
            console.warn(
              `${formatLogContext({ workflowId, branchId })}stable-request: Replay is not supported for concurrent phase groups. Continuing to next phase.`
            );
          }
          currentPhaseId = phases[j]?.id || `phase-${j + 1}`;
          if (j >= phases.length) {
            currentPhaseId = null;
          }
          break;

        case PHASE_DECISION_ACTIONS.JUMP:
          if (!decision.targetPhaseId) {
            console.error(
              `${formatLogContext({ workflowId, branchId })}stable-request: Jump decision requires targetPhaseId. Continuing to next phase.`
            );
            currentPhaseId = phases[j]?.id || `phase-${j + 1}`;
            if (j >= phases.length) {
              currentPhaseId = null;
            }
          } else {
            currentPhaseId = decision.targetPhaseId;
          }
          break;

        case PHASE_DECISION_ACTIONS.CONTINUE:
        default:
          currentPhaseId = phases[j]?.id || `phase-${j + 1}`;
          if (j >= phases.length) {
            currentPhaseId = null;
          }
          break;
      }

      continue;
    }

    const phaseId = currentPhaseId;

    const executionNumber = (phaseExecutionCounts.get(phaseId) || 0) + 1;
    phaseExecutionCounts.set(phaseId, executionNumber);

    const maxReplayCount = phase.maxReplayCount ?? Infinity;
    if (executionNumber > maxReplayCount + 1) {
      if (logPhaseResults) {
        console.warn(
          `${formatLogContext({ workflowId, branchId, phaseId })}stable-request: Phase '${phaseId}' exceeded max replay count (${maxReplayCount}). Skipping.`
        );
      }
      
      const skippedResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType> = {
        workflowId,
        ...(branchId && { branchId }),
        phaseId,
        phaseIndex,
        success: false,
        executionTime: 0,
        timestamp: new Date().toISOString(),
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responses: [],
        executionNumber,
        skipped: true,
        error: `Exceeded max replay count (${maxReplayCount})`
      };

      phaseResults.push(skippedResult);
      
      currentPhaseId = phases[phaseIndex + 1]?.id || `phase-${phaseIndex + 2}`;
      if (phaseIndex + 1 >= phases.length) {
        currentPhaseId = null;
      }
      continue;
    }

    if (logPhaseResults) {
      const executionLabel = executionNumber > 1 ? ` (execution #${executionNumber})` : '';
      console.info(
        `${formatLogContext({ workflowId, branchId, phaseId })}\nstable-request: Executing Phase '${phaseId}'${executionLabel}`
      );
    }

    try {
      const phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType> = await executePhase(
        phase,
        phaseIndex,
        workflowId,
        commonGatewayOptions,
        requestGroups,
        logPhaseResults,
        handlePhaseCompletion,
        maxSerializableChars,
        workflowHookParams,
        sharedBuffer,
        branchId
      );

      phaseResult.executionNumber = executionNumber;

      totalRequests += phaseResult.totalRequests;
      successfulRequests += phaseResult.successfulRequests;
      failedRequests += phaseResult.failedRequests;

      phaseResults.push(phaseResult);

      const historyRecord: PhaseExecutionRecord = {
        phaseId,
        phaseIndex,
        executionNumber,
        timestamp: phaseResult.timestamp,
        success: phaseResult.success,
        executionTime: phaseResult.executionTime
      };

      let decision: PhaseExecutionDecision = { action: PHASE_DECISION_ACTIONS.CONTINUE };

      if (phase.phaseDecisionHook) {
        try {
          decision = await safelyExecuteUnknownFunction(
            phase.phaseDecisionHook,
            {
              workflowId,
              ...(branchId && { branchId }),
              phaseResult,
              phaseId,
              phaseIndex,
              executionHistory,
              sharedBuffer,
              params: workflowHookParams?.handlePhaseDecisionParams
            }
          );

          if (!decision || typeof decision !== 'object') {
            decision = { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }

          phaseResult.decision = decision;
          historyRecord.decision = decision;

          if (logPhaseResults) {
            console.info(
              `${formatLogContext({ workflowId, branchId, phaseId })}stable-request: Phase '${phaseId}' decision: ${decision.action}`,
              decision.targetPhaseId ? `-> ${decision.targetPhaseId}` : ''
            );
          }

          if (handlePhaseDecision) {
            try {
              await safelyExecuteUnknownFunction(handlePhaseDecision, decision, phaseResult);
            } catch (hookError) {
              console.error(
                `stable-request: [Workflow: ${workflowId}] Error in handlePhaseDecision hook:`,
                hookError
              );
            }
          }
        } catch (decisionError: any) {
          console.error(
            `${formatLogContext({ workflowId, branchId, phaseId })}stable-request: Error in phaseDecisionHook for phase '${phaseId}':`,
            decisionError
          );
          decision = { action: PHASE_DECISION_ACTIONS.CONTINUE };
        }
      }

      executionHistory.push(historyRecord);

      if (phaseResult.failedRequests > 0 && stopOnFirstPhaseError) {
        if (logPhaseResults) {
          console.error(
            `stable-request: [Workflow: ${workflowId}] Phase '${phaseId}' has failures. Stopping workflow due to stopOnFirstPhaseError.`
          );
        }
        terminatedEarly = true;
        terminationReason = `Phase '${phaseId}' failed with ${phaseResult.failedRequests} failed requests`;
        break;
      }

      switch (decision.action) {
        case PHASE_DECISION_ACTIONS.TERMINATE:
          if (logPhaseResults) {
            console.info(
              `stable-request: [Workflow: ${workflowId}] Phase '${phaseId}' decided to terminate workflow.`
            );
          }
          terminatedEarly = true;
          terminationReason = decision.metadata?.reason || 'Terminated by phase decision';
          currentPhaseId = null;
          break;

        case PHASE_DECISION_ACTIONS.SKIP:
          if (!phase.allowSkip && phase.allowSkip !== undefined) {
            console.warn(
              `${formatLogContext({ workflowId, branchId, phaseId })}stable-request: Phase '${phaseId}' attempted to skip but allowSkip is false. Continuing normally.`
            );
            currentPhaseId = phases[phaseIndex + 1]?.id || `phase-${phaseIndex + 2}`;
            if (phaseIndex + 1 >= phases.length) {
              currentPhaseId = null;
            }
          } else {
            if (decision.targetPhaseId) {
              currentPhaseId = decision.targetPhaseId;
            } else {
              currentPhaseId = phases[phaseIndex + 2]?.id || `phase-${phaseIndex + 3}`;
              if (phaseIndex + 2 >= phases.length) {
                currentPhaseId = null;
              }
            }
          }
          break;

        case PHASE_DECISION_ACTIONS.REPLAY:
          if (!phase.allowReplay && phase.allowReplay !== undefined) {
            console.warn(
              `${formatLogContext({ workflowId, branchId, phaseId })}stable-request: Phase '${phaseId}' attempted to replay but allowReplay is false. Continuing normally.`
            );
            currentPhaseId = phases[phaseIndex + 1]?.id || `phase-${phaseIndex + 2}`;
            if (phaseIndex + 1 >= phases.length) {
              currentPhaseId = null;
            }
          } else {
            currentPhaseId = phaseId;
          }
          break;

        case PHASE_DECISION_ACTIONS.JUMP:
          if (decision.targetPhaseId) {
            currentPhaseId = decision.targetPhaseId;
          } else {
            console.warn(
              `stable-request: [Workflow: ${workflowId}] Phase '${phaseId}' decided to jump but no targetPhaseId provided. Continuing normally.`
            );
            currentPhaseId = phases[phaseIndex + 1]?.id || `phase-${phaseIndex + 2}`;
            if (phaseIndex + 1 >= phases.length) {
              currentPhaseId = null;
            }
          }
          break;

        case PHASE_DECISION_ACTIONS.CONTINUE:
        default:
          currentPhaseId = phases[phaseIndex + 1]?.id || `phase-${phaseIndex + 2}`;
          if (phaseIndex + 1 >= phases.length) {
            currentPhaseId = null;
          }
          break;
      }

    } catch (phaseError: any) {
      console.error(
        `${formatLogContext({ workflowId, branchId, phaseId })}stable-request: Error executing phase '${phaseId}':`,
        phaseError
      );

      const errorResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType> = {
        workflowId,
        ...(branchId && { branchId }),
        phaseId,
        phaseIndex,
        success: false,
        executionTime: 0,
        timestamp: new Date().toISOString(),
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responses: [],
        executionNumber,
        error: phaseError?.message || 'Phase execution failed'
      };

      phaseResults.push(errorResult);
      failedRequests += 1;

      executionHistory.push({
        phaseId,
        phaseIndex,
        executionNumber,
        timestamp: errorResult.timestamp,
        success: false,
        executionTime: 0
      });

      try {
        await safelyExecuteUnknownFunction(
          handlePhaseError,
          {
            workflowId,
            ...(branchId && { branchId }),
            phaseResult: errorResult,
            error: phaseError,
            maxSerializableChars,
            params: workflowHookParams?.handlePhaseErrorParams,
            sharedBuffer
          }
        );
      } catch (hookError) {
        console.error(
          `${formatLogContext({ workflowId, branchId, phaseId })}stable-request: Error in handlePhaseError hook:`,
          hookError
        );
      }

      if (stopOnFirstPhaseError) {
        terminatedEarly = true;
        terminationReason = `Phase '${phaseId}' encountered an error: ${phaseError?.message}`;
        break;
      }

      currentPhaseId = phases[phaseIndex + 1]?.id || `phase-${phaseIndex + 2}`;
      if (phaseIndex + 1 >= phases.length) {
        currentPhaseId = null;
      }
    }
  }

  if (iterationCount >= maxWorkflowIterations && currentPhaseId) {
    if (logPhaseResults) {
      console.warn(
        `${formatLogContext({ workflowId, branchId })}stable-request: Reached max workflow iterations (${maxWorkflowIterations}). Terminating.`
      );
    }
    terminatedEarly = true;
    terminationReason = `Exceeded maximum workflow iterations (${maxWorkflowIterations})`;
  }

  return {
    phaseResults,
    executionHistory,
    totalRequests,
    successfulRequests,
    failedRequests,
    terminatedEarly,
    terminationReason
  };
}