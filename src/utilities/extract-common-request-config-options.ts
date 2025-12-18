import { API_GATEWAY_OPTIONS } from '../types/index.js';

export function extractCommonRequestConfigOptions<RequestDataType = any, ResponseDataType = any>(
    options: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>
) {
    const commonOptionKeys: (keyof API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>)[] = [
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

    const extracted: Record<string, any> = {};

    for (const key of commonOptionKeys) {
        if (options.hasOwnProperty(key)) {
            extracted[key] = options[key];
        }
    }

    return extracted;
}
