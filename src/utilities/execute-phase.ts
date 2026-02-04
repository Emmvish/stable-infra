import { stableApiGateway } from '../core/index.js';
import { executeWithPersistence } from './execute-with-persistence.js';
import { formatLogContext } from './format-log-context.js';
import { MetricsAggregator } from './metrics-aggregator.js';
import { MetricsValidator } from './metrics-validator.js';
import { RequestOrFunction } from '../enums/index.js';
import { BufferLike, STABLE_WORKFLOW_PHASE, STABLE_WORKFLOW_PHASE_RESULT, PrePhaseExecutionHookOptions, StableBufferTransactionLog } from '../types/index.js';

export async function executePhase<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
    phase: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>,
    phaseIndex: number,
    workflowId: string,
    commonGatewayOptions: any,
    requestGroups: any[],
    logPhaseResults: boolean,
    handlePhaseCompletion: Function,
    maxSerializableChars: number,
    workflowHookParams: any,
    sharedBuffer?: BufferLike,
    branchId?: string,
    prePhaseExecutionHook?: Function
) {
    const phaseId = phase.id || `phase-${phaseIndex + 1}`;

    if (phase.maxTimeout) {
        const timeoutPromise = new Promise<STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>>((_, reject) => {
            setTimeout(() => {
                const contextStr = `workflowId=${workflowId}${branchId ? `, branchId=${branchId}` : ''}, phaseId=${phaseId}`;
                reject(new Error(`stable-infra: Phase execution exceeded maxTimeout of ${phase.maxTimeout}ms [${contextStr}]`));
            }, phase.maxTimeout);
        });

        const executionPromise = executePhaseInternal(
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
            branchId,
            prePhaseExecutionHook
        );

        return Promise.race([executionPromise, timeoutPromise]);
    }

    return executePhaseInternal(
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
        branchId,
        prePhaseExecutionHook
    );
}

async function executePhaseInternal<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
    phase: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>,
    phaseIndex: number,
    workflowId: string,
    commonGatewayOptions: any,
    requestGroups: any[],
    logPhaseResults: boolean,
    handlePhaseCompletion: Function,
    maxSerializableChars: number,
    workflowHookParams: any,
    sharedBuffer?: BufferLike,
    branchId?: string,
    prePhaseExecutionHook?: Function
): Promise<STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>> {
    const phaseId = phase.id || `phase-${phaseIndex + 1}`;
    
    let modifiedPhase = phase;
    const transactionLogs: StableBufferTransactionLog[] | undefined = commonGatewayOptions?.transactionLogs;
    
    if (prePhaseExecutionHook) {
        try {
            const hookOptions: PrePhaseExecutionHookOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> = {
                workflowId,
                ...(branchId && { branchId }),
                phaseId,
                phaseIndex,
                phase: { ...phase },
                sharedBuffer,
                params: workflowHookParams?.prePhaseExecutionHookParams,
                transactionLogs
            };
            
            const result = await executeWithPersistence<STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>(
                prePhaseExecutionHook,
                hookOptions,
                phase.statePersistence,
                { workflowId, branchId, phaseId },
                sharedBuffer
            );
            if (result) {
                modifiedPhase = result;
                console.info(
                    `${formatLogContext({ workflowId, branchId, phaseId })}stable-infra: Phase configuration modified by prePhaseExecutionHook`
                );
            }
        } catch (error) {
            console.error(
                `${formatLogContext({ workflowId, branchId, phaseId })}stable-infra: Error in prePhaseExecutionHook:`,
                error
            );
        }
    }
    
    const phaseStartTime = Date.now();

    const phaseGatewayOptions = {
        ...commonGatewayOptions,
        ...(modifiedPhase.commonConfig || {}),
        concurrentExecution: modifiedPhase.concurrentExecution ?? true,
        stopOnFirstError: modifiedPhase.stopOnFirstError ?? false,
        requestGroups,
        sharedBuffer,
        executionContext: {
            workflowId,
            ...(branchId && { branchId }),
            phaseId
        }
    };

    if (modifiedPhase.maxConcurrentRequests !== undefined) {
        phaseGatewayOptions.maxConcurrentRequests = modifiedPhase.maxConcurrentRequests;
    }

    if (modifiedPhase.rateLimit !== undefined) {
        phaseGatewayOptions.rateLimit = modifiedPhase.rateLimit;
    }

    if (modifiedPhase.circuitBreaker !== undefined) {
        phaseGatewayOptions.circuitBreaker = modifiedPhase.circuitBreaker;
    }

    if (!phaseGatewayOptions.commonExecutionTimeout && commonGatewayOptions.commonExecutionTimeout) {
        phaseGatewayOptions.commonExecutionTimeout = commonGatewayOptions.commonExecutionTimeout;
    }

    let items: any = [];
    
    if (modifiedPhase.items) {
        items = modifiedPhase.items;
    } else if (modifiedPhase.functions) {
        items = modifiedPhase.functions.map(fn => ({
            type: RequestOrFunction.FUNCTION,
            function: fn
        }));
    } else if (modifiedPhase.requests) {
        items = modifiedPhase.requests;
    }
    
    const phaseResponses = await stableApiGateway<RequestDataType, ResponseDataType>(
        items,
        phaseGatewayOptions
    );

    const phaseExecutionTime = Date.now() - phaseStartTime;
    
    const responses = Array.from(phaseResponses);
    const phaseSuccessCount = responses.filter(r => r.success).length;
    const phaseFailureCount = responses.filter(r => !r.success).length;

        const phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType> = {
        workflowId,
        ...(branchId && { branchId }),
        phaseId,
        phaseIndex,
        success: phaseFailureCount === 0,
        executionTime: phaseExecutionTime,
        timestamp: new Date(phaseStartTime).toISOString(),
        totalRequests: responses.length,
        successfulRequests: phaseSuccessCount,
        failedRequests: phaseFailureCount,
        responses: responses
    };

    phaseResult.metrics = MetricsAggregator.extractPhaseMetrics(phaseResult);
    
    if (phaseResponses.metrics?.infrastructureMetrics) {
        phaseResult.infrastructureMetrics = phaseResponses.metrics.infrastructureMetrics;
    }
    
    if (modifiedPhase.metricsGuardrails && phaseResult.metrics) {
        phaseResult.validation = MetricsValidator.validatePhaseMetrics(
            phaseResult.metrics,
            modifiedPhase.metricsGuardrails
        );
    }

    if (logPhaseResults) {
        console.info(
            `${formatLogContext({ workflowId, branchId, phaseId })}stable-infra: Phase ${phaseId} completed:`,
            `${phaseSuccessCount}/${responses.length} successful`,
            `(${phaseExecutionTime}ms)`
        );
    }

    if (handlePhaseCompletion) {
        try {
            await executeWithPersistence<void>(
                handlePhaseCompletion, {
                    workflowId,
                    ...(branchId && { branchId }),
                    phaseResult,
                    maxSerializableChars,
                    params: workflowHookParams?.handlePhaseCompletionParams,
                    sharedBuffer,
                    transactionLogs
                },
                modifiedPhase.statePersistence,
                { workflowId, branchId, phaseId },
                sharedBuffer
            );
        } catch (hookError) {
            console.error(
                `${formatLogContext({ workflowId, branchId, phaseId })}stable-infra: Error in handlePhaseCompletion hook:`,
                hookError
            );
        }
    }

    return phaseResult;
}