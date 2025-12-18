import {
    API_GATEWAY_OPTIONS,
    API_GATEWAY_REQUEST,
    CONCURRENT_REQUEST_EXECUTION_OPTIONS,
    SEQUENTIAL_REQUEST_EXECUTION_OPTIONS
} from '../types/index.js';
import { 
    executeConcurrently,
    executeSequentially
} from '../utilities/index.js';

export async function stableApiGateway<RequestDataType = any, ResponseDataType = any>(
    requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[] = [],
    options: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType> = {}
) {
    const {
        concurrentExecution = true,
        stopOnFirstError = false,
    } = options;

    if (!Array.isArray(requests) || requests.length === 0) {
        return [];
    }

    const requestExecutionOptions: CONCURRENT_REQUEST_EXECUTION_OPTIONS | SEQUENTIAL_REQUEST_EXECUTION_OPTIONS = {
        stopOnFirstError,
        ...(options.hasOwnProperty('commonRequestData') && { commonRequestData: options.commonRequestData }),
        ...(options.hasOwnProperty('commonResponseAnalyzer') && { commonResponseAnalyzer: options.commonResponseAnalyzer }),
        ...(options.hasOwnProperty('commonHandleErrors') && { commonHandleErrors: options.commonHandleErrors }),
        ...(options.hasOwnProperty('commonHandleSuccessfulAttemptData') && { commonHandleSuccessfulAttemptData: options.commonHandleSuccessfulAttemptData }),
        ...(options.hasOwnProperty('commonFinalErrorAnalyzer') && { commonFinalErrorAnalyzer: options.commonFinalErrorAnalyzer }),
        ...(options.hasOwnProperty('commonResReq') && { commonResReq: options.commonResReq }),
        ...(options.hasOwnProperty('commonAttempts') && { commonAttempts: options.commonAttempts }),
        ...(options.hasOwnProperty('commonPerformAllAttempts') && { commonPerformAllAttempts: options.commonPerformAllAttempts }),
        ...(options.hasOwnProperty('commonWait') && { commonWait: options.commonWait }),
        ...(options.hasOwnProperty('commonRetryStrategy') && { commonRetryStrategy: options.commonRetryStrategy }),
        ...(options.hasOwnProperty('commonLogAllErrors') && { commonLogAllErrors: options.commonLogAllErrors }),
        ...(options.hasOwnProperty('commonLogAllSuccessfulAttempts') && { commonLogAllSuccessfulAttempts: options.commonLogAllSuccessfulAttempts }),
        ...(options.hasOwnProperty('commonMaxSerializableChars') && { commonMaxSerializableChars: options.commonMaxSerializableChars }),
        ...(options.hasOwnProperty('commonTrialMode') && { commonTrialMode: options.commonTrialMode }),
    }

    if (concurrentExecution) {
        return executeConcurrently<RequestDataType, ResponseDataType>(requests,  { ...requestExecutionOptions, stopOnFirstError: undefined } as CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType>);
    } else {
        return executeSequentially<RequestDataType, ResponseDataType>(requests, requestExecutionOptions as SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType>);
    }
}