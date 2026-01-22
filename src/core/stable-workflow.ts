import {
    STABLE_WORKFLOW_OPTIONS,
    STABLE_WORKFLOW_PHASE,
    STABLE_WORKFLOW_RESULT
} from '../types/index.js';
import { 
    executeBranchWorkflow,
    executePhase,
    executeNonLinearWorkflow,
    executeWithPersistence,
    safelyStringify,
    CircuitBreaker,
    formatLogContext,
    MetricsAggregator,
    MetricsValidator
} from '../utilities/index.js';

export async function stableWorkflow<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
    phases: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[],
    options: STABLE_WORKFLOW_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> = {}
): Promise<STABLE_WORKFLOW_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>> {
    const workflowId = options.workflowId || `workflow-${Date.now()}`;

    if (options.maxTimeout) {
        const timeoutPromise = new Promise<STABLE_WORKFLOW_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>>((_, reject) => {
            setTimeout(() => {
                const contextStr = `workflowId=${workflowId}`;
                reject(new Error(`stable-request: Workflow execution exceeded maxTimeout of ${options.maxTimeout}ms [${contextStr}]`));
            }, options.maxTimeout);
        });

        const executionPromise = executeWorkflowInternal(phases, options);
        return Promise.race([executionPromise, timeoutPromise]);
    }

    return executeWorkflowInternal(phases, options);
}

async function executeWorkflowInternal<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
    phases: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[],
    options: STABLE_WORKFLOW_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
): Promise<STABLE_WORKFLOW_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>> {
    const {
        stopOnFirstPhaseError = false,
        logPhaseResults = false,
        handlePhaseCompletion = ({ workflowId, phaseResult, maxSerializableChars = 1000 }) =>
            console.info(
                `${formatLogContext({ workflowId })}stable-request:\n`,
                'Workflow ID:\n',
                workflowId,
                '\nPhase result:\n',
                safelyStringify(phaseResult, maxSerializableChars)
            ),
        handlePhaseError = ({ workflowId, error, phaseResult, maxSerializableChars = 1000 }) =>
            console.error(
                `${formatLogContext({ workflowId })}stable-request:\n`,
                'Workflow ID:\n',
                workflowId,
                '\nError:\n',
                safelyStringify({ error, phaseResult }, maxSerializableChars)
            ),
        handlePhaseDecision = (options) => {},
        handleBranchCompletion = ({ success, branchId, workflowId, maxSerializableChars }: any) => console.info(
            `${formatLogContext({ workflowId, branchId })}stable-request: Branch ${branchId} completed with status: ${success ? 'SUCCESS' : 'FAILURE'}`
        ),
        handleBranchDecision = (decision, branchResult, maxSerializableChars?) => {},
        maxSerializableChars = 1000,
        requestGroups = [],
        workflowHookParams = {},
        concurrentPhaseExecution = false,
        enableMixedExecution = false,
        enableBranchExecution = false,
        enableBranchRacing = false,
        enableNonLinearExecution = false,
        maxWorkflowIterations = 1000,
        branches,
        startPhaseIndex,
        ...commonGatewayOptions
    } = options;

    const workflowStartTime = Date.now();
    const workflowId = options.workflowId || `workflow-${Date.now()}`;
    const phaseResults: STABLE_WORKFLOW_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>['phases'] = [];
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    const workflowCircuitBreaker = commonGatewayOptions.circuitBreaker
        ? commonGatewayOptions.circuitBreaker instanceof CircuitBreaker
            ? commonGatewayOptions.circuitBreaker
            : new CircuitBreaker(commonGatewayOptions.circuitBreaker)
        : null;
    
    const commonGatewayOptionsWithBreaker = workflowCircuitBreaker
        ? { ...commonGatewayOptions, circuitBreaker: workflowCircuitBreaker }
        : commonGatewayOptions;

    const resolveStartPhaseIndex = () => {
        if (startPhaseIndex === undefined) {
            return 0;
        }

        if (startPhaseIndex < 0 || startPhaseIndex >= phases.length) {
            throw new Error(`stable-request: startPhaseIndex ${startPhaseIndex} is out of bounds for ${phases.length} phase(s)`);
        }

        let resolvedIndex = startPhaseIndex;
        if ((enableMixedExecution || enableNonLinearExecution) && phases[resolvedIndex]?.markConcurrentPhase) {
            while (resolvedIndex > 0 && phases[resolvedIndex - 1]?.markConcurrentPhase) {
                resolvedIndex--;
            }
        }

        return resolvedIndex;
    };

    try {
        if (enableBranchExecution && branches && branches.length > 0) {
            if (logPhaseResults) {
                console.info(
                    `${formatLogContext({ workflowId })}stable-request: Starting branch-based workflow execution with ${branches.length} branches`
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
                preBranchExecutionHook: options.preBranchExecutionHook,
                prePhaseExecutionHook: options.prePhaseExecutionHook,
                maxSerializableChars,
                workflowHookParams,
                sharedBuffer: options.sharedBuffer,
                stopOnFirstPhaseError,
                maxWorkflowIterations,
                enableBranchRacing
            });

            phaseResults.push(...branchResult.allPhaseResults);
            totalRequests = branchResult.totalRequests;
            successfulRequests = branchResult.successfulRequests;
            failedRequests = branchResult.failedRequests;

            const workflowExecutionTime = Date.now() - workflowStartTime;
            const workflowSuccess = failedRequests === 0;

            const result: STABLE_WORKFLOW_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType> = {
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

            result.metrics = MetricsAggregator.extractWorkflowMetrics(result);
            
            if (options.metricsGuardrails && result.metrics) {
                result.validation = MetricsValidator.validateWorkflowMetrics(
                    result.metrics,
                    options.metricsGuardrails
                );
            }
            
            const allResponses = phaseResults.flatMap(phase => phase.responses);
            result.requestGroupMetrics = MetricsAggregator.extractRequestGroupMetrics(allResponses);

            return result;
        }

        const resolvedStartIndex = resolveStartPhaseIndex();

        if (enableNonLinearExecution) {
            if (logPhaseResults) {
                console.info(
                    `${formatLogContext({ workflowId })}stable-request: Starting non-linear workflow execution with ${phases.length} phases`
                );
            }

            const nonLinearResult = await executeNonLinearWorkflow<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>({
                phases,
                startPhaseIndex: resolvedStartIndex,
                workflowId,
                commonGatewayOptions: commonGatewayOptionsWithBreaker,
                requestGroups,
                logPhaseResults,
                handlePhaseCompletion,
                handlePhaseError,
                handlePhaseDecision,
                prePhaseExecutionHook: options.prePhaseExecutionHook,
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

            const result: STABLE_WORKFLOW_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType> = {
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

            result.metrics = MetricsAggregator.extractWorkflowMetrics(result);
            
            if (options.metricsGuardrails && result.metrics) {
                result.validation = MetricsValidator.validateWorkflowMetrics(
                    result.metrics,
                    options.metricsGuardrails
                );
            }
            
            const allResponses = phaseResults.flatMap(phase => phase.responses);
            result.requestGroupMetrics = MetricsAggregator.extractRequestGroupMetrics(allResponses);

            if (logPhaseResults) {
                console.info(
                    `${formatLogContext({ workflowId })}stable-request: Non-linear workflow completed:`,
                    `${successfulRequests}/${totalRequests} requests successful`,
                    `across ${phaseResults.length} phase executions`,
                    `(${workflowExecutionTime}ms)`
                );

                if (nonLinearResult.terminatedEarly) {
                    console.info(
                        `${formatLogContext({ workflowId })}stable-request: Workflow terminated early: ${nonLinearResult.terminationReason}`
                    );
                }
            }

            return result;
        }

        const processPhaseResult = (phaseResult: STABLE_WORKFLOW_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>['phases'][number]) => {
            phaseResults.push(phaseResult);
            totalRequests += phaseResult.totalRequests;
            successfulRequests += phaseResult.successfulRequests;
            failedRequests += phaseResult.failedRequests;
        };

        const handlePhaseExecutionError = async (
            phaseId: string,
            phaseIndex: number,
            error: any,
            phase: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
        ) => {
            const items = phase.items || phase.functions || phase.requests || [];
            const phaseResult = {
                workflowId,
                phaseId,
                phaseIndex,
                success: false,
                executionTime: 0,
                timestamp: new Date().toISOString(),
                totalRequests: items.length,
                successfulRequests: 0,
                failedRequests: items.length,
                responses: [],
                error: error?.message || 'Phase execution failed'
            };

            processPhaseResult(phaseResult);

            if (logPhaseResults) {
                console.error(
                    `${formatLogContext({ workflowId, phaseId })}stable-request: Phase ${phaseId} failed:`,
                    error.message
                );
            }

            try {
                await executeWithPersistence<void>(
                    handlePhaseError, {
                        workflowId,
                        phaseResult,
                        error,
                        maxSerializableChars,
                        params: workflowHookParams?.handlePhaseErrorParams,
                        sharedBuffer: options.sharedBuffer
                    },
                    workflowHookParams?.statePersistence,
                    { workflowId },
                    options.sharedBuffer || {}
                );
            } catch (hookError) {
                console.error(
                    `${formatLogContext({ workflowId })}stable-request: Error in handlePhaseError hook:`,
                    hookError
                );
            }
        };

        if (enableMixedExecution && !concurrentPhaseExecution) {
            let i = resolvedStartIndex;
            while (i < phases.length) {
                const currentPhase = phases[i];
                const currentPhaseId = currentPhase.id || `phase-${i + 1}`;

                if (currentPhase.markConcurrentPhase) {
                    const concurrentGroup: { phase: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>; index: number }[] = [
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
                            `${formatLogContext({ workflowId })}stable-request: Executing concurrent group: [${phaseIds}]`
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
                            options.sharedBuffer,
                            undefined,
                            options.prePhaseExecutionHook
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
                                `${formatLogContext({ workflowId })}stable-request: Stopping workflow due to phase failure in concurrent group`
                            );
                        }
                        break;
                    }

                    i = j;
                } else {
                    if (logPhaseResults) {
                        console.info(
                            `${formatLogContext({ workflowId, phaseId: currentPhaseId })}stable-request: Starting Phase ${i + 1}/${phases.length}: ${currentPhaseId}`
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
                                    `${formatLogContext({ workflowId })}stable-request: Stopping workflow due to phase failure`
                                );
                            }
                            break;
                        }

                    } catch (phaseError: any) {
                        await handlePhaseExecutionError(currentPhaseId, i, phaseError, currentPhase);

                        if (stopOnFirstPhaseError) {
                            if (logPhaseResults) {
                                console.error(
                                    `${formatLogContext({ workflowId })}stable-request: Stopping workflow due to phase error`
                                );
                            }
                            break;
                        }
                    }

                    i++;
                }
            }
        } else if (concurrentPhaseExecution) {
            const phasesToExecute = phases.slice(resolvedStartIndex).map((phase, offset) => ({
                phase,
                index: resolvedStartIndex + offset
            }));

            const phasePromises = phasesToExecute.map(({ phase, index }) => 
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
                    options.sharedBuffer,
                    undefined,
                    options.prePhaseExecutionHook
                )
            );

            const settledPhases = await Promise.allSettled(phasePromises);

            for (let i = 0; i < settledPhases.length; i++) {
                const result = settledPhases[i];
                const { phase, index } = phasesToExecute[i];
                if (result.status === 'fulfilled') {
                    processPhaseResult(result.value);
                } else {
                    await handlePhaseExecutionError(
                        phase.id || `phase-${index + 1}`,
                        index,
                        result.reason,
                        phase
                    );
                }
            }
        } else {
            for (let i = resolvedStartIndex; i < phases.length; i++) {
                const phase = phases[i];
                const phaseId = phase.id || `phase-${i + 1}`;

                if (logPhaseResults) {
                    console.info(`${formatLogContext({ workflowId, phaseId })}stable-request: Starting Phase ${i + 1}/${phases.length}: ${phaseId}`);
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
                        options.sharedBuffer,
                        undefined,
                        options.prePhaseExecutionHook
                    );

                    processPhaseResult(phaseResult);

                    if (!phaseResult.success && stopOnFirstPhaseError) {
                        if (logPhaseResults) {
                            console.error(
                                `${formatLogContext({ workflowId })}stable-request: Stopping workflow due to phase error`
                            );
                        }
                        break;
                    }

                } catch (phaseError: any) {
                    await handlePhaseExecutionError(phaseId, i, phaseError, phase);

                    if (stopOnFirstPhaseError) {
                        if (logPhaseResults) {
                            console.error(
                                `${formatLogContext({ workflowId })}stable-request: Stopping workflow due to phase error`
                            );
                        }
                        break;
                    }
                }
            }
        }

        const workflowExecutionTime = Date.now() - workflowStartTime;
        const workflowSuccess = failedRequests === 0;

        const result: STABLE_WORKFLOW_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType> = {
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

        result.metrics = MetricsAggregator.extractWorkflowMetrics(result);
        
        if (options.metricsGuardrails && result.metrics) {
            result.validation = MetricsValidator.validateWorkflowMetrics(
                result.metrics,
                options.metricsGuardrails
            );
        }
        
        const allResponses = phaseResults.flatMap(phase => phase.responses);
        result.requestGroupMetrics = MetricsAggregator.extractRequestGroupMetrics(allResponses);

        if (logPhaseResults) {
            console.info(
                `${formatLogContext({ workflowId })}stable-request: Completed:`,
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
                `${formatLogContext({ workflowId })}stable-request: Fatal error:`,
                workflowError.message
            );
        }

        const errorResult: STABLE_WORKFLOW_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType> = {
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

        errorResult.metrics = MetricsAggregator.extractWorkflowMetrics(errorResult);
        
        if (options.metricsGuardrails && errorResult.metrics) {
            errorResult.validation = MetricsValidator.validateWorkflowMetrics(
                errorResult.metrics,
                options.metricsGuardrails
            );
        }

        return errorResult;
    }
}