import { 
    API_GATEWAY_REQUEST,
    CONCURRENT_REQUEST_EXECUTION_OPTIONS,
    SEQUENTIAL_REQUEST_EXECUTION_OPTIONS,
    STABLE_REQUEST
} from "../types/index.js";

type OptionMapping = {
    localKey: string;
    commonKey: string;
    targetKey: string;
};

const OPTION_MAPPINGS: OptionMapping[] = [
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

export function prepareApiRequestOptions<RequestDataType = any, ResponseDataType = any>(
    request: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>,
    commonRequestExecutionOptions: CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType> | 
                                SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType>
): Omit<STABLE_REQUEST<RequestDataType, ResponseDataType>, 'reqData'> {
    const { requestOptions: localOptions } = request;
    const result: Record<string, any> = {};

    for (const mapping of OPTION_MAPPINGS) {
        if (localOptions.hasOwnProperty(mapping.localKey)) {
            result[mapping.targetKey] = (localOptions as any)[mapping.localKey];
        } else if (commonRequestExecutionOptions.hasOwnProperty(mapping.commonKey)) {
            result[mapping.targetKey] = (commonRequestExecutionOptions as any)[mapping.commonKey];
        }
    }

    return result as Omit<STABLE_REQUEST<RequestDataType, ResponseDataType>, 'reqData'>;
}