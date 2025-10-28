import { AxiosRequestConfig } from 'axios';

import { 
    REQUEST_METHODS,
    RESPONSE_ERRORS, 
    RETRY_STRATEGIES,
    VALID_REQUEST_PROTOCOLS
} from '../enums/index.js';

export interface ERROR_LOG {
  timestamp: string;
  executionTime: number;
  attempt: string;
  error: string;
  type: RESPONSE_ERROR_TYPES;
  isRetryable: boolean;
}


export interface ReqFnResponse {
  ok: boolean;
  isRetryable: boolean;
  timestamp: string;
  executionTime: number;
  error?: string;
  data?: any;
}

export type REQUEST_METHOD_TYPES =
  | REQUEST_METHODS.GET
  | REQUEST_METHODS.POST
  | REQUEST_METHODS.DELETE
  | REQUEST_METHODS.PATCH
  | REQUEST_METHODS.PUT;

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

export interface STABLE_REQUEST<RequestDataType = any, ResponseDataType = any> {
  reqData: REQUEST_DATA<RequestDataType>;
  responseAnalyzer?: (reqData: AxiosRequestConfig<RequestDataType>, data: ResponseDataType, trialMode?: TRIAL_MODE_OPTIONS) => boolean | Promise<boolean>;
  resReq?: boolean;
  attempts?: number;
  performAllAttempts?: boolean;
  wait?: number;
  retryStrategy?: RETRY_STRATEGY_TYPES;
  logAllErrors?: boolean;
  handleErrors?: (
    reqData: AxiosRequestConfig<RequestDataType>,
    error: ERROR_LOG,
    maxSerializableChars?: number
  ) => any | Promise<any>;
  logAllSuccessfulAttempts?: boolean;
  handleSuccessfulAttemptData?: (
    reqData: AxiosRequestConfig<RequestDataType>,
    successfulAttemptData: SUCCESSFUL_ATTEMPT_DATA,
    maxSerializableChars?: number
  ) => any | Promise<any>;
  maxSerializableChars?: number;
  finalErrorAnalyzer?: (reqData: AxiosRequestConfig<RequestDataType>, error: any, trialMode?: TRIAL_MODE_OPTIONS) => boolean | Promise<boolean>;
  trialMode?: TRIAL_MODE_OPTIONS;
}

export interface SUCCESSFUL_ATTEMPT_DATA {
  attempt: string;
  timestamp: string;
  executionTime: number;
  data: any;
}

export interface TRIAL_MODE_OPTIONS {
  enabled: boolean;
  reqFailureProbability?: number;
  retryFailureProbability?: number;
}

export type VALID_REQUEST_PROTOCOL_TYPES =
  | VALID_REQUEST_PROTOCOLS.HTTP
  | VALID_REQUEST_PROTOCOLS.HTTPS;