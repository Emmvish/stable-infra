import { AxiosRequestConfig } from 'axios';
import { REQUEST_METHODS, RESPONSE_ERRORS, RETRY_STRATEGIES, VALID_REQUEST_PROTOCOLS } from '../enums/index.js';
export interface API_GATEWAY_OPTIONS<RequestDataType = any, ResponseDataType = any> {
    commonAttempts?: number;
    commonPerformAllAttempts?: boolean;
    commonWait?: number;
    commonRetryStrategy?: RETRY_STRATEGY_TYPES;
    commonLogAllErrors?: boolean;
    commonLogAllSuccessfulAttempts?: boolean;
    commonMaxSerializableChars?: number;
    commonTrialMode?: TRIAL_MODE_OPTIONS;
    commonResponseAnalyzer?: (reqData: AxiosRequestConfig<RequestDataType>, data: ResponseDataType, trialMode?: TRIAL_MODE_OPTIONS) => boolean | Promise<boolean>;
    commonResReq?: boolean;
    commonFinalErrorAnalyzer?: (reqData: AxiosRequestConfig<RequestDataType>, error: any, trialMode?: TRIAL_MODE_OPTIONS) => boolean | Promise<boolean>;
    commonHandleErrors?: (reqData: AxiosRequestConfig<RequestDataType>, error: ERROR_LOG, maxSerializableChars?: number) => any | Promise<any>;
    commonHandleSuccessfulAttemptData?: (reqData: AxiosRequestConfig<RequestDataType>, successfulAttemptData: SUCCESSFUL_ATTEMPT_DATA<ResponseDataType>, maxSerializableChars?: number) => any | Promise<any>;
    concurrentExecution?: boolean;
    stopOnFirstError?: boolean;
}
export interface API_GATEWAY_REQUEST<RequestDataType = any, ResponseDataType = any> {
    id: string;
    requestOptions: STABLE_REQUEST<RequestDataType, ResponseDataType>;
}
export interface API_GATEWAY_RESPONSE<ResponseDataType = any> {
    id: string;
    success: boolean;
    data?: ResponseDataType;
    error?: string;
}
export type CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType = any, ResponseDataType = any> = Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, "concurrentExecution" | "stopOnFirstError">;
export interface ERROR_LOG {
    timestamp: string;
    executionTime: number;
    statusCode: number;
    attempt: string;
    error: string;
    type: RESPONSE_ERROR_TYPES;
    isRetryable: boolean;
}
export interface ReqFnResponse<ResponseDataType = any> {
    ok: boolean;
    isRetryable: boolean;
    timestamp: string;
    executionTime: number;
    error?: string;
    statusCode: number;
    data?: ResponseDataType | {
        trialMode: TRIAL_MODE_OPTIONS;
    };
}
export type REQUEST_METHOD_TYPES = REQUEST_METHODS.GET | REQUEST_METHODS.POST | REQUEST_METHODS.DELETE | REQUEST_METHODS.PATCH | REQUEST_METHODS.PUT;
export interface REQUEST_DATA<RequestDataType = any> {
    hostname: string;
    protocol?: VALID_REQUEST_PROTOCOL_TYPES;
    method?: REQUEST_METHOD_TYPES;
    path?: `/${string}`;
    port?: number;
    headers?: Record<string, any>;
    body?: RequestDataType;
    query?: Record<string, any>;
    timeout?: number;
    signal?: AbortSignal;
}
type RESPONSE_ERROR_TYPES = RESPONSE_ERRORS.HTTP_ERROR | RESPONSE_ERRORS.INVALID_CONTENT;
export type RETRY_STRATEGY_TYPES = RETRY_STRATEGIES.FIXED | RETRY_STRATEGIES.LINEAR | RETRY_STRATEGIES.EXPONENTIAL;
export type SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType = any, ResponseDataType = any> = Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, "concurrentExecution">;
export interface STABLE_REQUEST<RequestDataType = any, ResponseDataType = any> {
    reqData: REQUEST_DATA<RequestDataType>;
    responseAnalyzer?: (reqData: AxiosRequestConfig<RequestDataType>, data: ResponseDataType, trialMode?: TRIAL_MODE_OPTIONS) => boolean | Promise<boolean>;
    resReq?: boolean;
    attempts?: number;
    performAllAttempts?: boolean;
    wait?: number;
    retryStrategy?: RETRY_STRATEGY_TYPES;
    logAllErrors?: boolean;
    handleErrors?: (reqData: AxiosRequestConfig<RequestDataType>, error: ERROR_LOG, maxSerializableChars?: number) => any | Promise<any>;
    logAllSuccessfulAttempts?: boolean;
    handleSuccessfulAttemptData?: (reqData: AxiosRequestConfig<RequestDataType>, successfulAttemptData: SUCCESSFUL_ATTEMPT_DATA<ResponseDataType>, maxSerializableChars?: number) => any | Promise<any>;
    maxSerializableChars?: number;
    finalErrorAnalyzer?: (reqData: AxiosRequestConfig<RequestDataType>, error: any, trialMode?: TRIAL_MODE_OPTIONS) => boolean | Promise<boolean>;
    trialMode?: TRIAL_MODE_OPTIONS;
}
export interface SUCCESSFUL_ATTEMPT_DATA<ResponseDataType = any> {
    attempt: string;
    timestamp: string;
    executionTime: number;
    data: ResponseDataType;
    statusCode: number;
}
export interface TRIAL_MODE_OPTIONS {
    enabled: boolean;
    reqFailureProbability?: number;
    retryFailureProbability?: number;
}
export type VALID_REQUEST_PROTOCOL_TYPES = VALID_REQUEST_PROTOCOLS.HTTP | VALID_REQUEST_PROTOCOLS.HTTPS;
export {};
//# sourceMappingURL=index.d.ts.map