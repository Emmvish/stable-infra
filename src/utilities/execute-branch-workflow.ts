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
  PhaseExecutionRecord
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
    maxSerializableChars,
    workflowHookParams,
    sharedBuffer,
    stopOnFirstPhaseError,
    maxWorkflowIterations
  } = context;

  const branchResults: BranchExecutionResult<ResponseDataType>[] = [];
  const allPhaseResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[] = [];
  const executionHistory: PhaseExecutionRecord[] = [];
  
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  let terminatedEarly = false;
  let terminationReason: string | undefined;

  const parallelBranches: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType>[] = [];
  const serialBranches: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType>[] = [];

  branches.forEach(branch => {
    if (branch.executeInParallel) {
      parallelBranches.push(branch);
    } else {
      serialBranches.push(branch);
    }
  });

  if (parallelBranches.length > 0) {
    if (logPhaseResults) {
      console.info(
        `\nstable-request: [Workflow: ${workflowId}] Executing ${parallelBranches.length} branches in parallel: [${parallelBranches.map(b => b.id).join(', ')}]`
      );
    }

    const parallelPromises = parallelBranches.map(async (branch) => {
      const branchStartTime = Date.now();
      
      try {
        const result = await executeNonLinearWorkflow({
          phases: branch.phases,
          workflowId: `${workflowId}-branch-${branch.id}`,
          commonGatewayOptions,
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
          success: result.failedRequests === 0,
          executionTime: branchExecutionTime,
          completedPhases: result.phaseResults.length,
          phaseResults: result.phaseResults
        };

        if (branch.branchDecisionHook) {
          try {
            const decision: BranchExecutionDecision = await safelyExecuteUnknownFunction(
              branch.branchDecisionHook,
              {
                workflowId,
                branchResults: result.phaseResults,
                branchId: branch.id,
                executionHistory: result.executionHistory,
                sharedBuffer,
                params: workflowHookParams?.handleBranchDecisionParams
              }
            );

            branchResult.decision = decision;

            if (decision.action === PHASE_DECISION_ACTIONS.TERMINATE) {
              terminatedEarly = true;
              terminationReason = decision.metadata?.reason || `Branch ${branch.id} terminated workflow`;
            }
          } catch (decisionError) {
            console.error(
              `stable-request: [Workflow: ${workflowId}] Error in branch decision hook for ${branch.id}:`,
              decisionError
            );
          }
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
          `stable-request: [Workflow: ${workflowId}] Branch ${branch.id} failed:`,
          error
        );

        return {
          branchResult: {
            branchId: branch.id,
            success: false,
            executionTime: Date.now() - branchStartTime,
            completedPhases: 0,
            phaseResults: []
          },
          phaseResults: [],
          executionHistory: [],
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 1
        };
      }
    });

    const parallelResults = await Promise.all(parallelPromises);

    for (const result of parallelResults) {
      branchResults.push(result.branchResult);
      allPhaseResults.push(...result.phaseResults);
      executionHistory.push(...result.executionHistory);
      totalRequests += result.totalRequests;
      successfulRequests += result.successfulRequests;
      failedRequests += result.failedRequests;

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
    }

    if (terminatedEarly) {
      return {
        branchResults,
        allPhaseResults,
        executionHistory,
        totalRequests,
        successfulRequests,
        failedRequests,
        terminatedEarly,
        terminationReason
      };
    }
  }

  let branchIndex = 0;
  while (branchIndex < serialBranches.length) {
    const branch = serialBranches[branchIndex];
    
    if (logPhaseResults) {
      console.info(
        `\nstable-request: [Workflow: ${workflowId}] Executing branch: ${branch.id}`
      );
    }

    const branchStartTime = Date.now();

    try {
      const result = await executeNonLinearWorkflow({
        phases: branch.phases,
        workflowId: `${workflowId}-branch-${branch.id}`,
        commonGatewayOptions,
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
        success: result.failedRequests === 0,
        executionTime: branchExecutionTime,
        completedPhases: result.phaseResults.length,
        phaseResults: result.phaseResults
      };

      let shouldJump = false;
      let jumpTargetIndex = -1;

      if (branch.branchDecisionHook) {
        try {
          const decision: BranchExecutionDecision = await safelyExecuteUnknownFunction(
            branch.branchDecisionHook,
            {
              workflowId,
              branchResults: result.phaseResults,
              branchId: branch.id,
              executionHistory: result.executionHistory,
              sharedBuffer,
              params: workflowHookParams?.handleBranchDecisionParams,
              parallelBranchResults: branchResults
                .filter(br => parallelBranches.some(pb => pb.id === br.branchId))
                .map(br => br.phaseResults)
            }
          );

          branchResult.decision = decision;

          if (decision.action === PHASE_DECISION_ACTIONS.TERMINATE) {
            terminatedEarly = true;
            terminationReason = decision.metadata?.reason || `Branch ${branch.id} terminated workflow`;
            
            branchResults.push(branchResult);
            allPhaseResults.push(...result.phaseResults);
            executionHistory.push(...result.executionHistory);
            totalRequests += result.totalRequests;
            successfulRequests += result.successfulRequests;
            failedRequests += result.failedRequests;

            break;
          }

          if (decision.action === PHASE_DECISION_ACTIONS.JUMP && decision.targetBranchId) {
            const targetBranchIndex = serialBranches.findIndex(b => b.id === decision.targetBranchId);
            if (targetBranchIndex !== -1 && targetBranchIndex > branchIndex) {
              if (logPhaseResults) {
                console.info(
                  `stable-request: [Workflow: ${workflowId}] Jumping from branch ${branch.id} to ${decision.targetBranchId}`
                );
              }
              shouldJump = true;
              jumpTargetIndex = targetBranchIndex;
            } else if (targetBranchIndex === -1) {
              console.warn(
                `stable-request: [Workflow: ${workflowId}] Target branch ${decision.targetBranchId} not found`
              );
            } else if (targetBranchIndex <= branchIndex) {
              console.warn(
                `stable-request: [Workflow: ${workflowId}] Cannot jump backwards to ${decision.targetBranchId}`
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

      branchResults.push(branchResult);
      allPhaseResults.push(...result.phaseResults);
      executionHistory.push(...result.executionHistory);
      totalRequests += result.totalRequests;
      successfulRequests += result.successfulRequests;
      failedRequests += result.failedRequests;

      if (handleBranchCompletion) {
        try {
          await safelyExecuteUnknownFunction(
            handleBranchCompletion,
            {
              branchId: branchResult.branchId,
              branchResults: branchResult.phaseResults,
              success: branchResult.success
            }
          );
        } catch (hookError) {
          console.error(
            `stable-request: [Workflow: ${workflowId}] Error in handleBranchCompletion hook:`,
            hookError
          );
        }
      }

      if (shouldJump) {
        // Jump to target branch (skip intermediate branches)
        branchIndex = jumpTargetIndex;
        continue;
      }

      if (stopOnFirstPhaseError && result.failedRequests > 0) {
        if (logPhaseResults) {
          console.error(
            `stable-request: [Workflow: ${workflowId}] Branch ${branch.id} has failures. Stopping workflow.`
          );
        }
        terminatedEarly = true;
        terminationReason = `Branch ${branch.id} failed`;
        break;
      }

    } catch (error: any) {
      console.error(
        `stable-request: [Workflow: ${workflowId}] Branch ${branch.id} failed:`,
        error
      );

      const branchResult: BranchExecutionResult<ResponseDataType> = {
        branchId: branch.id,
        success: false,
        executionTime: Date.now() - branchStartTime,
        completedPhases: 0,
        phaseResults: []
      };

      branchResults.push(branchResult);
      failedRequests += 1;

      if (stopOnFirstPhaseError) {
        terminatedEarly = true;
        terminationReason = `Branch ${branch.id} failed with error`;
        break;
      }
    }
    
    branchIndex++;
  }

  return {
    branchResults,
    allPhaseResults,
    executionHistory,
    totalRequests,
    successfulRequests,
    failedRequests,
    terminatedEarly,
    terminationReason
  };
}