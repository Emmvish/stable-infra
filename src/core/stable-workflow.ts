import {
    STABLE_WORKFLOW_OPTIONS,
    STABLE_WORKFLOW_PHASE,
    STABLE_WORKFLOW_RESULT
} from '../types/index.js';
import { 
    executeBranchWorkflow,
    executePhase,
    executeNonLinearWorkflow,
    safelyExecuteUnknownFunction, 
    safelyStringify,
    CircuitBreaker
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
        handlePhaseDecision,
        handleBranchCompletion,
        handleBranchDecision,
        maxSerializableChars = 1000,
        requestGroups = [],
        workflowHookParams = {},
        concurrentPhaseExecution = false,
        enableMixedExecution = false,
        enableBranchExecution = false,
        enableNonLinearExecution = false,
        maxWorkflowIterations = 1000,
        branches,
        ...commonGatewayOptions
    } = options;

    const workflowStartTime = Date.now();
    const workflowId = options.workflowId || `workflow-${Date.now()}`;
    const phaseResults: STABLE_WORKFLOW_RESULT<ResponseDataType>['phases'] = [];
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    const workflowCircuitBreaker = commonGatewayOptions.circuitBreaker
        ? new CircuitBreaker(commonGatewayOptions.circuitBreaker)
        : null;
    
    const commonGatewayOptionsWithBreaker = workflowCircuitBreaker
        ? { ...commonGatewayOptions, circuitBreaker: workflowCircuitBreaker as any }
        : commonGatewayOptions;

    try {
        if (enableBranchExecution && branches && branches.length > 0) {
            if (logPhaseResults) {
                console.info(
                    `\nstable-request: [Workflow: ${workflowId}] Starting branch-based workflow execution with ${branches.length} branches`
                );
            }

            const branchResult = await executeBranchWorkflow({
                branches,
                workflowId,
                commonGatewayOptions: commonGatewayOptionsWithBreaker,
                requestGroups,
                logPhaseResults,
                handlePhaseCompletion,
                handlePhaseError,
                handleBranchCompletion,
                handleBranchDecision,
                maxSerializableChars,
                workflowHookParams,
                sharedBuffer: options.sharedBuffer,
                stopOnFirstPhaseError,
                maxWorkflowIterations
            });

            phaseResults.push(...branchResult.allPhaseResults);
            totalRequests = branchResult.totalRequests;
            successfulRequests = branchResult.successfulRequests;
            failedRequests = branchResult.failedRequests;

            const workflowExecutionTime = Date.now() - workflowStartTime;
            const workflowSuccess = failedRequests === 0;

            return {
                workflowId,
                success: workflowSuccess,
                executionTime: workflowExecutionTime,
                timestamp: new Date(workflowStartTime).toISOString(),
                totalPhases: branchResult.allPhaseResults.length,
                completedPhases: branchResult.allPhaseResults.length,
                totalRequests,
                successfulRequests,
                failedRequests,
                phases: phaseResults,
                executionHistory: branchResult.executionHistory,
                branches: branchResult.branchResults,
                branchExecutionHistory: branchResult.branchExecutionHistory,
                terminatedEarly: branchResult.terminatedEarly,
                terminationReason: branchResult.terminationReason
            };
        }


        if (enableNonLinearExecution) {
            if (logPhaseResults) {
                console.info(
                    `\nstable-request: [Workflow: ${workflowId}] Starting non-linear workflow execution with ${phases.length} phases`
                );
            }

            const nonLinearResult = await executeNonLinearWorkflow({
                phases,
                workflowId,
                commonGatewayOptions: commonGatewayOptionsWithBreaker,
                requestGroups,
                logPhaseResults,
                handlePhaseCompletion,
                handlePhaseError,
                handlePhaseDecision,
                maxSerializableChars,
                workflowHookParams,
                sharedBuffer: options.sharedBuffer,
                stopOnFirstPhaseError,
                maxWorkflowIterations
            });

            phaseResults.push(...nonLinearResult.phaseResults);
            totalRequests = nonLinearResult.totalRequests;
            successfulRequests = nonLinearResult.successfulRequests;
            failedRequests = nonLinearResult.failedRequests;

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
                phases: phaseResults,
                executionHistory: nonLinearResult.executionHistory,
                terminatedEarly: nonLinearResult.terminatedEarly,
                terminationReason: nonLinearResult.terminationReason
            };

            if (logPhaseResults) {
                console.info(
                    `\nstable-request: [Workflow: ${workflowId}] Non-linear workflow completed:`,
                    `${successfulRequests}/${totalRequests} requests successful`,
                    `across ${phaseResults.length} phase executions`,
                    `(${workflowExecutionTime}ms)`
                );

                if (nonLinearResult.terminatedEarly) {
                    console.info(
                        `stable-request: [Workflow: ${workflowId}] Workflow terminated early: ${nonLinearResult.terminationReason}`
                    );
                }
            }

            return result;
        }

        const processPhaseResult = (phaseResult: STABLE_WORKFLOW_RESULT<ResponseDataType>['phases'][number]) => {
            phaseResults.push(phaseResult);
            totalRequests += phaseResult.totalRequests;
            successfulRequests += phaseResult.successfulRequests;
            failedRequests += phaseResult.failedRequests;
        };

        const handlePhaseExecutionError = async (phaseId: string, phaseIndex: number, error: any, phase: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>) => {
            const phaseResult = {
                phaseId,
                phaseIndex,
                success: false,
                executionTime: 0,
                timestamp: new Date().toISOString(),
                totalRequests: phase.requests.length,
                successfulRequests: 0,
                failedRequests: phase.requests.length,
                responses: [],
                error: error?.message || 'Phase execution failed'
            };

            processPhaseResult(phaseResult);

            if (logPhaseResults) {
                console.error(
                    `stable-request: [Workflow: ${workflowId}] Phase ${phaseId} failed:`,
                    error
                );
            }

            try {
                await safelyExecuteUnknownFunction(
                    handlePhaseError, {
                        workflowId,
                        phaseResult,
                        error,
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
        };

        if (enableMixedExecution && !concurrentPhaseExecution) {
            let i = 0;
            while (i < phases.length) {
                const currentPhase = phases[i];
                const currentPhaseId = currentPhase.id || `phase-${i + 1}`;

                if (currentPhase.markConcurrentPhase) {
                    const concurrentGroup: { phase: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>; index: number }[] = [
                        { phase: currentPhase, index: i }
                    ];
                    
                    let j = i + 1;
                    while (j < phases.length && phases[j].markConcurrentPhase) {
                        concurrentGroup.push({ phase: phases[j], index: j });
                        j++;
                    }

                    if (logPhaseResults) {
                        const phaseIds = concurrentGroup.map(({ phase, index }) => 
                            phase.id || `phase-${index + 1}`
                        ).join(', ');
                        console.info(
                            `\nstable-request: [Workflow: ${workflowId}] Executing concurrent group: [${phaseIds}]`
                        );
                    }

                    const groupPromises = concurrentGroup.map(({ phase, index }) =>
                        executePhase(
                            phase,
                            index,
                            workflowId,
                            commonGatewayOptionsWithBreaker,
                            requestGroups,
                            logPhaseResults,
                            handlePhaseCompletion,
                            maxSerializableChars,
                            workflowHookParams,
                            options.sharedBuffer
                        )
                    );

                    const settledGroup = await Promise.allSettled(groupPromises);

                    for (let k = 0; k < settledGroup.length; k++) {
                        const result = settledGroup[k];
                        const { phase, index } = concurrentGroup[k];
                        const phaseId = phase.id || `phase-${index + 1}`;

                        if (result.status === 'fulfilled') {
                            processPhaseResult(result.value);
                        } else {
                            await handlePhaseExecutionError(phaseId, index, result.reason, phase);
                        }
                    }

                    if (stopOnFirstPhaseError && failedRequests > 0) {
                        if (logPhaseResults) {
                            console.error(
                                `stable-request: [Workflow: ${workflowId}] Stopping workflow due to phase failure in concurrent group`
                            );
                        }
                        break;
                    }

                    i = j;
                } else {
                    if (logPhaseResults) {
                        console.info(
                            `\nstable-request: [Workflow: ${workflowId}] Starting Phase ${i + 1}/${phases.length}: ${currentPhaseId}`
                        );
                    }

                    try {
                        const phaseResult = await executePhase(
                            currentPhase,
                            i,
                            workflowId,
                            commonGatewayOptionsWithBreaker,
                            requestGroups,
                            logPhaseResults,
                            handlePhaseCompletion,
                            maxSerializableChars,
                            workflowHookParams,
                            options.sharedBuffer
                        );

                        processPhaseResult(phaseResult);

                        if (phaseResult.failedRequests > 0 && stopOnFirstPhaseError) {
                            if (logPhaseResults) {
                                console.error(
                                    `stable-request: [Workflow: ${workflowId}] Stopping workflow due to phase failure`
                                );
                            }
                            break;
                        }

                    } catch (phaseError: any) {
                        await handlePhaseExecutionError(currentPhaseId, i, phaseError, currentPhase);

                        if (stopOnFirstPhaseError) {
                            if (logPhaseResults) {
                                console.error(
                                    `stable-request: [Workflow: ${workflowId}] Stopping workflow due to phase error`
                                );
                            }
                            break;
                        }
                    }

                    i++;
                }
            }
        } else if (concurrentPhaseExecution) {
            const phasePromises = phases.map((phase, i) => 
                executePhase(
                    phase,
                    i,
                    workflowId,
                    commonGatewayOptionsWithBreaker,
                    requestGroups,
                    logPhaseResults,
                    handlePhaseCompletion,
                    maxSerializableChars,
                    workflowHookParams,
                    options.sharedBuffer
                )
            );

            const settledPhases = await Promise.allSettled(phasePromises);

            for (let i = 0; i < settledPhases.length; i++) {
                const result = settledPhases[i];
                if (result.status === 'fulfilled') {
                    processPhaseResult(result.value);
                } else {
                    await handlePhaseExecutionError(
                        phases[i].id || `phase-${i + 1}`,
                        i,
                        result.reason,
                        phases[i]
                    );
                }
            }
        } else {
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
                        commonGatewayOptionsWithBreaker,
                        requestGroups,
                        logPhaseResults,
                        handlePhaseCompletion,
                        maxSerializableChars,
                        workflowHookParams,
                        options.sharedBuffer
                    );

                    processPhaseResult(phaseResult);

                    if (phaseResult.failedRequests > 0 && stopOnFirstPhaseError) {
                        if (logPhaseResults) {
                            console.error(
                                `stable-request: [Workflow: ${workflowId}] Stopping workflow due to phase failure`
                            );
                        }
                        break;
                    }

                } catch (phaseError: any) {
                    await handlePhaseExecutionError(phaseId, i, phaseError, phase);

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
            phases: phaseResults,
            executionHistory: []
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
            executionHistory: [],
            error: workflowError.message
        };
    }
}