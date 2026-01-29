import { AxiosRequestConfig } from 'axios';

import { 
  PHASE_DECISION_ACTIONS,
  REQUEST_METHODS,
  RESPONSE_ERRORS, 
  RETRY_STRATEGIES,
  VALID_REQUEST_PROTOCOLS,
  WorkflowEdgeConditionTypes,
  WorkflowNodeTypes,
  RequestOrFunction,
  AnomalySeverity,
  ViolationType,
  PersistenceStage,
  RunnerJobs,
  ScheduleTypes
} from '../enums/index.js';

import { CircuitBreaker } from '../utilities/index.js';

export type CreateHash = (algorithm: string) => { update: (data: string) => { digest: (encoding: 'hex') => string } };
export type NodeCryptoLike = { createHash?: CreateHash };

export interface MetricGuardrail {
  min?: number;
  max?: number;
  expected?: number;
  tolerance?: number;
}

export interface MetricsGuardrailsRequest {
  totalAttempts?: MetricGuardrail;
  successfulAttempts?: MetricGuardrail;
  failedAttempts?: MetricGuardrail;
  totalExecutionTime?: MetricGuardrail;
  averageAttemptTime?: MetricGuardrail;
}

export interface MetricsGuardrailsApiGateway {
  totalRequests?: MetricGuardrail;
  successfulRequests?: MetricGuardrail;
  failedRequests?: MetricGuardrail;
  successRate?: MetricGuardrail;
  failureRate?: MetricGuardrail;
  executionTime?: MetricGuardrail;
  throughput?: MetricGuardrail;
  averageRequestDuration?: MetricGuardrail;
}

export interface MetricsGuardrailsWorkflow {
  totalPhases?: MetricGuardrail;
  completedPhases?: MetricGuardrail;
  failedPhases?: MetricGuardrail;
  totalRequests?: MetricGuardrail;
  successfulRequests?: MetricGuardrail;
  failedRequests?: MetricGuardrail;
  requestSuccessRate?: MetricGuardrail;
  requestFailureRate?: MetricGuardrail;
  executionTime?: MetricGuardrail;
  averagePhaseExecutionTime?: MetricGuardrail;
  throughput?: MetricGuardrail;
  phaseCompletionRate?: MetricGuardrail;
}

export interface MetricsGuardrailsPhase {
  totalRequests?: MetricGuardrail;
  successfulRequests?: MetricGuardrail;
  failedRequests?: MetricGuardrail;
  requestSuccessRate?: MetricGuardrail;
  requestFailureRate?: MetricGuardrail;
  executionTime?: MetricGuardrail;
}

export interface MetricsGuardrailsBranch {
  totalPhases?: MetricGuardrail;
  completedPhases?: MetricGuardrail;
  failedPhases?: MetricGuardrail;
  totalRequests?: MetricGuardrail;
  successfulRequests?: MetricGuardrail;
  failedRequests?: MetricGuardrail;
  requestSuccessRate?: MetricGuardrail;
  requestFailureRate?: MetricGuardrail;
  executionTime?: MetricGuardrail;
  phaseCompletionRate?: MetricGuardrail;
}

export interface MetricsGuardrailsCircuitBreaker {
  failureRate?: MetricGuardrail;
  totalRequests?: MetricGuardrail;
  failedRequests?: MetricGuardrail;
}

export interface MetricsGuardrailsCache {
  hitRate?: MetricGuardrail;
  missRate?: MetricGuardrail;
  utilizationPercentage?: MetricGuardrail;
  evictionRate?: MetricGuardrail;
}

export interface MetricsGuardrailsRateLimiter {
  throttleRate?: MetricGuardrail;
  queueLength?: MetricGuardrail;
  utilizationPercentage?: MetricGuardrail;
  averageQueueWaitTime?: MetricGuardrail;
}

export interface MetricsGuardrailsConcurrencyLimiter {
  utilizationPercentage?: MetricGuardrail;
  queueLength?: MetricGuardrail;
  averageQueueWaitTime?: MetricGuardrail;
}

export interface MetricsGuardrailsInfrastructure {
  circuitBreaker?: MetricsGuardrailsCircuitBreaker;
  cache?: MetricsGuardrailsCache;
  rateLimiter?: MetricsGuardrailsRateLimiter;
  concurrencyLimiter?: MetricsGuardrailsConcurrencyLimiter;
}

export interface MetricsGuardrailsCommon {
  successRate?: MetricGuardrail;
  failureRate?: MetricGuardrail;
  executionTime?: MetricGuardrail;
  throughput?: MetricGuardrail;
}

export interface MetricsGuardrailsScheduler {
  totalJobs?: MetricGuardrail;
  queued?: MetricGuardrail;
  running?: MetricGuardrail;
  completed?: MetricGuardrail;
  failed?: MetricGuardrail;
  dropped?: MetricGuardrail;
  totalRuns?: MetricGuardrail;
  successRate?: MetricGuardrail;
  failureRate?: MetricGuardrail;
  throughput?: MetricGuardrail;
  averageExecutionTime?: MetricGuardrail;
  averageQueueDelay?: MetricGuardrail;
}

export interface MetricsGuardrails {
  request?: MetricsGuardrailsRequest;
  apiGateway?: MetricsGuardrailsApiGateway;
  workflow?: MetricsGuardrailsWorkflow;
  phase?: MetricsGuardrailsPhase;
  branch?: MetricsGuardrailsBranch;
  infrastructure?: MetricsGuardrailsInfrastructure;
  common?: MetricsGuardrailsCommon;
  scheduler?: MetricsGuardrailsScheduler;
}

export interface MetricAnomaly {
  metricName: string;
  metricValue: number;
  guardrail: MetricGuardrail;
  severity: AnomalySeverity;
  reason: string;
  violationType: ViolationType;
}

export interface MetricsValidationResult {
  isValid: boolean;
  anomalies: MetricAnomaly[];
  validatedAt: string;
}

export interface SchedulerMetrics {
  totalJobs: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  dropped: number;
  totalRuns: number;
  successRate: number;
  failureRate: number;
  throughput: number;
  averageExecutionTime: number;
  averageQueueDelay: number;
  startedAt?: string;
  lastUpdated: string;
}

export interface ExecutionContext {
  workflowId?: string;
  branchId?: string;
  phaseId?: string;
  requestId?: string;
}

export interface API_GATEWAY_OPTIONS<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
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
  commonExecutionTimeout?: number;
  commonFunctionHookParams?: FunctionHookParams;
  commonFunctionResponseAnalyzer?: (options: FunctionResponseAnalysisHookOptions<FunctionArgsType, FunctionReturnType>) => boolean | Promise<boolean>;
  commonReturnResult?: boolean;
  commonFinalFunctionErrorAnalyzer?: (options: FinalFunctionErrorAnalysisHookOptions<FunctionArgsType>) => boolean | Promise<boolean>;
  commonHandleFunctionErrors?: (
    options: HandleFunctionErrorHookOptions<FunctionArgsType>
  ) => any | Promise<any>;
  commonHandleSuccessfulFunctionAttemptData?: (
    options: HandleSuccessfulFunctionAttemptDataHookOptions<FunctionArgsType, FunctionReturnType>
  ) => any | Promise<any>;
  commonFunctionPreExecution?: FunctionPreExecutionOptions<FunctionArgsType, FunctionReturnType>;
  commonFunctionCache?: FunctionCacheConfig<FunctionArgsType, FunctionReturnType>;
  concurrentExecution?: boolean;
  requestGroups?: RequestGroup<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
  stopOnFirstError?: boolean;
  sharedBuffer?: Record<string, any>;
  maxConcurrentRequests?: number;
  rateLimit?: RateLimitConfig;
  circuitBreaker?: CircuitBreakerConfig | CircuitBreaker;
  executionContext?: Partial<ExecutionContext>;
  metricsGuardrails?: MetricsGuardrails;
  enableRacing?: boolean;
  maxTimeout?: number;
}

export interface RequestGroup<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  id: string;
  commonConfig?: Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>, "concurrentExecution" | "stopOnFirstError" | "requestGroups" | "maxConcurrentRequests" | "rateLimit" | "circuitBreaker" | "maxTimeout" | "executionContext" | "enableRacing" | "metricsGuardrails">;
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
  FunctionArgsType extends any[],
  FunctionReturnType
> =
  Omit<STABLE_FUNCTION<FunctionArgsType, FunctionReturnType>, 'fn' | 'args'> & {
    fn?: STABLE_FUNCTION<FunctionArgsType, FunctionReturnType>['fn'];
    args?: FunctionArgsType;
  };

export interface API_GATEWAY_FUNCTION<FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  id: string;
  groupId?: string;
  functionOptions: API_GATEWAY_FUNCTION_OPTIONS_TYPE<FunctionArgsType, FunctionReturnType>;
}

export type RequestOrFunctionType = RequestOrFunction.REQUEST | RequestOrFunction.FUNCTION;

export type API_GATEWAY_ITEM<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> =
  | { type: RequestOrFunction.REQUEST; request: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType> }
  | { type: RequestOrFunction.FUNCTION; function: API_GATEWAY_FUNCTION<FunctionArgsType, FunctionReturnType> };
  
export interface API_GATEWAY_RESPONSE<ResponseDataType = any, FunctionReturnType = any> {
  requestId: string;
  groupId?: string;
  success: boolean;
  data?: ResponseDataType | FunctionReturnType | boolean;
  error?: string;
  type?: RequestOrFunctionType;
}

export interface ApiGatewayInfrastructureMetrics {
  circuitBreaker?: CircuitBreakerDashboardMetrics;
  cache?: CacheDashboardMetrics;
  rateLimiter?: RateLimiterDashboardMetrics;
  concurrencyLimiter?: ConcurrencyLimiterDashboardMetrics;
}

export interface ApiGatewayMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  failureRate: number;
  executionTime: number;
  timestamp: string;
  throughput: number;
  averageRequestDuration: number;
  requestGroups?: RequestGroupMetrics[];
  infrastructureMetrics?: ApiGatewayInfrastructureMetrics;
  validation?: MetricsValidationResult;
}

export interface API_GATEWAY_RESULT<ResponseDataType = any, FunctionReturnType = any> extends Array<API_GATEWAY_RESPONSE<ResponseDataType, FunctionReturnType>> {
  metrics?: ApiGatewayMetrics;
}

export type ApiRequestOptionsMapping = {
  localKey: string;
  commonKey: string;
  groupCommonKey: string;
  targetKey: string;
};

export type CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> = Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>, "concurrentExecution"> & {
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

export interface FnExecResponse<FunctionReturnType = any> {
  ok: boolean;
  isRetryable: boolean;
  timestamp: string;
  executionTime: number;
  error?: string;
  data?: FunctionReturnType | { trialMode: TRIAL_MODE_OPTIONS };
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

export type SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> = Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>, "concurrentExecution"> & {
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

interface FunctionObservabilityHooksOptions<FunctionArgsType extends any[] = any[]> {
  fn: (...args: FunctionArgsType) => any;
  args: FunctionArgsType;
  params?: any;
  maxSerializableChars?: number;
  preExecutionResult?: any;
  commonBuffer?: Record<string, any>;
  executionContext?: ExecutionContext;
}

interface FunctionAnalysisHookOptions<FunctionArgsType extends any[] = any[]> extends Omit<FunctionObservabilityHooksOptions<FunctionArgsType>, "maxSerializableChars"> {
  trialMode?: TRIAL_MODE_OPTIONS;
  params?: any;
  preExecutionResult?: any;
  executionContext?: ExecutionContext;
  commonBuffer?: Record<string, any>;
}

export interface FunctionResponseAnalysisHookOptions<FunctionArgsType extends any[] = any[], FunctionReturnType = any> extends FunctionAnalysisHookOptions<FunctionArgsType> {
  data: FunctionReturnType
}

export interface FinalFunctionErrorAnalysisHookOptions<FunctionArgsType extends any[] = any[]> extends FunctionAnalysisHookOptions<FunctionArgsType> {
  error: any
}

export interface HandleFunctionErrorHookOptions<FunctionArgsType extends any[] = any[]> extends FunctionObservabilityHooksOptions<FunctionArgsType> {
  errorLog: FUNCTION_ERROR_LOG
}

export interface HandleSuccessfulFunctionAttemptDataHookOptions<FunctionArgsType extends any[] = any[], FunctionReturnType = any> extends FunctionObservabilityHooksOptions<FunctionArgsType> {
  successfulAttemptData: SUCCESSFUL_FUNCTION_ATTEMPT_DATA<FunctionReturnType>
}

export interface PreExecutionHookOptions<RequestDataType = any, ResponseDataType = any> {
  inputParams?: any;
  commonBuffer?: Record<string, any>;
  stableRequestOptions: STABLE_REQUEST<RequestDataType, ResponseDataType>;
}

export interface FunctionPreExecutionHookOptions<FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  inputParams?: any;
  commonBuffer?: Record<string, any>;
  stableFunctionOptions: STABLE_FUNCTION<FunctionArgsType, FunctionReturnType>;
}

interface WorkflowPreExecutionHookOptions {
  params?: any;
  sharedBuffer?: Record<string, any>;
  workflowId: string;
  branchId?: string;
}

export interface PrePhaseExecutionHookOptions<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> extends WorkflowPreExecutionHookOptions {
  phaseId: string;
  phaseIndex: number;
  phase: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
}

export interface PreBranchExecutionHookOptions<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> extends Omit<WorkflowPreExecutionHookOptions, 'branchId'> {
  branchId: string;
  branchIndex: number;
  branch: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
}

export interface RequestPreExecutionOptions<RequestDataType = any, ResponseDataType = any> {
  preExecutionHook: (options: PreExecutionHookOptions<RequestDataType, ResponseDataType>) => any | Promise<any>;
  preExecutionHookParams?: any;
  applyPreExecutionConfigOverride?: boolean;
  continueOnPreExecutionHookFailure?: boolean;
}

export interface FunctionPreExecutionOptions<FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  preExecutionHook: (options: FunctionPreExecutionHookOptions<FunctionArgsType, FunctionReturnType>) => any | Promise<any>;
  preExecutionHookParams?: any;
  applyPreExecutionConfigOverride?: boolean;
  continueOnPreExecutionHookFailure?: boolean;
}

export interface StatePersistenceOptions {
  executionContext: ExecutionContext;
  persistenceStage: PersistenceStage;
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
  metricsGuardrails?: MetricsGuardrails;
  throwOnFailedErrorAnalysis?: boolean;
}

export interface STABLE_FUNCTION<FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  fn: (...args: FunctionArgsType) => FunctionReturnType | Promise<FunctionReturnType>;
  args: FunctionArgsType;
  responseAnalyzer?: (options: FunctionResponseAnalysisHookOptions<FunctionArgsType, FunctionReturnType>) => boolean | Promise<boolean>;
  returnResult?: boolean;
  attempts?: number;
  performAllAttempts?: boolean;
  wait?: number;
  maxAllowedWait?: number;
  retryStrategy?: RETRY_STRATEGY_TYPES;
  jitter?: number;
  logAllErrors?: boolean;
  handleErrors?: (
    options: HandleFunctionErrorHookOptions<FunctionArgsType>
  ) => any | Promise<any>;
  logAllSuccessfulAttempts?: boolean;
  handleSuccessfulAttemptData?: (
    options: HandleSuccessfulFunctionAttemptDataHookOptions<FunctionArgsType, FunctionReturnType>
  ) => any | Promise<any>;
  maxSerializableChars?: number;
  finalErrorAnalyzer?: (options: FinalFunctionErrorAnalysisHookOptions<FunctionArgsType>) => boolean | Promise<boolean>;
  trialMode?: TRIAL_MODE_OPTIONS;
  hookParams?: FunctionHookParams;
  preExecution?: FunctionPreExecutionOptions<FunctionArgsType, FunctionReturnType>;
  commonBuffer?: Record<string, any>;
  cache?: FunctionCacheConfig<FunctionArgsType, FunctionReturnType>;
  executionContext?: ExecutionContext;
  circuitBreaker?: CircuitBreakerConfig | CircuitBreaker;
  statePersistence?: StatePersistenceConfig;
  rateLimit?: RateLimitConfig;
  maxConcurrentRequests?: number;
  metricsGuardrails?: MetricsGuardrails;
  throwOnFailedErrorAnalysis?: boolean;
  executionTimeout?: number;
}

export interface StableRequestInfrastructureMetrics {
  circuitBreaker?: CircuitBreakerDashboardMetrics;
  cache?: CacheDashboardMetrics;
}

export interface StableRequestMetrics {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  totalExecutionTime: number;
  averageAttemptTime: number;
  infrastructureMetrics?: StableRequestInfrastructureMetrics;
  validation?: MetricsValidationResult;
}

export interface StableFunctionInfrastructureMetrics {
  circuitBreaker?: CircuitBreakerDashboardMetrics;
  cache?: CacheDashboardMetrics;
  rateLimiter?: RateLimiterDashboardMetrics;
  concurrencyLimiter?: ConcurrencyLimiterDashboardMetrics;
}

export interface StableFunctionMetrics {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  totalExecutionTime: number;
  averageAttemptTime: number;
  infrastructureMetrics?: StableFunctionInfrastructureMetrics;
  validation?: MetricsValidationResult;
}

export interface STABLE_REQUEST_RESULT<ResponseDataType = any> {
  success: boolean;
  data?: ResponseDataType | boolean;
  error?: string;
  errorLogs?: ERROR_LOG[];
  successfulAttempts?: SUCCESSFUL_ATTEMPT_DATA<ResponseDataType>[];
  metrics?: StableRequestMetrics;
}

export interface STABLE_FUNCTION_RESULT<FunctionReturnType = any, ReturnResult extends boolean = boolean> {
  success: boolean;
  data?: ReturnResult extends true ? FunctionReturnType : boolean;
  error?: string;
  errorLogs?: FUNCTION_ERROR_LOG[];
  successfulAttempts?: SUCCESSFUL_FUNCTION_ATTEMPT_DATA<FunctionReturnType>[];
  metrics?: StableFunctionMetrics;
}

export interface SUCCESSFUL_ATTEMPT_DATA<ResponseDataType = any> {
  attempt: string;
  timestamp: string;
  executionTime: number;
  data: ResponseDataType;
  statusCode: number;
}

export interface SUCCESSFUL_FUNCTION_ATTEMPT_DATA<FunctionReturnType = any> {
  attempt: string;
  timestamp: string;
  executionTime: number;
  data: FunctionReturnType;
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

export interface STABLE_WORKFLOW_PHASE<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  id?: string;
  requests?: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[];
  functions?: API_GATEWAY_FUNCTION<FunctionArgsType, FunctionReturnType>[];
  items?: API_GATEWAY_ITEM<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
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
    options: PhaseDecisionHookOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
  ) => PhaseExecutionDecision<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> | Promise<PhaseExecutionDecision<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>;
  commonConfig?: Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>, 
    'concurrentExecution' | 'stopOnFirstError' | 'requestGroups' | "maxConcurrentRequests" | "rateLimit" | "circuitBreaker" | "maxTimeout" | "executionContext" |"metricsGuardrails">;
  branchId?: string;
  statePersistence?: StatePersistenceConfig;
  metricsGuardrails?: MetricsGuardrails;
  maxTimeout?: number;
}

export interface STABLE_WORKFLOW_OPTIONS<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>
  extends Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>, 
    'concurrentExecution' | 'stopOnFirstError' | 'commonMaxSerializableChars'> {
  workflowId?: string;
  startPhaseIndex?: number;
  stopOnFirstPhaseError?: boolean;
  logPhaseResults?: boolean;
  concurrentPhaseExecution?: boolean;
  enableBranchExecution?: boolean;
  enableBranchRacing?: boolean;
  branches?: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
  enableMixedExecution?: boolean;
  enableNonLinearExecution?: boolean;
  maxWorkflowIterations?: number;
  statePersistence?: StatePersistenceConfig;
  handlePhaseCompletion?: (
    options: HandlePhaseCompletionHookOptions<ResponseDataType, FunctionReturnType>
  ) => any | Promise<any>;
  handlePhaseError?: (
    options: HandlePhaseErrorHookOptions<ResponseDataType, FunctionReturnType>
  ) => any | Promise<any>;
  handlePhaseDecision?: (
    options: HandlePhaseDecisionHookOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
  ) => any | Promise<any>;
  handleBranchCompletion?: (
    options: HandleBranchCompletionHookOptions<ResponseDataType, FunctionReturnType>
  ) => any | Promise<any>;
  handleBranchDecision?: (
    decision: BranchExecutionDecision<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>,
    branchResult: BranchExecutionResult<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>,
    maxSerializableChars?: number
  ) => any | Promise<any>;
  prePhaseExecutionHook?: (
    options: PrePhaseExecutionHookOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
  ) => STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> | Promise<STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>;
  preBranchExecutionHook?: (
    options: PreBranchExecutionHookOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
  ) => STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> | Promise<STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>;
  maxSerializableChars?: number;
  workflowHookParams?: WorkflowHookParams;
}

export interface WorkflowInfrastructureMetrics {
  circuitBreaker?: CircuitBreakerDashboardMetrics;
  cache?: CacheDashboardMetrics;
  rateLimiter?: RateLimiterDashboardMetrics;
  concurrencyLimiter?: ConcurrencyLimiterDashboardMetrics;
}

export interface STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType = any, FunctionReturnType = any, RequestDataType = any, FunctionArgsType extends any[] = any[]> {
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
  responses: API_GATEWAY_RESPONSE<ResponseDataType, FunctionReturnType>[];
  executionNumber?: number;
  skipped?: boolean;
  decision?: PhaseExecutionDecision<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
  error?: string;
  metrics?: PhaseMetrics;
  validation?: MetricsValidationResult;
  infrastructureMetrics?: WorkflowInfrastructureMetrics;
}

export interface STABLE_WORKFLOW_RESULT<ResponseDataType = any, FunctionReturnType = any, RequestDataType = any, FunctionArgsType extends any[] = any[]> {
  workflowId: string;
  success: boolean;
  executionTime: number;
  timestamp: string;
  totalPhases: number;
  completedPhases: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  phases: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>[];
  executionHistory: PhaseExecutionRecord<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
  branches?: BranchExecutionResult<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>[];
  branchExecutionHistory?: BranchExecutionRecord<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[]; 
  terminatedEarly?: boolean;
  terminationReason?: string;
  error?: string;
  metrics?: WorkflowMetrics;
  validation?: MetricsValidationResult;
  requestGroupMetrics?: RequestGroupMetrics[];
  infrastructureMetrics?: WorkflowInfrastructureMetrics;
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

export interface HandlePhaseCompletionHookOptions<ResponseDataType = any, FunctionReturnType = any> {
  workflowId: string;
  branchId?: string;
  phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType>;
  maxSerializableChars?: number;
  params?: any;
  sharedBuffer?: Record<string, any>;
}

export interface HandlePhaseErrorHookOptions<ResponseDataType = any, FunctionReturnType = any> extends HandlePhaseCompletionHookOptions<ResponseDataType, FunctionReturnType> {
  error: any;
}

export interface HandlePhaseDecisionHookOptions<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  decision: PhaseExecutionDecision<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
  phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType>;
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
  excludeMethods?: REQUEST_METHODS[];
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

export interface CachedFunctionResponse<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface PhaseExecutionDecision<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  action: PHASE_DECISION_ACTIONS;
  targetPhaseId?: string;
  replayCount?: number;
  metadata?: Record<string, any>;
  addPhases?: ReadonlyArray<STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>;
}

export interface PhaseDecisionHookOptions<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  workflowId: string;
  branchId?: string;
  phaseResult: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType>;
  phaseId: string;
  phaseIndex: number;
  executionHistory: PhaseExecutionRecord<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
  sharedBuffer?: Record<string, any>;
  params?: any;
  concurrentPhaseResults?: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType>[];
}

export interface PhaseExecutionRecord<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  phaseId: string;
  phaseIndex: number;
  executionNumber: number;
  timestamp: string;
  success: boolean;
  executionTime: number;
  decision?: PhaseExecutionDecision<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
}

export interface NonLinearWorkflowContext<RequestDataType, ResponseDataType, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  phases: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
  startPhaseIndex?: number;
  workflowId: string;
  branchId?: string;
  commonGatewayOptions: any;
  requestGroups: any[];
  logPhaseResults: boolean;
  handlePhaseCompletion: (
    options: HandlePhaseCompletionHookOptions<ResponseDataType, FunctionReturnType>
  ) => any | Promise<any>;
  handlePhaseError: (
    options: HandlePhaseErrorHookOptions<ResponseDataType, FunctionReturnType>
  ) => any | Promise<any>;
  handlePhaseDecision?: (
    options: HandlePhaseDecisionHookOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
  ) => any | Promise<any>;
  prePhaseExecutionHook?: (
    options: PrePhaseExecutionHookOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
  ) => STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> | Promise<STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>;
  maxSerializableChars: number;
  workflowHookParams: any;
  sharedBuffer?: Record<string, any>;
  stopOnFirstPhaseError: boolean;
  maxWorkflowIterations: number;
}

export interface EXECUTE_NON_LINEAR_WORKFLOW_RESPONSE<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  phaseResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>[];
  executionHistory: PhaseExecutionRecord<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  terminatedEarly: boolean;
  terminationReason?: string;
}

export interface STABLE_WORKFLOW_BRANCH<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  id: string;
  phases: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
  markConcurrentBranch?: boolean;
  allowReplay?: boolean;
  maxReplayCount?: number;
  allowSkip?: boolean;
  branchDecisionHook?: (
    options: BranchDecisionHookOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
  ) => BranchExecutionDecision<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> | Promise<BranchExecutionDecision<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>;
  statePersistence?: StatePersistenceConfig;
  commonConfig?: Omit<API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>, 
    'concurrentExecution' | 'stopOnFirstError' | 'requestGroups' | 'maxConcurrentRequests' | 'rateLimit' | 'circuitBreaker' | 'maxTimeout' | "executionContext" |"metricsGuardrails">;
  metricsGuardrails?: MetricsGuardrails;
  maxTimeout?: number;
}

export interface BranchDecisionHookOptions<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  workflowId: string;
  branchResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>[];
  branchId: string;
  branchIndex: number;
  executionNumber: number;
  executionHistory: PhaseExecutionRecord<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
  branchExecutionHistory: BranchExecutionRecord<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
  sharedBuffer?: Record<string, any>;
  params?: any;
  concurrentBranchResults?: BranchExecutionResult<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>[];
}

export interface BranchExecutionDecision<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  action: PHASE_DECISION_ACTIONS;
  targetBranchId?: string;
  metadata?: Record<string, any>;
  addPhases?: ReadonlyArray<STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>;
  addBranches?: ReadonlyArray<STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>;
}

export interface BranchExecutionResult<ResponseDataType = any, FunctionReturnType = any, RequestDataType = any, FunctionArgsType extends any[] = any[]> {
  workflowId: string;
  branchId: string;
  branchIndex: number;
  success: boolean;
  executionTime: number;
  completedPhases: number;
  phaseResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>[];
  decision?: BranchExecutionDecision<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
  executionNumber: number;
  skipped?: boolean;
  error?: string;
  metrics?: BranchMetrics;
  validation?: MetricsValidationResult;
}

export interface BranchExecutionRecord<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  branchId: string;
  branchIndex: number;
  executionNumber: number;
  timestamp: string;
  success: boolean;
  executionTime: number;
  decision?: BranchExecutionDecision<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
}

export interface HandleBranchCompletionHookOptions<ResponseDataType = any, FunctionReturnType = any> {
  workflowId: string;
  branchId: string;
  branchResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType, any, any[]>[];
  success: boolean;
  maxSerializableChars?: number;
}

export interface BranchWorkflowContext<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  branches: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
  workflowId: string;
  commonGatewayOptions: any;
  requestGroups: any[];
  logPhaseResults: boolean;
  handlePhaseCompletion: (
    options: HandlePhaseCompletionHookOptions<ResponseDataType, FunctionReturnType>
  ) => any | Promise<any>;
  handlePhaseError: (
    options: HandlePhaseErrorHookOptions<ResponseDataType, FunctionReturnType>
  ) => any | Promise<any>;
  handleBranchCompletion?: (
    options: HandleBranchCompletionHookOptions<ResponseDataType, FunctionReturnType>
  ) => any | Promise<any>;
  handleBranchDecision?: (
    decision: BranchExecutionDecision<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>,
    branchResult: BranchExecutionResult<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>,
    maxSerializableChars?: number
  ) => any | Promise<any>;
  preBranchExecutionHook?: (
    options: PreBranchExecutionHookOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
  ) => STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> | Promise<STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>;
  prePhaseExecutionHook?: (
    options: PrePhaseExecutionHookOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
  ) => STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> | Promise<STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>;
  maxSerializableChars: number;
  workflowHookParams: any;
  sharedBuffer?: Record<string, any>;
  stopOnFirstPhaseError: boolean;
  enableBranchRacing?: boolean;
  maxWorkflowIterations: number;
}

export interface EXECUTE_BRANCH_WORKFLOW_RESPONSE<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  branchResults: BranchExecutionResult<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>[];
  allPhaseResults: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>[];
  executionHistory: PhaseExecutionRecord<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
  branchExecutionHistory: BranchExecutionRecord<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
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
  config: Required<CircuitBreakerConfig>;
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

export interface WorkflowGraph<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  nodes: Map<string, WorkflowNode<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>;
  edges: Map<string, WorkflowEdge<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[]>;
  entryPoint: string;
  exitPoints?: string[];
  metadata?: Record<string, any>;
}

export interface WorkflowNode<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  id: string;
  type: WorkflowNodeType;
  phase?: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
  branch?: STABLE_WORKFLOW_BRANCH<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
  condition?: ConditionalNode<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
  parallelNodes?: string[];
  waitForNodes?: string[];
  metadata?: Record<string, any>;
  phaseDecisionHook?: (
    context: PhaseDecisionHookOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
  ) => PhaseExecutionDecision<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> | Promise<PhaseExecutionDecision<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>;
}

export interface WorkflowEdge<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  from: string;
  to: string;
  condition?: EdgeCondition<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
  weight?: number;
  label?: string;
  metadata?: Record<string, any>;
}

export type EdgeConditionType = WorkflowEdgeConditionTypes.SUCCESS | WorkflowEdgeConditionTypes.FAILURE | WorkflowEdgeConditionTypes.CUSTOM | WorkflowEdgeConditionTypes.ALWAYS

export interface EdgeCondition<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  type: EdgeConditionType;
  evaluate?: (context: EdgeEvaluationContext<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>) => boolean | Promise<boolean>;
}

export interface EdgeEvaluationContext<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  results: Map<string, STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>>;
  sharedBuffer?: Record<string, any>;
  executionHistory: ReadonlyArray<PhaseExecutionRecord<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>;
  currentNodeId: string;
}

export interface ConditionalNode<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  evaluate: (context: ConditionalEvaluationContext<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>) => string | Promise<string>;
}

export interface ConditionalEvaluationContext<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> {
  results: Map<string, STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>>;
  sharedBuffer?: Record<string, any>;
  executionHistory: ReadonlyArray<PhaseExecutionRecord<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>>;
  currentNodeId: string;
  phaseResult?: STABLE_WORKFLOW_PHASE_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>;
}

export interface WorkflowGraphOptions<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any> 
  extends Omit<STABLE_WORKFLOW_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>, 'branches' | 'enableBranchExecution' | 'concurrentPhaseExecution' | 'enableMixedExecution' | 'enableNonLinearExecution'> {
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

export type SchedulerSchedule =
  | { type: ScheduleTypes.CRON; expression: string; timezone?: string }
  | { type: ScheduleTypes.INTERVAL; everyMs: number; startAt?: string | number }
  | { type: ScheduleTypes.TIMESTAMP; at: string | number }
  | { type: ScheduleTypes.TIMESTAMPS; at: Array<string | number> };

export interface SchedulerRetryConfig {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
}

export interface SchedulerPersistence<TJob = unknown> {
  enabled?: boolean;
  saveState?: (state: SchedulerState<TJob>) => Promise<void> | void;
  loadState?: () => Promise<SchedulerState<TJob> | null> | SchedulerState<TJob> | null;
}

export interface SchedulerConfig<TJob = unknown> {
  maxParallel?: number;
  tickIntervalMs?: number;
  queueLimit?: number;
  timezone?: string;
  persistence?: SchedulerPersistence<TJob>;
  retry?: SchedulerRetryConfig;
  executionTimeoutMs?: number;
  persistenceDebounceMs?: number;
  metricsGuardrails?: MetricsGuardrails;
  sharedBuffer?: Record<string, any>;
}

export interface SchedulerRunContext {
  runId: string;
  jobId: string;
  scheduledAt: string;
  startedAt: string;
  schedule?: SchedulerSchedule;
  sharedBuffer?: Record<string, any>;
}

export interface SchedulerJobState<TJob> {
  id: string;
  job: TJob;
  schedule?: SchedulerSchedule;
  nextRunAt: number | null;
  lastRunAt: number | null;
  remainingTimestamps: number[] | null;
  runOnce: boolean;
  isRunning: boolean;
  retryAttempts: number;
}

export interface SchedulerState<TJob> {
  jobs: SchedulerJobState<TJob>[];
  queue: string[];
  stats: {
    completed: number;
    failed: number;
    dropped: number;
    sequence: number;
  };
  sharedBuffer?: Record<string, any>;
}

export type SchedulerJobHandler<TJob> = (job: TJob, context: SchedulerRunContext) => Promise<unknown>;

export type ScheduledJob<TJob extends { id?: string; schedule?: SchedulerSchedule }> = {
  id: string;
  job: TJob;
  schedule?: SchedulerSchedule;
  nextRunAt: number | null;
  lastRunAt: number | null;
  remainingTimestamps: number[] | null;
  runOnce: boolean;
  isRunning: boolean;
  retryAttempts: number;
};

export interface InternalSchedulerConfig<TJob = any> {
  maxParallel: number;
  tickIntervalMs: number;
  queueLimit: number;
  timezone?: string;
  persistence: {
    enabled: boolean;
    saveState?: (state: SchedulerState<TJob>) => Promise<void> | void;
    loadState?: () => Promise<SchedulerState<TJob> | null> | SchedulerState<TJob> | null;
  };
  retry?: SchedulerRetryConfig;
  executionTimeoutMs?: number;
  persistenceDebounceMs?: number;
  metricsGuardrails?: SchedulerConfig<TJob>['metricsGuardrails'];
  sharedBuffer?: Record<string, any>;
}

export type RunnerJob =
  | { kind: RunnerJobs.STABLE_REQUEST; options: STABLE_REQUEST }
  | { kind: RunnerJobs.STABLE_FUNCTION; options: STABLE_FUNCTION }
  | {
      kind: RunnerJobs.STABLE_API_GATEWAY;
      requests: API_GATEWAY_REQUEST[] | API_GATEWAY_ITEM[];
      options: API_GATEWAY_OPTIONS;
      functions?: API_GATEWAY_FUNCTION[];
    }
  | { kind: RunnerJobs.STABLE_WORKFLOW; phases: STABLE_WORKFLOW_PHASE[]; options?: STABLE_WORKFLOW_OPTIONS }
  | { kind: RunnerJobs.STABLE_WORKFLOW_GRAPH; graph: WorkflowGraph; options?: WorkflowGraphOptions };

export type RunnerScheduledJob = RunnerJob & {
  id?: string;
  schedule?: SchedulerSchedule;
  retry?: SchedulerRetryConfig;
  executionTimeoutMs?: number;
};

export type RunnerConfig = {
  outputPath?: string;
  jobId?: string;
  job?: RunnerJob;
  jobs?: RunnerScheduledJob[];
  scheduler?: SchedulerConfig;
};