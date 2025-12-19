import { ApiRequestOptionsMapping } from "../types/index.js";

export const PrepareApiRequestOptionsMapping: ApiRequestOptionsMapping[] = [
    { localKey: 'hookParams', commonKey: 'commonHookParams', groupCommonKey: 'commonHookParams', targetKey: 'hookParams' },
    { localKey: 'resReq', commonKey: 'commonResReq', groupCommonKey: 'commonResReq', targetKey: 'resReq' },
    { localKey: 'attempts', commonKey: 'commonAttempts', groupCommonKey: 'commonAttempts', targetKey: 'attempts' },
    { localKey: 'performAllAttempts', commonKey: 'commonPerformAllAttempts', groupCommonKey: 'commonPerformAllAttempts', targetKey: 'performAllAttempts' },
    { localKey: 'wait', commonKey: 'commonWait', groupCommonKey: 'commonWait', targetKey: 'wait' },
    { localKey: 'retryStrategy', commonKey: 'commonRetryStrategy', groupCommonKey: 'commonRetryStrategy', targetKey: 'retryStrategy' },
    { localKey: 'logAllErrors', commonKey: 'commonLogAllErrors', groupCommonKey: 'commonLogAllErrors', targetKey: 'logAllErrors' },
    { localKey: 'logAllSuccessfulAttempts', commonKey: 'commonLogAllSuccessfulAttempts', groupCommonKey: 'commonLogAllSuccessfulAttempts', targetKey: 'logAllSuccessfulAttempts' },
    { localKey: 'maxSerializableChars', commonKey: 'commonMaxSerializableChars', groupCommonKey: 'commonMaxSerializableChars', targetKey: 'maxSerializableChars' },
    { localKey: 'trialMode', commonKey: 'commonTrialMode', groupCommonKey: 'commonTrialMode', targetKey: 'trialMode' },
    { localKey: 'responseAnalyzer', commonKey: 'commonResponseAnalyzer', groupCommonKey: 'commonResponseAnalyzer', targetKey: 'responseAnalyzer' },
    { localKey: 'handleErrors', commonKey: 'commonHandleErrors', groupCommonKey: 'commonHandleErrors', targetKey: 'handleErrors' },
    { localKey: 'handleSuccessfulAttemptData', commonKey: 'commonHandleSuccessfulAttemptData', groupCommonKey: 'commonHandleSuccessfulAttemptData', targetKey: 'handleSuccessfulAttemptData' },
    { localKey: 'finalErrorAnalyzer', commonKey: 'commonFinalErrorAnalyzer', groupCommonKey: 'commonFinalErrorAnalyzer', targetKey: 'finalErrorAnalyzer' },
];