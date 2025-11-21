import { 
    API_GATEWAY_REQUEST,
    CONCURRENT_REQUEST_EXECUTION_OPTIONS,
    SEQUENTIAL_REQUEST_EXECUTION_OPTIONS,
    STABLE_REQUEST
} from "../types/index.js";

export function prepareApiRequestOptions<RequestDataType = any, ResponseDataType = any>(
    request: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>,
    commonRequestExecutionOptions: CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType> | 
                                SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType>
): Omit<STABLE_REQUEST<RequestDataType, ResponseDataType>, 'reqData'> {
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