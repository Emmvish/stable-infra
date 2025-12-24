import { stableApiGateway } from './stable-api-gateway.js';
import {
    STABLE_WORKFLOW_OPTIONS,
    STABLE_WORKFLOW_PHASE,
    STABLE_WORKFLOW_RESULT
} from '../types/index.js';
import { 
    safelyExecuteUnknownFunction, 
    safelyStringify 
} from '../utilities/index.js';

export async function stableWorkflow<RequestDataType = any, ResponseDataType = any>(
    phases: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>[],
    options: STABLE_WORKFLOW_OPTIONS<RequestDataType, ResponseDataType> = {}
): Promise<STABLE_WORKFLOW_RESULT<ResponseDataType>> {
    const {
        stopOnFirstPhaseError = false,
        logPhaseResults = false,
        handlePhaseCompletion = ({ workflowId, phaseResult, maxSerializableChars = 1000 }) =>
            console.info(
                'stable-request:\n',
                'Workflow ID:\n',
                workflowId,
                '\nPhase result:\n',
                safelyStringify(phaseResult, maxSerializableChars)
            ),
        handlePhaseError = ({ workflowId, error, phaseResult, maxSerializableChars = 1000 }) =>
            console.error(
                'stable-request:\n',
                'Workflow ID:\n',
                workflowId,
                '\nError:\n',
                safelyStringify({ error, phaseResult }, maxSerializableChars)
            ),
        maxSerializableChars = 1000,
        requestGroups = [],
        workflowHookParams = {},
        concurrentPhaseExecution = false,
        ...commonGatewayOptions
    } = options;

    const workflowStartTime = Date.now();
    const workflowId = options.workflowId || `workflow-${Date.now()}`;
    const phaseResults: STABLE_WORKFLOW_RESULT<ResponseDataType>['phases'] = [];
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    try {
        if (concurrentPhaseExecution) {
            // Execute all phases concurrently
            const phasePromises = phases.map((phase, i) => 
                executePhase(
                    phase,
                    i,
                    workflowId,
                    commonGatewayOptions,
                    requestGroups,
                    logPhaseResults,
                    handlePhaseCompletion,
                    handlePhaseError,
                    maxSerializableChars,
                    workflowHookParams,
                    options.sharedBuffer
                )
            );

            const settledPhases = await Promise.allSettled(phasePromises);

            // Process results from concurrent execution
            settledPhases.forEach((result, i) => {
                if (result.status === 'fulfilled') {
                    const phaseResult = result.value;
                    phaseResults.push(phaseResult);
                    totalRequests += phaseResult.totalRequests;
                    successfulRequests += phaseResult.successfulRequests;
                    failedRequests += phaseResult.failedRequests;
                } else {
                    // Handle rejected phase
                    const phaseId = phases[i].id || `phase-${i + 1}`;
                    const phaseResult = {
                        phaseId,
                        phaseIndex: i,
                        success: false,
                        executionTime: 0,
                        timestamp: new Date().toISOString(),
                        totalRequests: phases[i].requests.length,
                        successfulRequests: 0,
                        failedRequests: phases[i].requests.length,
                        responses: [],
                        error: result.reason?.message || 'Phase execution failed'
                    };
                    phaseResults.push(phaseResult);
                    totalRequests += phases[i].requests.length;
                    failedRequests += phases[i].requests.length;

                    if (logPhaseResults) {
                        console.error(
                            `stable-request: [Workflow: ${workflowId}] Phase ${phaseId} failed:`,
                            result.reason
                        );
                    }
                }
            });
        } else {
            // Execute phases sequentially (existing behavior)
            for (let i = 0; i < phases.length; i++) {
                const phase = phases[i];
                const phaseId = phase.id || `phase-${i + 1}`;

                if (logPhaseResults) {
                    console.info(`\nstable-request: [Workflow: ${workflowId}] Starting Phase ${i + 1}/${phases.length}: ${phaseId}`);
                }

                try {
                    const phaseResult = await executePhase(
                        phase,
                        i,
                        workflowId,
                        commonGatewayOptions,
                        requestGroups,
                        logPhaseResults,
                        handlePhaseCompletion,
                        handlePhaseError,
                        maxSerializableChars,
                        workflowHookParams,
                        options.sharedBuffer
                    );

                    phaseResults.push(phaseResult);
                    totalRequests += phaseResult.totalRequests;
                    successfulRequests += phaseResult.successfulRequests;
                    failedRequests += phaseResult.failedRequests;

                    if (phaseResult.failedRequests > 0 && stopOnFirstPhaseError) {
                        if (logPhaseResults) {
                            console.error(
                                `stable-request: [Workflow: ${workflowId}] Stopping workflow due to phase failure`
                            );
                        }
                        break;
                    }

                } catch (phaseError: any) {
                    const phaseResult = {
                        phaseId,
                        phaseIndex: i,
                        success: false,
                        executionTime: 0,
                        timestamp: new Date().toISOString(),
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

                    try {
                        await safelyExecuteUnknownFunction(
                            handlePhaseError, {
                                workflowId,
                                phaseResult,
                                error: phaseError,
                                maxSerializableChars,
                                params: workflowHookParams?.handlePhaseErrorParams,
                                sharedBuffer: options.sharedBuffer
                            }
                        );
                    } catch (hookError) {
                        console.error(
                            `stable-request: [Workflow: ${workflowId}] Error in handlePhaseError hook:`,
                            hookError
                        );
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

async function executePhase<RequestDataType = any, ResponseDataType = any>(
    phase: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>,
    phaseIndex: number,
    workflowId: string,
    commonGatewayOptions: any,
    requestGroups: any[],
    logPhaseResults: boolean,
    handlePhaseCompletion: Function,
    handlePhaseError: Function,
    maxSerializableChars: number,
    workflowHookParams: any,
    sharedBuffer?: Record<string, any>
) {
    const phaseId = phase.id || `phase-${phaseIndex + 1}`;
    const phaseStartTime = Date.now();

    const phaseGatewayOptions = {
        ...commonGatewayOptions,
        ...(phase.commonConfig || {}),
        concurrentExecution: phase.concurrentExecution ?? true,
        stopOnFirstError: phase.stopOnFirstError ?? false,
        requestGroups,
        sharedBuffer
    };

    const phaseResponses = await stableApiGateway<RequestDataType, ResponseDataType>(
        phase.requests,
        phaseGatewayOptions
    );

    const phaseExecutionTime = Date.now() - phaseStartTime;
    const phaseSuccessCount = phaseResponses.filter(r => r.success).length;
    const phaseFailureCount = phaseResponses.filter(r => !r.success).length;

    const phaseResult = {
        phaseId,
        phaseIndex,
        success: phaseFailureCount === 0,
        executionTime: phaseExecutionTime,
        timestamp: new Date(phaseStartTime).toISOString(),
        totalRequests: phaseResponses.length,
        successfulRequests: phaseSuccessCount,
        failedRequests: phaseFailureCount,
        responses: phaseResponses
    };

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
                    params: workflowHookParams?.handlePhaseCompletionParams,
                    sharedBuffer
                }
            );
        } catch (hookError) {
            console.error(
                `stable-request: [Workflow: ${workflowId}] Error in handlePhaseCompletion hook:`,
                hookError
            );
        }
    }

    return phaseResult;
}