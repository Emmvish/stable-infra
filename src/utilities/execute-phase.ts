import { stableApiGateway } from '../core/index.js';
import { executeWithPersistence } from './execute-with-persistence.js';
import { formatLogContext } from './format-log-context';
import { STABLE_WORKFLOW_PHASE, STABLE_WORKFLOW_PHASE_RESULT } from '../types/index.js';

export async function executePhase<RequestDataType = any, ResponseDataType = any>(
    phase: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>,
    phaseIndex: number,
    workflowId: string,
    commonGatewayOptions: any,
    requestGroups: any[],
    logPhaseResults: boolean,
    handlePhaseCompletion: Function,
    maxSerializableChars: number,
    workflowHookParams: any,
    sharedBuffer?: Record<string, any>,
    branchId?: string
) {
    const phaseId = phase.id || `phase-${phaseIndex + 1}`;
    const phaseStartTime = Date.now();

    const phaseGatewayOptions = {
        ...commonGatewayOptions,
        ...(phase.commonConfig || {}),
        concurrentExecution: phase.concurrentExecution ?? true,
        stopOnFirstError: phase.stopOnFirstError ?? false,
        requestGroups,
        sharedBuffer,
        executionContext: {
            workflowId,
            ...(branchId && { branchId }),
            phaseId
        }
    };

    if (phase.maxConcurrentRequests !== undefined) {
        phaseGatewayOptions.maxConcurrentRequests = phase.maxConcurrentRequests;
    }

    if (phase.rateLimit !== undefined) {
        phaseGatewayOptions.rateLimit = phase.rateLimit;
    }

    if (phase.circuitBreaker !== undefined) {
        phaseGatewayOptions.circuitBreaker = phase.circuitBreaker;
    }

    const phaseResponses = await stableApiGateway<RequestDataType, ResponseDataType>(
        phase.requests,
        phaseGatewayOptions
    );

    const phaseExecutionTime = Date.now() - phaseStartTime;
    const phaseSuccessCount = phaseResponses.filter(r => r.success).length;
    const phaseFailureCount = phaseResponses.filter(r => !r.success).length;

    const phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType> = {
        workflowId,
        ...(branchId && { branchId }),
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
            `${formatLogContext({ workflowId, branchId, phaseId })}stable-request: Phase ${phaseId} completed:`,
            `${phaseSuccessCount}/${phaseResponses.length} successful`,
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
                    sharedBuffer
                },
                phase.statePersistence,
                { workflowId, branchId, phaseId },
                sharedBuffer || {}
            );
        } catch (hookError) {
            console.error(
                `${formatLogContext({ workflowId, branchId, phaseId })}stable-request: Error in handlePhaseCompletion hook:`,
                hookError
            );
        }
    }

    return phaseResult;
}