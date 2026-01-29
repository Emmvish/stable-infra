import { API_GATEWAY_OPTIONS, ApiRequestOptionsMapping } from "../types/index.js";

export const extractCommonOptionsKeys: (keyof API_GATEWAY_OPTIONS)[] = [
    'commonPreExecution',
    'commonHookParams',
    'commonMaxAllowedWait',
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
    'commonJitter',
    'commonLogAllErrors',
    'commonLogAllSuccessfulAttempts',
    'commonMaxSerializableChars',
    'commonTrialMode',
    'commonCache',
    'commonStatePersistence',
    'commonExecutionTimeout',
] as const;

export const PrepareApiRequestOptionsMapping: ApiRequestOptionsMapping[] = [    
    { localKey: 'preExecution', commonKey: 'commonPreExecution', groupCommonKey: 'commonPreExecution', targetKey: 'preExecution' },
    { localKey: 'hookParams', commonKey: 'commonHookParams', groupCommonKey: 'commonHookParams', targetKey: 'hookParams' },
    { localKey: 'maxAllowedWait', commonKey: 'commonMaxAllowedWait', groupCommonKey: 'commonMaxAllowedWait', targetKey: 'maxAllowedWait' },
    { localKey: 'resReq', commonKey: 'commonResReq', groupCommonKey: 'commonResReq', targetKey: 'resReq' },
    { localKey: 'attempts', commonKey: 'commonAttempts', groupCommonKey: 'commonAttempts', targetKey: 'attempts' },
    { localKey: 'performAllAttempts', commonKey: 'commonPerformAllAttempts', groupCommonKey: 'commonPerformAllAttempts', targetKey: 'performAllAttempts' },
    { localKey: 'wait', commonKey: 'commonWait', groupCommonKey: 'commonWait', targetKey: 'wait' },
    { localKey: 'retryStrategy', commonKey: 'commonRetryStrategy', groupCommonKey: 'commonRetryStrategy', targetKey: 'retryStrategy' },
    { localKey: 'jitter', commonKey: 'commonJitter', groupCommonKey: 'commonJitter', targetKey: 'jitter' },
    { localKey: 'logAllErrors', commonKey: 'commonLogAllErrors', groupCommonKey: 'commonLogAllErrors', targetKey: 'logAllErrors' },
    { localKey: 'logAllSuccessfulAttempts', commonKey: 'commonLogAllSuccessfulAttempts', groupCommonKey: 'commonLogAllSuccessfulAttempts', targetKey: 'logAllSuccessfulAttempts' },
    { localKey: 'maxSerializableChars', commonKey: 'commonMaxSerializableChars', groupCommonKey: 'commonMaxSerializableChars', targetKey: 'maxSerializableChars' },
    { localKey: 'trialMode', commonKey: 'commonTrialMode', groupCommonKey: 'commonTrialMode', targetKey: 'trialMode' },
    { localKey: 'responseAnalyzer', commonKey: 'commonResponseAnalyzer', groupCommonKey: 'commonResponseAnalyzer', targetKey: 'responseAnalyzer' },
    { localKey: 'handleErrors', commonKey: 'commonHandleErrors', groupCommonKey: 'commonHandleErrors', targetKey: 'handleErrors' },
    { localKey: 'handleSuccessfulAttemptData', commonKey: 'commonHandleSuccessfulAttemptData', groupCommonKey: 'commonHandleSuccessfulAttemptData', targetKey: 'handleSuccessfulAttemptData' },
    { localKey: 'finalErrorAnalyzer', commonKey: 'commonFinalErrorAnalyzer', groupCommonKey: 'commonFinalErrorAnalyzer', targetKey: 'finalErrorAnalyzer' },
    { localKey: 'cache', commonKey: 'commonCache', groupCommonKey: 'commonCache', targetKey: 'cache' },
    { localKey: 'commonBuffer', commonKey: 'sharedBuffer', groupCommonKey: 'sharedBuffer', targetKey: 'commonBuffer' },
    { localKey: 'statePersistence', commonKey: 'commonStatePersistence', groupCommonKey: 'commonStatePersistence', targetKey: 'statePersistence' },
] as const;

export const REQUEST_METRICS_TO_VALIDATE_KEYS = [
    'totalAttempts',
    'successfulAttempts',
    'failedAttempts',
    'totalExecutionTime',
    'averageAttemptTime'
] as const;

export const API_GATEWAY_METRICS_TO_VALIDATE_KEYS = [
    'totalRequests',
    'successfulRequests',
    'failedRequests',
    'successRate',
    'failureRate',
    'executionTime',
    'throughput',
    'averageRequestDuration'
] as const;

export const WORKFLOW_METRICS_TO_VALIDATE_KEYS = [
    'totalPhases',
    'completedPhases',
    'failedPhases',
    'totalRequests',
    'successfulRequests',
    'failedRequests',
    'requestSuccessRate',
    'requestFailureRate',
    'executionTime',
    'averagePhaseExecutionTime',
    'throughput',
    'phaseCompletionRate'
] as const;

export const CIRCUIT_BREAKER_METRICS_TO_VALIDATE_KEYS = [
    'failureRate',
    'totalRequests',
    'failedRequests'
] as const;

export const CACHE_METRICS_TO_VALIDATE_KEYS = [
    'hitRate',
    'missRate',
    'utilizationPercentage',
    'evictionRate'
] as const;

export const RATE_LIMITER_METRICS_TO_VALIDATE_KEYS = [
    'throttleRate',
    'queueLength',
    'utilizationPercentage',
    'averageQueueWaitTime'
] as const;

export const CONCURRENCY_LIMITER_METRICS_TO_VALIDATE_KEYS = [
    'utilizationPercentage',
    'queueLength',
    'averageQueueWaitTime'
] as const;

export const PHASE_METRICS_TO_VALIDATE_KEYS = [
  'totalRequests',
  'successfulRequests',
  'failedRequests',
  'requestSuccessRate',
  'requestFailureRate',
  'executionTime'
] as const;

export const BRANCH_METRICS_TO_VALIDATE_KEYS = [
  'totalPhases',
  'completedPhases',
  'failedPhases',
  'phaseCompletionRate',
  'totalRequests',
  'successfulRequests',
  'failedRequests',
  'requestSuccessRate',
  'executionTime'
] as const;

export const SCHEDULER_METRICS_TO_VALIDATE_KEYS = [
    'totalJobs',
    'queued',
    'running',
    'completed',
    'failed',
    'dropped',
    'totalRuns',
    'successRate',
    'failureRate',
    'throughput',
    'averageExecutionTime',
    'averageQueueDelay'
] as const;

export const STABLE_BUFFER_METRICS_TO_VALIDATE_KEYS = [
    'totalTransactions',
    'averageQueueWaitMs'
] as const;