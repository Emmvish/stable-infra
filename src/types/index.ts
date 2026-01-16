import { AxiosRequestConfig } from 'axios';

import { 
  PHASE_DECISION_ACTIONS,
  REQUEST_METHODS,
  RESPONSE_ERRORS, 
  RETRY_STRATEGIES,
  VALID_REQUEST_PROTOCOLS,
  WorkflowEdgeConditionTypes,
  WorkflowNodeTypes,
  RequestOrFunction
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
  commonJitter?: number;
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
  commonStatePersistence?: StatePersistenceConfig;
  commonFunctionHookParams?: FunctionHookParams;
  commonFunctionResponseAnalyzer?: <TArgs extends any[], TReturn>(options: FunctionResponseAnalysisHookOptions<TArgs, TReturn>) => boolean | Promise<boolean>;
  commonReturnResult?: boolean;
  commonFinalFunctionErrorAnalyzer?: <TArgs extends any[]>(options: FinalFunctionErrorAnalysisHookOptions<TArgs>) => boolean | Promise<boolean>;
  commonHandleFunctionErrors?: <TArgs extends any[]>(
    options: HandleFunctionErrorHookOptions<TArgs>
  ) => any | Promise<any>;
  commonHandleSuccessfulFunctionAttemptData?: <TArgs extends any[], TReturn>(
    options: HandleSuccessfulFunctionAttemptDataHookOptions<TArgs, TReturn>
  ) => any | Promise<any>;
  commonFunctionPreExecution?: <TArgs extends any[], TReturn>(options: FunctionPreExecutionOptions<TArgs, TReturn>) => any;
  commonFunctionCache?: <TArgs extends any[], TReturn>(config: FunctionCacheConfig<TArgs, TReturn>) => any;
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

export type API_GATEWAY_FUNCTION_OPTIONS_TYPE<
  TArgs extends any[],
  TReturn
> =
  Omit<STABLE_FUNCTION<TArgs, TReturn>, 'fn' | 'args'> & {
    fn?: STABLE_FUNCTION<TArgs, TReturn>['fn'];
    args?: TArgs;
  };

export interface API_GATEWAY_FUNCTION<TArgs extends any[] = any[], TReturn = any> {
  id: string;
  groupId?: string;
  functionOptions: API_GATEWAY_FUNCTION_OPTIONS_TYPE<TArgs, TReturn>;
}

export type RequestOrFunctionType = RequestOrFunction.REQUEST | RequestOrFunction.FUNCTION;

export type API_GATEWAY_ITEM<RequestDataType = any, ResponseDataType = any, TArgs extends any[] = any[], TReturn = any> =
  | { type: RequestOrFunction.REQUEST; request: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType> }
  | { type: RequestOrFunction.FUNCTION; function: API_GATEWAY_FUNCTION<TArgs, TReturn> };
export interface API_GATEWAY_RESPONSE<ResponseDataType = any> {
  requestId: string;
  groupId?: string;
  success: boolean;
  data?: ResponseDataType;
  error?: string;
  type?: RequestOrFunctionType;
}

export interface API_GATEWAY_RESULT<ResponseDataType = any> extends Array<API_GATEWAY_RESPONSE<ResponseDataType>> {
  metrics?: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    failureRate: number;
    requestGroups?: RequestGroupMetrics[];
    infrastructureMetrics?: {
      circuitBreaker?: CircuitBreakerDashboardMetrics;
      cache?: CacheDashboardMetrics;
      rateLimiter?: RateLimiterDashboardMetrics;
      concurrencyLimiter?: ConcurrencyLimiterDashboardMetrics;
    };
  };
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

export interface FnExecResponse<TReturn = any> {
  ok: boolean;
  isRetryable: boolean;
  timestamp: string;
  executionTime: number;
  error?: string;
  data?: TReturn | { trialMode: TRIAL_MODE_OPTIONS };
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

export interface FunctionHookParams {
  responseAnalyzerParams?: any;
  handleSuccessfulAttemptDataParams?: any;
  handleErrorsParams?: any;
  finalErrorAnalyzerParams?: any;
}

interface FunctionObservabilityHooksOptions<TArgs extends any[] = any[]> {
  fn: (...args: TArgs) => any;
  args: TArgs;
  params?: any;
  maxSerializableChars?: number;
  preExecutionResult?: any;
  commonBuffer?: Record<string, any>;
  executionContext?: ExecutionContext;
}

interface FunctionAnalysisHookOptions<TArgs extends any[] = any[]> extends Omit<FunctionObservabilityHooksOptions<TArgs>, "maxSerializableChars"> {
  trialMode?: TRIAL_MODE_OPTIONS;
  params?: any;
  preExecutionResult?: any;
  executionContext?: ExecutionContext;
  commonBuffer?: Record<string, any>;
}

export interface FunctionResponseAnalysisHookOptions<TArgs extends any[] = any[], TReturn = any> extends FunctionAnalysisHookOptions<TArgs> {
  data: TReturn
}

export interface FinalFunctionErrorAnalysisHookOptions<TArgs extends any[] = any[]> extends FunctionAnalysisHookOptions<TArgs> {
  error: any
}

export interface HandleFunctionErrorHookOptions<TArgs extends any[] = any[]> extends FunctionObservabilityHooksOptions<TArgs> {
  errorLog: FUNCTION_ERROR_LOG
}

export interface HandleSuccessfulFunctionAttemptDataHookOptions<TArgs extends any[] = any[], TReturn = any> extends FunctionObservabilityHooksOptions<TArgs> {
  successfulAttemptData: SUCCESSFUL_FUNCTION_ATTEMPT_DATA<TReturn>
}

export interface PreExecutionHookOptions<RequestDataType = any, ResponseDataType = any> {
  inputParams?: any;
  commonBuffer?: Record<string, any>;
  stableRequestOptions: STABLE_REQUEST<RequestDataType, ResponseDataType>;
}

export interface FunctionPreExecutionHookOptions<TArgs extends any[] = any[], TReturn = any> {
  inputParams?: any;
  commonBuffer?: Record<string, any>;
  stableFunctionOptions: STABLE_FUNCTION<TArgs, TReturn>;
}

interface WorkflowPreExecutionHookOptions {
  params?: any;
  sharedBuffer?: Record<string, any>;
  workflowId: string;
  branchId?: string;
}

export interface PrePhaseExecutionHookOptions<RequestDataType = any, ResponseDataType = any> extends WorkflowPreExecutionHookOptions {
  phaseId: string;
  phaseIndex: number;
  phase: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>;
}

export interface PreBranchExecutionHookOptions<RequestDataType = any, ResponseDataType = any> extends Omit<WorkflowPreExecutionHookOptions, 'branchId'> {
  branchId: string;
  branchIndex: number;
  branch: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType>;
}

export interface RequestPreExecutionOptions<RequestDataType = any, ResponseDataType = any> {
  preExecutionHook: (options: PreExecutionHookOptions<RequestDataType, ResponseDataType>) => any | Promise<any>;
  preExecutionHookParams?: any;
  applyPreExecutionConfigOverride?: boolean;
  continueOnPreExecutionHookFailure?: boolean;
}

export interface FunctionPreExecutionOptions<TArgs extends any[] = any[], TReturn = any> {
  preExecutionHook: (options: FunctionPreExecutionHookOptions<TArgs, TReturn>) => any | Promise<any>;
  preExecutionHookParams?: any;
  applyPreExecutionConfigOverride?: boolean;
  continueOnPreExecutionHookFailure?: boolean;
}

export interface StatePersistenceOptions {
  executionContext: ExecutionContext;
  params?: any;
  buffer: Record<string, any>;
}

export interface StatePersistenceConfig {
  persistenceFunction: (options: StatePersistenceOptions) => Promise<Record<string, any>> | Record<string, any>;
  persistenceParams?: any;
  loadBeforeHooks?: boolean;
  storeAfterHooks?: boolean;
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
  jitter?: number;
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
  statePersistence?: StatePersistenceConfig;
}

export interface STABLE_FUNCTION<TArgs extends any[] = any[], TReturn = any> {
  fn: (...args: TArgs) => TReturn | Promise<TReturn>;
  args: TArgs;
  responseAnalyzer?: (options: FunctionResponseAnalysisHookOptions<TArgs, TReturn>) => boolean | Promise<boolean>;
  returnResult?: boolean;
  attempts?: number;
  performAllAttempts?: boolean;
  wait?: number;
  maxAllowedWait?: number;
  retryStrategy?: RETRY_STRATEGY_TYPES;
  jitter?: number;
  logAllErrors?: boolean;
  handleErrors?: (
    options: HandleFunctionErrorHookOptions<TArgs>
  ) => any | Promise<any>;
  logAllSuccessfulAttempts?: boolean;
  handleSuccessfulAttemptData?: (
    options: HandleSuccessfulFunctionAttemptDataHookOptions<TArgs, TReturn>
  ) => any | Promise<any>;
  maxSerializableChars?: number;
  finalErrorAnalyzer?: (options: FinalFunctionErrorAnalysisHookOptions<TArgs>) => boolean | Promise<boolean>;
  trialMode?: TRIAL_MODE_OPTIONS;
  hookParams?: FunctionHookParams;
  preExecution?: FunctionPreExecutionOptions<TArgs, TReturn>;
  commonBuffer?: Record<string, any>;
  cache?: FunctionCacheConfig<TArgs, TReturn>;
  executionContext?: ExecutionContext;
  circuitBreaker?: CircuitBreakerConfig | CircuitBreaker;
  statePersistence?: StatePersistenceConfig;
  rateLimit?: RateLimitConfig;
  maxConcurrentRequests?: number;
}

export interface STABLE_REQUEST_RESULT<ResponseDataType = any> {
  success: boolean;
  data?: ResponseDataType;
  error?: string;
  errorLogs?: ERROR_LOG[];
  successfulAttempts?: SUCCESSFUL_ATTEMPT_DATA<ResponseDataType>[];
  metrics?: {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    totalExecutionTime: number;
    averageAttemptTime: number;
    infrastructureMetrics?: {
      circuitBreaker?: CircuitBreakerDashboardMetrics;
      cache?: CacheDashboardMetrics;
    };
  };
}

export interface STABLE_FUNCTION_RESULT<TReturn = any> {
  success: boolean;
  data?: TReturn;
  error?: string;
  errorLogs?: FUNCTION_ERROR_LOG[];
  successfulAttempts?: SUCCESSFUL_FUNCTION_ATTEMPT_DATA<TReturn>[];
  metrics?: {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    totalExecutionTime: number;
    averageAttemptTime: number;
    infrastructureMetrics?: {
      circuitBreaker?: CircuitBreakerDashboardMetrics;
      cache?: CacheDashboardMetrics;
      rateLimiter?: RateLimiterDashboardMetrics;
      concurrencyLimiter?: ConcurrencyLimiterDashboardMetrics;
    };
  };
}

export interface SUCCESSFUL_ATTEMPT_DATA<ResponseDataType = any> {
  attempt: string;
  timestamp: string;
  executionTime: number;
  data: ResponseDataType;
  statusCode: number;
}

export interface SUCCESSFUL_FUNCTION_ATTEMPT_DATA<TReturn = any> {
  attempt: string;
  timestamp: string;
  executionTime: number;
  data: TReturn;
}

export interface FUNCTION_ERROR_LOG {
  timestamp: string;
  executionTime: number;
  attempt: string;
  error: string;
  isRetryable: boolean;
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
  requests?: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[];
  functions?: API_GATEWAY_FUNCTION<any[], any>[];
  items?: API_GATEWAY_ITEM<RequestDataType, ResponseDataType, any[], any>[];
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
  statePersistence?: StatePersistenceConfig;
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
  statePersistence?: StatePersistenceConfig;
  handlePhaseCompletion?: (
    options: HandlePhaseCompletionHookOptions<ResponseDataType>
  ) => any | Promise<any>;
  handlePhaseError?: (
    options: HandlePhaseErrorHookOptions<ResponseDataType>
  ) => any | Promise<any>;
  handlePhaseDecision?: (
    options: HandlePhaseDecisionHookOptions<ResponseDataType>
  ) => any | Promise<any>;
  handleBranchCompletion?: (
    options: HandleBranchCompletionHookOptions<ResponseDataType>
  ) => any | Promise<any>;
  handleBranchDecision?: (
    decision: BranchExecutionDecision,
    branchResult: BranchExecutionResult<ResponseDataType>,
    maxSerializableChars?: number
  ) => any | Promise<any>;
  prePhaseExecutionHook?: (
    options: PrePhaseExecutionHookOptions<RequestDataType, ResponseDataType>
  ) => STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType> | Promise<STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>>;
  preBranchExecutionHook?: (
    options: PreBranchExecutionHookOptions<RequestDataType, ResponseDataType>
  ) => STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType> | Promise<STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType>>;
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
  metrics?: PhaseMetrics;
  infrastructureMetrics?: {
    circuitBreaker?: CircuitBreakerDashboardMetrics;
    cache?: CacheDashboardMetrics;
    rateLimiter?: RateLimiterDashboardMetrics;
    concurrencyLimiter?: ConcurrencyLimiterDashboardMetrics;
  };
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
  metrics?: WorkflowMetrics;
  requestGroupMetrics?: RequestGroupMetrics[];
  infrastructureMetrics?: {
    circuitBreaker?: CircuitBreakerDashboardMetrics;
    cache?: CacheDashboardMetrics;
    rateLimiter?: RateLimiterDashboardMetrics;
    concurrencyLimiter?: ConcurrencyLimiterDashboardMetrics;
  };
}

export interface WorkflowHookParams {
  handlePhaseCompletionParams?: any;
  handlePhaseErrorParams?: any;
  handlePhaseDecisionParams?: any;
  handleBranchDecisionParams?: any;
  prePhaseExecutionHookParams?: any;
  preBranchExecutionHookParams?: any;
  statePersistence?: StatePersistenceConfig;
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

export interface HandlePhaseDecisionHookOptions<ResponseDataType = any> {
  decision: PhaseExecutionDecision;
  phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>;
  maxSerializableChars?: number;
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

export interface FunctionCacheConfig<TArgs extends any[] = any[], TReturn = any> {
  enabled: boolean;
  ttl?: number;
  maxSize?: number;
  keyGenerator?: (fn: (...args: TArgs) => any, args: TArgs) => string;
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
  addPhases?: STABLE_WORKFLOW_PHASE<any, any>[];
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
  concurrentPhaseResults?: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
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
  handlePhaseCompletion: (
    options: HandlePhaseCompletionHookOptions<ResponseDataType>
  ) => any | Promise<any>;
  handlePhaseError: (
    options: HandlePhaseErrorHookOptions<ResponseDataType>
  ) => any | Promise<any>;
  handlePhaseDecision?: (
    options: HandlePhaseDecisionHookOptions<ResponseDataType>
  ) => any | Promise<any>;
  prePhaseExecutionHook?: (
    options: PrePhaseExecutionHookOptions<RequestDataType, ResponseDataType>
  ) => STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType> | Promise<STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>>;
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
  statePersistence?: StatePersistenceConfig;
  commonConfig?: Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>, 
    'concurrentExecution' | 'stopOnFirstError' | 'requestGroups' | 'maxConcurrentRequests' | 'rateLimit' | 'circuitBreaker'>;
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
  addPhases?: STABLE_WORKFLOW_PHASE<any, any>[];
  addBranches?: STABLE_WORKFLOW_BRANCH<any, any>[];
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
  metrics?: BranchMetrics;
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

export interface HandleBranchCompletionHookOptions<ResponseDataType = any> {
  workflowId: string;
  branchId: string;
  branchResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>[];
  success: boolean;
  maxSerializableChars?: number;
}

export interface BranchWorkflowContext<RequestDataType = any, ResponseDataType = any> {
  branches: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType>[];
  workflowId: string;
  commonGatewayOptions: any;
  requestGroups: any[];
  logPhaseResults: boolean;
  handlePhaseCompletion: (
    options: HandlePhaseCompletionHookOptions<ResponseDataType>
  ) => any | Promise<any>;
  handlePhaseError: (
    options: HandlePhaseErrorHookOptions<ResponseDataType>
  ) => any | Promise<any>;
  handleBranchCompletion?: (
    options: HandleBranchCompletionHookOptions<ResponseDataType>
  ) => any | Promise<any>;
  handleBranchDecision?: (
    decision: BranchExecutionDecision,
    branchResult: BranchExecutionResult<ResponseDataType>,
    maxSerializableChars?: number
  ) => any | Promise<any>;
  preBranchExecutionHook?: (
    options: PreBranchExecutionHookOptions<RequestDataType, ResponseDataType>
  ) => STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType> | Promise<STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType>>;
  prePhaseExecutionHook?: (
    options: PrePhaseExecutionHookOptions<RequestDataType, ResponseDataType>
  ) => STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType> | Promise<STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>>;
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

export interface WorkflowMetrics {
  workflowId: string;
  success: boolean;
  executionTime: number;
  timestamp: string;
  totalPhases: number;
  completedPhases: number;
  skippedPhases: number;
  failedPhases: number;
  phaseCompletionRate: number;
  averagePhaseExecutionTime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestSuccessRate: number;
  requestFailureRate: number;
  terminatedEarly: boolean;
  terminationReason?: string;
  totalPhaseReplays: number;
  totalPhaseSkips: number;
  totalBranches?: number;
  completedBranches?: number;
  failedBranches?: number;
  branchSuccessRate?: number;
  throughput: number;
  averageRequestDuration?: number;
}

export interface BranchMetrics {
  branchId: string;
  branchIndex: number;
  executionNumber: number;
  success: boolean;
  executionTime: number;
  skipped: boolean;
  totalPhases: number;
  completedPhases: number;
  failedPhases: number;
  phaseCompletionRate: number; 
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestSuccessRate: number;
  hasDecision: boolean;
  decisionAction?: string;
  error?: string;
}

export interface PhaseMetrics {
  phaseId: string;
  phaseIndex: number;
  workflowId: string;
  branchId?: string;
  executionNumber: number;
  success: boolean;
  skipped: boolean;
  executionTime: number;
  timestamp: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestSuccessRate: number;
  requestFailureRate: number;
  hasDecision: boolean;
  decisionAction?: string;
  targetPhaseId?: string;
  replayCount?: number;
  error?: string;
}

export interface RequestGroupMetrics {
  groupId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  failureRate: number;
  requestIds: string[];
}

export interface RequestMetrics {
  requestId: string;
  groupId?: string;
  success: boolean;
  hasError: boolean;
  errorMessage?: string;
}

export interface CircuitBreakerDashboardMetrics {
  state: string;
  isHealthy: boolean;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  failurePercentage: number;
  stateTransitions: number;
  lastStateChangeTime: number;
  timeSinceLastStateChange: number;
  openCount: number;
  totalOpenDuration: number;
  averageOpenDuration: number;
  isCurrentlyOpen: boolean;
  openUntil: number | null;
  timeUntilRecovery: number | null;
  recoveryAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  recoverySuccessRate: number;
  config: {
    failureThresholdPercentage: number;
    minimumRequests: number;
    recoveryTimeoutMs: number;
    successThresholdPercentage: number;
    halfOpenMaxRequests: number;
  };
}

export interface CacheDashboardMetrics {
  isEnabled: boolean;
  currentSize: number;
  maxSize: number;
  validEntries: number;
  expiredEntries: number;
  utilizationPercentage: number;
  totalRequests: number;
  hits: number;
  misses: number;
  hitRate: number;
  missRate: number;
  sets: number;
  evictions: number;
  expirations: number;
  averageGetTime: number;
  averageSetTime: number;
  averageCacheAge: number;
  oldestEntryAge: number | null;
  newestEntryAge: number | null;
  networkRequestsSaved: number;
  cacheEfficiency: number;
}

export interface RateLimiterDashboardMetrics {
  maxRequests: number;
  windowMs: number;
  availableTokens: number;
  queueLength: number;
  requestsInCurrentWindow: number;
  totalRequests: number;
  completedRequests: number;
  throttledRequests: number;
  throttleRate: number;
  currentRequestRate: number;
  peakRequestRate: number;
  averageRequestRate: number;
  peakQueueLength: number;
  averageQueueWaitTime: number;
  isThrottling: boolean;
  utilizationPercentage: number;
}

export interface ConcurrencyLimiterDashboardMetrics {
  limit: number;
  running: number;
  queueLength: number;
  utilizationPercentage: number;
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  queuedRequests: number;
  successRate: number;
  peakConcurrency: number;
  averageConcurrency: number;
  concurrencyUtilization: number;
  peakQueueLength: number;
  averageQueueWaitTime: number;
  averageExecutionTime: number;
  isAtCapacity: boolean;
  hasQueuedRequests: boolean;
}

export interface SystemMetrics {
  workflow?: WorkflowMetrics;
  branches: BranchMetrics[];
  phases: PhaseMetrics[];
  requestGroups: RequestGroupMetrics[];
  requests: RequestMetrics[];
  circuitBreaker?: CircuitBreakerDashboardMetrics;
  cache?: CacheDashboardMetrics;
  rateLimiter?: RateLimiterDashboardMetrics;
  concurrencyLimiter?: ConcurrencyLimiterDashboardMetrics;
}

export type WorkflowNodeType = WorkflowNodeTypes.PHASE | WorkflowNodeTypes.BRANCH | WorkflowNodeTypes.CONDITIONAL | WorkflowNodeTypes.PARALLEL_GROUP | WorkflowNodeTypes.MERGE_POINT

export interface WorkflowGraph<RequestDataType = any, ResponseDataType = any> {
  nodes: Map<string, WorkflowNode<RequestDataType, ResponseDataType>>;
  edges: Map<string, WorkflowEdge[]>;
  entryPoint: string;
  exitPoints?: string[];
  metadata?: Record<string, any>;
}

export interface WorkflowNode<RequestDataType = any, ResponseDataType = any> {
  id: string;
  type: WorkflowNodeType;
  phase?: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>;
  branch?: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType>;
  condition?: ConditionalNode<ResponseDataType>;
  parallelNodes?: string[];
  waitForNodes?: string[];
  metadata?: Record<string, any>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: EdgeCondition;
  weight?: number;
  label?: string;
  metadata?: Record<string, any>;
}

export type EdgeConditionType = WorkflowEdgeConditionTypes.SUCCESS | WorkflowEdgeConditionTypes.FAILURE | WorkflowEdgeConditionTypes.CUSTOM | WorkflowEdgeConditionTypes.ALWAYS

export interface EdgeCondition {
  type: EdgeConditionType;
  evaluate?: (context: EdgeEvaluationContext) => boolean | Promise<boolean>;
}

export interface EdgeEvaluationContext {
  results: Map<string, STABLE_WORKFLOW_PHASE_RESULT<any>>;
  sharedBuffer?: Record<string, any>;
  executionHistory: PhaseExecutionRecord[];
  currentNodeId: string;
}

export interface ConditionalNode<ResponseDataType = any> {
  evaluate: (context: ConditionalEvaluationContext<ResponseDataType>) => string | Promise<string>;
}

export interface ConditionalEvaluationContext<ResponseDataType = any> {
  results: Map<string, STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>>;
  sharedBuffer?: Record<string, any>;
  executionHistory: PhaseExecutionRecord[];
  currentNodeId: string;
  phaseResult?: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType>;
}

export interface WorkflowGraphOptions<RequestDataType = any, ResponseDataType = any> 
  extends Omit<STABLE_WORKFLOW_OPTIONS<RequestDataType, ResponseDataType>, 'branches' | 'enableBranchExecution' | 'concurrentPhaseExecution' | 'enableMixedExecution' | 'enableNonLinearExecution'> {
  validateGraph?: boolean;
  optimizeExecution?: boolean;
  maxGraphDepth?: number;
}

export interface WorkflowGraphValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  cycles?: string[][];
  unreachableNodes?: string[];
  orphanNodes?: string[];
}

export interface WorkflowGraphExecutionPlan {
  orderedNodes: string[];
  parallelGroups: string[][];
  dependencies: Map<string, string[]>;
  estimatedDepth: number;
}