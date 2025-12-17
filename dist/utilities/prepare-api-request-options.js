export function prepareApiRequestOptions(request, commonRequestExecutionOptions) {
    const { requestOptions: localOptions } = request;
    return {
        ...(localOptions.hasOwnProperty('resReq') ? { resReq: localOptions.resReq } : { resReq: commonRequestExecutionOptions.commonResReq }),
        ...(localOptions.hasOwnProperty('attempts') ? { attempts: localOptions.attempts } : { attempts: commonRequestExecutionOptions.commonAttempts }),
        ...(localOptions.hasOwnProperty('performAllAttempts') ? { performAllAttempts: localOptions.performAllAttempts } : { performAllAttempts: commonRequestExecutionOptions.commonPerformAllAttempts }),
        ...(localOptions.hasOwnProperty('wait') ? { wait: localOptions.wait } : { wait: commonRequestExecutionOptions.commonWait }),
        ...(localOptions.hasOwnProperty('retryStrategy') ? { retryStrategy: localOptions.retryStrategy } : { retryStrategy: commonRequestExecutionOptions.commonRetryStrategy }),
        ...(localOptions.hasOwnProperty('logAllErrors') ? { logAllErrors: localOptions.logAllErrors } : { logAllErrors: commonRequestExecutionOptions.commonLogAllErrors }),
        ...(localOptions.hasOwnProperty('logAllSuccessfulAttempts') ? { logAllSuccessfulAttempts: localOptions.logAllSuccessfulAttempts } : { logAllSuccessfulAttempts: commonRequestExecutionOptions.commonLogAllSuccessfulAttempts }),
        ...(localOptions.hasOwnProperty('maxSerializableChars') ? { maxSerializableChars: localOptions.maxSerializableChars } : { maxSerializableChars: commonRequestExecutionOptions.commonMaxSerializableChars }),
        ...(localOptions.hasOwnProperty('trialMode') ? { trialMode: localOptions.trialMode } : { trialMode: commonRequestExecutionOptions.commonTrialMode }),
        ...(localOptions.hasOwnProperty('responseAnalyzer') ? { responseAnalyzer: localOptions.responseAnalyzer } : { responseAnalyzer: commonRequestExecutionOptions.commonResponseAnalyzer }),
        ...(localOptions.hasOwnProperty('handleErrors') ? { handleErrors: localOptions.handleErrors } : { handleErrors: commonRequestExecutionOptions.commonHandleErrors }),
        ...(localOptions.hasOwnProperty('handleSuccessfulAttemptData') ? { handleSuccessfulAttemptData: localOptions.handleSuccessfulAttemptData } : { handleSuccessfulAttemptData: commonRequestExecutionOptions.commonHandleSuccessfulAttemptData }),
        ...(localOptions.hasOwnProperty('finalErrorAnalyzer') ? { finalErrorAnalyzer: localOptions.finalErrorAnalyzer } : { finalErrorAnalyzer: commonRequestExecutionOptions.commonFinalErrorAnalyzer }),
    };
}
//# sourceMappingURL=prepare-api-request-options.js.map