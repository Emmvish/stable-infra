import { AxiosRequestConfig } from 'axios';

import { 
  REQUEST_METHODS,
  RESPONSE_ERRORS, 
  RETRY_STRATEGIES,
  VALID_REQUEST_PROTOCOLS
} from '../enums/index.js';

export interface API_GATEWAY_OPTIONS<RequestDataType = any, ResponseDataType = any> {
  commonRequestData?: Partial<REQUEST_DATA<RequestDataType>>;
  commonAttempts?: number;
  commonHookParams?: HookParams;
  commonPerformAllAttempts?: boolean;
  commonWait?: number;
  commonMaxAllowedWait?: number;
  commonRetryStrategy?: RETRY_STRATEGY_TYPES;
  commonLogAllErrors?: boolean;
  commonLogAllSuccessfulAttempts?: boolean;
  commonMaxSerializableChars?: number;
  commonTrialMode?: TRIAL_MODE_OPTIONS;
  commonResponseAnalyzer?: (options: ResponseAnalysisHookOptions<RequestDataType, ResponseDataType>) => boolean | Promise<boolean>;
  commonResReq?: boolean;
  commonFinalErrorAnalyzer?: (options: FinalErrorAnalysisHookOptions<RequestDataType>) => boolean | Promise<boolean>;
  commonHandleErrors?: (
    options: HandleErrorHookOptions<RequestDataType>
  ) => any | Promise<any>;
  commonHandleSuccessfulAttemptData?: (
    options: HandleSuccessfulAttemptDataHookOptions<RequestDataType, ResponseDataType>
  ) => any | Promise<any>;
  commonPreExecution?: RequestPreExecutionOptions;
  concurrentExecution?: boolean;
  requestGroups?: RequestGroup<RequestDataType, ResponseDataType>[];
  stopOnFirstError?: boolean;
  sharedBuffer?: Record<string, any>;
}

export type API_GATEWAY_REQUEST_OPTIONS_TYPE<
  RequestDataType,
  ResponseDataType
> =
  Omit<STABLE_REQUEST<RequestDataType, ResponseDataType>, 'reqData'> & {
    reqData?: Partial<STABLE_REQUEST<RequestDataType, ResponseDataType>['reqData']>;
  };

export interface API_GATEWAY_REQUEST<RequestDataType = any, ResponseDataType = any> {
  id: string;
  groupId?: string;
  requestOptions: API_GATEWAY_REQUEST_OPTIONS_TYPE<RequestDataType, ResponseDataType>;
}

export interface API_GATEWAY_RESPONSE<ResponseDataType = any> {
  requestId: string;
  groupId?: string;
  success: boolean;
  data?: ResponseDataType;
  error?: string;
}

export type ApiRequestOptionsMapping = {
  localKey: string;
  commonKey: string;
  groupCommonKey: string;
  targetKey: string;
};

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

export interface RequestGroup<RequestDataType = any, ResponseDataType = any> {
  id: string;
  commonConfig?: Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, "concurrentExecution" | "stopOnFirstError">
}

export interface ReqFnResponse<ResponseDataType = any> {
  ok: boolean;
  isRetryable: boolean;
  timestamp: string;
  executionTime: number;
  error?: string;
  statusCode: number;
  data?: ResponseDataType | { trialMode: TRIAL_MODE_OPTIONS };
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

export type SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType = any, ResponseDataType = any> = Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, "concurrentExecution">

interface ObservabilityHooksOptions<RequestDataType = any> {
  reqData: AxiosRequestConfig<RequestDataType>;
  params?: any;
  maxSerializableChars?: number;
  preExecutionResult?: any;
  commonBuffer?: Record<string, any>;
}

interface AnalysisHookOptions<RequestDataType = any> extends Omit<ObservabilityHooksOptions<RequestDataType>, "maxSerializableChars"> {
  trialMode?: TRIAL_MODE_OPTIONS;
  params?: any;
  preExecutionResult?: any;
  commonBuffer?: Record<string, any>;
}

export interface ResponseAnalysisHookOptions<RequestDataType = any, ResponseDataType = any> extends AnalysisHookOptions<RequestDataType> {
  data: ResponseDataType
}

export interface FinalErrorAnalysisHookOptions<RequestDataType = any> extends AnalysisHookOptions<RequestDataType> {
  error: any
}

export interface HandleErrorHookOptions<RequestDataType = any> extends ObservabilityHooksOptions<RequestDataType> {
  errorLog: ERROR_LOG
}

export interface HandleSuccessfulAttemptDataHookOptions<RequestDataType = any, ResponseDataType = any> extends ObservabilityHooksOptions<RequestDataType> {
  successfulAttemptData: SUCCESSFUL_ATTEMPT_DATA<ResponseDataType>
}

export interface HookParams {
  responseAnalyzerParams?: any;
  handleSuccessfulAttemptDataParams?: any;
  handleErrorsParams?: any;
  finalErrorAnalyzerParams?: any;
}

export interface PreExecutionHookOptions {
  inputParams?: any;
  commonBuffer?: Record<string, any>;
}

export interface RequestPreExecutionOptions {
  preExecutionHook: ({ inputParams, commonBuffer }: PreExecutionHookOptions) => any | Promise<any>;
  preExecutionHookParams?: any;
  applyPreExecutionConfigOverride?: boolean;
  continueOnPreExecutionHookFailure?: boolean;
}

export interface STABLE_REQUEST<RequestDataType = any, ResponseDataType = any> {
  reqData: REQUEST_DATA<RequestDataType>;
  responseAnalyzer?: (options: ResponseAnalysisHookOptions<RequestDataType, ResponseDataType>) => boolean | Promise<boolean>;
  resReq?: boolean;
  attempts?: number;
  performAllAttempts?: boolean;
  wait?: number;
  maxAllowedWait?: number;
  retryStrategy?: RETRY_STRATEGY_TYPES;
  logAllErrors?: boolean;
  handleErrors?: (
    options: HandleErrorHookOptions<RequestDataType>
  ) => any | Promise<any>;
  logAllSuccessfulAttempts?: boolean;
  handleSuccessfulAttemptData?: (
    options: HandleSuccessfulAttemptDataHookOptions<RequestDataType, ResponseDataType>
  ) => any | Promise<any>;
  maxSerializableChars?: number;
  finalErrorAnalyzer?: (options: FinalErrorAnalysisHookOptions<RequestDataType>) => boolean | Promise<boolean>;
  trialMode?: TRIAL_MODE_OPTIONS;
  hookParams?: HookParams;
  preExecution?: RequestPreExecutionOptions;
  commonBuffer?: Record<string, any>;
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

export type VALID_REQUEST_PROTOCOL_TYPES =
  | VALID_REQUEST_PROTOCOLS.HTTP
  | VALID_REQUEST_PROTOCOLS.HTTPS;

export interface STABLE_WORKFLOW_PHASE<RequestDataType = any, ResponseDataType = any> {
  id?: string;
  requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[];
  concurrentExecution?: boolean;
  stopOnFirstError?: boolean;
  commonConfig?: Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, 
    'concurrentExecution' | 'stopOnFirstError' | 'requestGroups'>;
}

export interface STABLE_WORKFLOW_OPTIONS<RequestDataType = any, ResponseDataType = any> 
  extends Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, 
    'concurrentExecution' | 'stopOnFirstError'> {
  workflowId?: string;
  stopOnFirstPhaseError?: boolean;
  logPhaseResults?: boolean;
  handlePhaseCompletion?: (
    options: HandlePhaseCompletionHookOptions<ResponseDataType>
  ) => any | Promise<any>;
  handlePhaseError?: (
    options: HandlePhaseErrorHookOptions<ResponseDataType>
  ) => any | Promise<any>;
  maxSerializableChars?: number;
  workflowHookParams?: WorkflowHookParams;
}

export interface STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType = any> {
  phaseId: string;
  phaseIndex: number;
  success: boolean;
  executionTime: number;
  timestamp: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  responses: API_GATEWAY_RESPONSE<ResponseDataType>[];
  error?: string;
}

export interface STABLE_WORKFLOW_RESULT<ResponseDataType = any> {
  workflowId: string;
  success: boolean;
  executionTime: number;
  timestamp: string;
  totalPhases: number;
  completedPhases: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  phases: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
  error?: string;
}

export interface WorkflowHookParams {
  handlePhaseCompletionParams?: any;
  handlePhaseErrorParams?: any;
}

export interface HandlePhaseCompletionHookOptions<ResponseDataType = any> {
  workflowId: string;
  phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>;
  maxSerializableChars?: number;
  params?: any;
  sharedBuffer?: Record<string, any>;}

export interface HandlePhaseErrorHookOptions<ResponseDataType = any> extends HandlePhaseCompletionHookOptions<ResponseDataType> {
  error: any;
}