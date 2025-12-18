import { executeConcurrently, executeSequentially } from '../utilities/index.js';
export async function stableApiGateway(requests = [], options = {}) {
    const { concurrentExecution = true, stopOnFirstError = false, } = options;
    if (!Array.isArray(requests) || requests.length === 0) {
        return [];
    }
    const requestExecutionOptions = {
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
    };
    if (concurrentExecution) {
        return executeConcurrently(requests, { ...requestExecutionOptions, stopOnFirstError: undefined });
    }
    else {
        return executeSequentially(requests, requestExecutionOptions);
    }
}
//# sourceMappingURL=stable-api-gateway.js.map