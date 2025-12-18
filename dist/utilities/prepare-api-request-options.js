const OPTION_MAPPINGS = [
    { localKey: 'resReq', commonKey: 'commonResReq', targetKey: 'resReq' },
    { localKey: 'attempts', commonKey: 'commonAttempts', targetKey: 'attempts' },
    { localKey: 'performAllAttempts', commonKey: 'commonPerformAllAttempts', targetKey: 'performAllAttempts' },
    { localKey: 'wait', commonKey: 'commonWait', targetKey: 'wait' },
    { localKey: 'retryStrategy', commonKey: 'commonRetryStrategy', targetKey: 'retryStrategy' },
    { localKey: 'logAllErrors', commonKey: 'commonLogAllErrors', targetKey: 'logAllErrors' },
    { localKey: 'logAllSuccessfulAttempts', commonKey: 'commonLogAllSuccessfulAttempts', targetKey: 'logAllSuccessfulAttempts' },
    { localKey: 'maxSerializableChars', commonKey: 'commonMaxSerializableChars', targetKey: 'maxSerializableChars' },
    { localKey: 'trialMode', commonKey: 'commonTrialMode', targetKey: 'trialMode' },
    { localKey: 'responseAnalyzer', commonKey: 'commonResponseAnalyzer', targetKey: 'responseAnalyzer' },
    { localKey: 'handleErrors', commonKey: 'commonHandleErrors', targetKey: 'handleErrors' },
    { localKey: 'handleSuccessfulAttemptData', commonKey: 'commonHandleSuccessfulAttemptData', targetKey: 'handleSuccessfulAttemptData' },
    { localKey: 'finalErrorAnalyzer', commonKey: 'commonFinalErrorAnalyzer', targetKey: 'finalErrorAnalyzer' },
];
export function prepareApiRequestOptions(request, commonRequestExecutionOptions) {
    const { requestOptions: localOptions } = request;
    const result = {};
    for (const mapping of OPTION_MAPPINGS) {
        if (localOptions.hasOwnProperty(mapping.localKey)) {
            result[mapping.targetKey] = localOptions[mapping.localKey];
        }
        else if (commonRequestExecutionOptions.hasOwnProperty(mapping.commonKey)) {
            result[mapping.targetKey] = commonRequestExecutionOptions[mapping.commonKey];
        }
    }
    return result;
}
//# sourceMappingURL=prepare-api-request-options.js.map