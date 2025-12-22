import { stableApiGateway } from './stable-api-gateway.js';
import {
    STABLE_WORKFLOW_OPTIONS,
    STABLE_WORKFLOW_PHASE,
    STABLE_WORKFLOW_RESULT
} from '../types/index.js';
import { safelyExecuteUnknownFunction } from '../utilities/index.js';

export async function stableWorkflow<RequestDataType = any, ResponseDataType = any>(
    phases: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>[],
    options: STABLE_WORKFLOW_OPTIONS<RequestDataType, ResponseDataType> = {}
): Promise<STABLE_WORKFLOW_RESULT<ResponseDataType>> {
    const {
        stopOnFirstPhaseError = false,
        logPhaseResults = false,
        handlePhaseCompletion,
        handlePhaseError,
        maxSerializableChars = 1000,
        requestGroups = [],
        workflowHookParams = {},
        ...commonGatewayOptions
    } = options;

    const workflowStartTime = Date.now();
    const workflowId = options.workflowId || `workflow-${Date.now()}`;
    const phaseResults: STABLE_WORKFLOW_RESULT<ResponseDataType>['phases'] = [];
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    try {
        for (let i = 0; i < phases.length; i++) {
            const phase = phases[i];
            const phaseId = phase.id || `phase-${i + 1}`;
            const phaseStartTime = Date.now();

            if (logPhaseResults) {
                console.info(`\nstable-request: [Workflow: ${workflowId}] Starting Phase ${i + 1}/${phases.length}: ${phaseId}`);
            }

            const phaseGatewayOptions = {
                ...commonGatewayOptions,
                ...(phase.commonConfig || {}),
                concurrentExecution: phase.concurrentExecution ?? true,
                stopOnFirstError: phase.stopOnFirstError ?? false,
                requestGroups,
            };

            try {
                const phaseResponses = await stableApiGateway<RequestDataType, ResponseDataType>(
                    phase.requests,
                    phaseGatewayOptions
                );

                const phaseExecutionTime = Date.now() - phaseStartTime;
                const phaseSuccessCount = phaseResponses.filter(r => r.success).length;
                const phaseFailureCount = phaseResponses.filter(r => !r.success).length;

                totalRequests += phaseResponses.length;
                successfulRequests += phaseSuccessCount;
                failedRequests += phaseFailureCount;

                const phaseResult = {
                    phaseId,
                    phaseIndex: i,
                    success: phaseFailureCount === 0,
                    executionTime: phaseExecutionTime,
                    timestamp: new Date(phaseStartTime).toISOString(),
                    totalRequests: phaseResponses.length,
                    successfulRequests: phaseSuccessCount,
                    failedRequests: phaseFailureCount,
                    responses: phaseResponses
                };

                phaseResults.push(phaseResult);

                if (logPhaseResults) {
                    console.info(
                        `stable-request: [Workflow: ${workflowId}] Phase ${phaseId} completed:`,
                        `${phaseSuccessCount}/${phaseResponses.length} successful`,
                        `(${phaseExecutionTime}ms)`
                    );
                }

                if (handlePhaseCompletion) {
                    try {
                        await safelyExecuteUnknownFunction(
                            handlePhaseCompletion, {
                                workflowId,
                                phaseResult,
                                maxSerializableChars,
                                params: workflowHookParams?.handlePhaseCompletionParams
                            }
                        );
                    } catch (hookError) {
                        console.error(
                            `stable-request: [Workflow: ${workflowId}] Error in handlePhaseCompletion hook:`,
                            hookError
                        );
                    }
                }

                if (phaseFailureCount > 0 && stopOnFirstPhaseError) {
                    if (logPhaseResults) {
                        console.error(
                            `stable-request: [Workflow: ${workflowId}] Stopping workflow due to phase failure`
                        );
                    }
                    break;
                }

            } catch (phaseError: any) {
                const phaseExecutionTime = Date.now() - phaseStartTime;
                
                const phaseResult = {
                    phaseId,
                    phaseIndex: i,
                    success: false,
                    executionTime: phaseExecutionTime,
                    timestamp: new Date(phaseStartTime).toISOString(),
                    totalRequests: phase.requests.length,
                    successfulRequests: 0,
                    failedRequests: phase.requests.length,
                    responses: [],
                    error: phaseError.message
                };

                phaseResults.push(phaseResult);
                totalRequests += phase.requests.length;
                failedRequests += phase.requests.length;

                if (logPhaseResults) {
                    console.error(
                        `stable-request: [Workflow: ${workflowId}] Phase ${phaseId} failed:`,
                        phaseError.message
                    );
                }

                if (handlePhaseError) {
                    try {
                        await safelyExecuteUnknownFunction(
                            handlePhaseError, {
                                workflowId,
                                phaseResult,
                                error: phaseError,
                                maxSerializableChars,
                                params: workflowHookParams?.handlePhaseErrorParams
                            }
                        );
                    } catch (hookError) {
                        console.error(
                            `stable-request: [Workflow: ${workflowId}] Error in handlePhaseError hook:`,
                            hookError
                        );
                    }
                }

                if (stopOnFirstPhaseError) {
                    if (logPhaseResults) {
                        console.error(
                            `stable-request: [Workflow: ${workflowId}] Stopping workflow due to phase error`
                        );
                    }
                    break;
                }
            }
        }

        const workflowExecutionTime = Date.now() - workflowStartTime;
        const workflowSuccess = failedRequests === 0;

        const result: STABLE_WORKFLOW_RESULT<ResponseDataType> = {
            workflowId,
            success: workflowSuccess,
            executionTime: workflowExecutionTime,
            timestamp: new Date(workflowStartTime).toISOString(),
            totalPhases: phases.length,
            completedPhases: phaseResults.length,
            totalRequests,
            successfulRequests,
            failedRequests,
            phases: phaseResults
        };

        if (logPhaseResults) {
            console.info(
                `\nstable-request: [Workflow: ${workflowId}] Completed:`,
                `${successfulRequests}/${totalRequests} requests successful`,
                `across ${phaseResults.length}/${phases.length} phases`,
                `(${workflowExecutionTime}ms)`
            );
        }

        return result;

    } catch (workflowError: any) {
        const workflowExecutionTime = Date.now() - workflowStartTime;

        if (logPhaseResults) {
            console.error(
                `stable-request: [Workflow: ${workflowId}] Fatal error:`,
                workflowError.message
            );
        }

        return {
            workflowId,
            success: false,
            executionTime: workflowExecutionTime,
            timestamp: new Date(workflowStartTime).toISOString(),
            totalPhases: phases.length,
            completedPhases: phaseResults.length,
            totalRequests,
            successfulRequests,
            failedRequests,
            phases: phaseResults,
            error: workflowError.message
        };
    }
}