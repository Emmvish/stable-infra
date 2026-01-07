import { AxiosRequestConfig } from 'axios';

import { 
  PHASE_DECISION_ACTIONS,
  REQUEST_METHODS,
  RESPONSE_ERRORS, 
  RETRY_STRATEGIES,
  VALID_REQUEST_PROTOCOLS
} from '../enums/index.js';

import { CircuitBreaker } from '../utilities/index.js'

export interface ExecutionContext {
  workflowId?: string;
  branchId?: string;
  phaseId?: string;
  requestId?: string;
}

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
  commonCache?: CacheConfig;
  concurrentExecution?: boolean;
  requestGroups?: RequestGroup<RequestDataType, ResponseDataType>[];
  stopOnFirstError?: boolean;
  sharedBuffer?: Record<string, any>;
  maxConcurrentRequests?: number;
  rateLimit?: RateLimitConfig;
  circuitBreaker?: CircuitBreakerConfig;
  executionContext?: Partial<ExecutionContext>;
}

export interface RequestGroup<RequestDataType = any, ResponseDataType = any> {
  id: string;
  commonConfig?: Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, "concurrentExecution" | "stopOnFirstError" | "requestGroups" | "maxConcurrentRequests" | "rateLimit" | "circuitBreaker">
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

export type CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType = any, ResponseDataType = any> = Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, "concurrentExecution"> & {
  executionContext?: Partial<ExecutionContext>;
};

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
  data?: ResponseDataType | { trialMode: TRIAL_MODE_OPTIONS };
  fromCache?: boolean;
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

export type SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType = any, ResponseDataType = any> = Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, "concurrentExecution"> & {
  executionContext?: Partial<ExecutionContext>;
};

interface ObservabilityHooksOptions<RequestDataType = any> {
  reqData: AxiosRequestConfig<RequestDataType>;
  params?: any;
  maxSerializableChars?: number;
  preExecutionResult?: any;
  commonBuffer?: Record<string, any>;
  executionContext?: ExecutionContext;
}

interface AnalysisHookOptions<RequestDataType = any> extends Omit<ObservabilityHooksOptions<RequestDataType>, "maxSerializableChars"> {
  trialMode?: TRIAL_MODE_OPTIONS;
  params?: any;
  preExecutionResult?: any;
  executionContext?: ExecutionContext;
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
  cache?: CacheConfig;
  executionContext?: ExecutionContext;
  circuitBreaker?: CircuitBreakerConfig | CircuitBreaker;
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
  markConcurrentPhase?: boolean;
  maxConcurrentRequests?: number;
  rateLimit?: RateLimitConfig;
  circuitBreaker?: CircuitBreakerConfig;
  maxReplayCount?: number;
  allowReplay?: boolean;
  allowSkip?: boolean;
  phaseDecisionHook?: (
    options: PhaseDecisionHookOptions<ResponseDataType>
  ) => PhaseExecutionDecision | Promise<PhaseExecutionDecision>;
  commonConfig?: Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, 
    'concurrentExecution' | 'stopOnFirstError' | 'requestGroups' | "maxConcurrentRequests" | "rateLimit" | "circuitBreaker">;
  branchId?: string;
}

export interface STABLE_WORKFLOW_OPTIONS<RequestDataType = any, ResponseDataType = any> 
  extends Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, 
    'concurrentExecution' | 'stopOnFirstError'> {
  workflowId?: string;
  stopOnFirstPhaseError?: boolean;
  logPhaseResults?: boolean;
  concurrentPhaseExecution?: boolean;
  enableBranchExecution?: boolean;
  branches?: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType>[];
  enableMixedExecution?: boolean;
  enableNonLinearExecution?: boolean;
  maxWorkflowIterations?: number;
  handlePhaseCompletion?: (
    options: HandlePhaseCompletionHookOptions<ResponseDataType>
  ) => any | Promise<any>;
  handlePhaseError?: (
    options: HandlePhaseErrorHookOptions<ResponseDataType>
  ) => any | Promise<any>;
  handlePhaseDecision?: (
    decision: PhaseExecutionDecision,
    phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>
  ) => any | Promise<any>;
  handleBranchCompletion?: (
    options: {
      workflowId: string;
      branchId: string;
      branchResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
      success: boolean;
    }
  ) => any | Promise<any>;
  handleBranchDecision?: (
    decision: BranchExecutionDecision,
    branchResult: BranchExecutionResult<ResponseDataType>
  ) => any | Promise<any>;
  maxSerializableChars?: number;
  workflowHookParams?: WorkflowHookParams;
}

export interface STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType = any> {
  workflowId: string;
  branchId?: string;
  phaseId: string;
  phaseIndex: number;
  success: boolean;
  executionTime: number;
  timestamp: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  responses: API_GATEWAY_RESPONSE<ResponseDataType>[];
  executionNumber?: number;
  skipped?: boolean;
  decision?: PhaseExecutionDecision;
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
  executionHistory: PhaseExecutionRecord[];
  branches?: BranchExecutionResult<ResponseDataType>[];
  branchExecutionHistory?: BranchExecutionRecord[]; 
  terminatedEarly?: boolean;
  terminationReason?: string;
  error?: string;
}

export interface WorkflowHookParams {
  handlePhaseCompletionParams?: any;
  handlePhaseErrorParams?: any;
  handlePhaseDecisionParams?: any;
}

export interface HandlePhaseCompletionHookOptions<ResponseDataType = any> {
  workflowId: string;
  branchId?: string;
  phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>;
  maxSerializableChars?: number;
  params?: any;
  sharedBuffer?: Record<string, any>;}

export interface HandlePhaseErrorHookOptions<ResponseDataType = any> extends HandlePhaseCompletionHookOptions<ResponseDataType> {
  error: any;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface CircuitBreakerConfig {
  failureThresholdPercentage: number;
  minimumRequests: number;
  recoveryTimeoutMs: number;
  successThresholdPercentage?: number;
  halfOpenMaxRequests?: number;
  trackIndividualAttempts?: boolean;
}

export interface CacheConfig {
  enabled: boolean;
  ttl?: number;
  respectCacheControl?: boolean;
  cacheableStatusCodes?: number[];
  maxSize?: number;
  excludeMethods?: string[];
  keyGenerator?: (config: AxiosRequestConfig) => string;
}

export interface CachedResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, any>;
  timestamp: number;
  expiresAt: number;
}

export interface PhaseExecutionDecision {
  action: PHASE_DECISION_ACTIONS;
  targetPhaseId?: string;
  replayCount?: number;
  metadata?: Record<string, any>;
}

export interface PhaseDecisionHookOptions<ResponseDataType = any> {
  workflowId: string;
  branchId?: string;
  phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>;
  phaseId: string;
  phaseIndex: number;
  executionHistory: PhaseExecutionRecord[];
  sharedBuffer?: Record<string, any>;
  params?: any;
  concurrentPhaseResults?: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[]; // Available when phase is part of concurrent group
}

export interface PhaseExecutionRecord {
  phaseId: string;
  phaseIndex: number;
  executionNumber: number;
  timestamp: string;
  success: boolean;
  executionTime: number;
  decision?: PhaseExecutionDecision;
}

export interface NonLinearWorkflowContext<RequestDataType, ResponseDataType> {
  phases: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>[];
  workflowId: string;
  branchId?: string;
  commonGatewayOptions: any;
  requestGroups: any[];
  logPhaseResults: boolean;
  handlePhaseCompletion: Function;
  handlePhaseError: Function;
  handlePhaseDecision?: Function;
  maxSerializableChars: number;
  workflowHookParams: any;
  sharedBuffer?: Record<string, any>;
  stopOnFirstPhaseError: boolean;
  maxWorkflowIterations: number;
}

export interface EXECUTE_NON_LINEAR_WORKFLOW_RESPONSE<ResponseDataType = any> {
  phaseResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
  executionHistory: PhaseExecutionRecord[];
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  terminatedEarly: boolean;
  terminationReason?: string;
}

export interface STABLE_WORKFLOW_BRANCH<RequestDataType = any, ResponseDataType = any> {
  id: string;
  phases: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>[];
  markConcurrentBranch?: boolean;
  allowReplay?: boolean;
  maxReplayCount?: number;
  allowSkip?: boolean;
  branchDecisionHook?: (
    options: BranchDecisionHookOptions<ResponseDataType>
  ) => BranchExecutionDecision | Promise<BranchExecutionDecision>;
  commonConfig?: Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, 
    'concurrentExecution' | 'stopOnFirstError' | 'requestGroups' | 'maxConcurrentRequests' | 'rateLimit' | 'circuitBreaker'>; // Branch-level config overrides workflow config
}

export interface BranchDecisionHookOptions<ResponseDataType = any> {
  workflowId: string;
  branchResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
  branchId: string;
  branchIndex: number;
  executionNumber: number;
  executionHistory: PhaseExecutionRecord[];
  branchExecutionHistory: BranchExecutionRecord[];
  sharedBuffer?: Record<string, any>;
  params?: any;
  concurrentBranchResults?: BranchExecutionResult<ResponseDataType>[];
}

export interface BranchExecutionDecision {
  action: PHASE_DECISION_ACTIONS;
  targetBranchId?: string;
  metadata?: Record<string, any>;
}

export interface BranchExecutionResult<ResponseDataType = any> {
  workflowId: string;
  branchId: string;
  branchIndex: number;
  success: boolean;
  executionTime: number;
  completedPhases: number;
  phaseResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
  decision?: BranchExecutionDecision;
  executionNumber: number;
  skipped?: boolean;
  error?: string;
}

export interface BranchExecutionRecord {
  branchId: string;
  branchIndex: number;
  executionNumber: number;
  timestamp: string;
  success: boolean;
  executionTime: number;
  decision?: BranchExecutionDecision;
}

export interface BranchWorkflowContext<RequestDataType = any, ResponseDataType = any> {
  branches: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType>[];
  workflowId: string;
  commonGatewayOptions: any;
  requestGroups: any[];
  logPhaseResults: boolean;
  handlePhaseCompletion: Function;
  handlePhaseError: Function;
  handleBranchCompletion?: Function;
  handleBranchDecision?: Function;
  maxSerializableChars: number;
  workflowHookParams: any;
  sharedBuffer?: Record<string, any>;
  stopOnFirstPhaseError: boolean;
  maxWorkflowIterations: number;
}

export interface EXECUTE_BRANCH_WORKFLOW_RESPONSE<ResponseDataType = any> {
  branchResults: BranchExecutionResult<ResponseDataType>[];
  allPhaseResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
  executionHistory: PhaseExecutionRecord[];
  branchExecutionHistory: BranchExecutionRecord[];
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  terminatedEarly: boolean;
  terminationReason?: string;
}