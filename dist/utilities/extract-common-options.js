export function extractCommonOptions(options) {
    const commonOptionKeys = [
        'commonRequestData',
        'commonResponseAnalyzer',
        'commonHandleErrors',
        'commonHandleSuccessfulAttemptData',
        'commonFinalErrorAnalyzer',
        'commonResReq',
        'commonAttempts',
        'commonPerformAllAttempts',
        'commonWait',
        'commonRetryStrategy',
        'commonLogAllErrors',
        'commonLogAllSuccessfulAttempts',
        'commonMaxSerializableChars',
        'commonTrialMode'
    ];
    const extracted = {};
    for (const key of commonOptionKeys) {
        if (options.hasOwnProperty(key)) {
            extracted[key] = options[key];
        }
    }
    return extracted;
}
//# sourceMappingURL=extract-common-options.js.map