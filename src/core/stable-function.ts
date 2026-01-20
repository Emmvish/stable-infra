import {
  RETRY_STRATEGIES,
  CircuitBreakerState
} from '../enums/index.js';

import { 
  FUNCTION_ERROR_LOG,
  FunctionPreExecutionHookOptions,
  FnExecResponse, 
  STABLE_FUNCTION,
  STABLE_FUNCTION_RESULT,
  SUCCESSFUL_FUNCTION_ATTEMPT_DATA,
} from '../types/index.js';

import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  executeWithPersistence,
  formatLogContext,
  getGlobalFunctionCacheManager,
  getNewDelayTime,
  delay,
  fnExec,
  safelyStringify,
  validateTrialModeProbabilities,
  MetricsAggregator,
  MetricsValidator,
  RateLimiter,
  ConcurrencyLimiter
} from '../utilities/index.js';

export async function stableFunction<TArgs extends any[] = any[], TReturn = any>(
  options: STABLE_FUNCTION<TArgs, TReturn>
): Promise<STABLE_FUNCTION_RESULT<TReturn>> {
  const { 
    preExecution = {
      preExecutionHook: ({ inputParams, commonBuffer }: FunctionPreExecutionHookOptions) => {},
      preExecutionHookParams: {},
      applyPreExecutionConfigOverride: false,
      continueOnPreExecutionHookFailure: false,
    },
    commonBuffer = {},
    executionContext
  } = options;
  
  let preExecutionResult: Partial<STABLE_FUNCTION<TArgs, TReturn>> | unknown;
  try {
    preExecutionResult = await executeWithPersistence<Partial<STABLE_FUNCTION<TArgs, TReturn>> | unknown>(
      preExecution?.preExecutionHook as Function,
      {
        inputParams: preExecution?.preExecutionHookParams,
        commonBuffer,
        stableFunctionOptions: options
      },
      options.statePersistence,
      executionContext || {},
      commonBuffer
    );
    if(preExecution?.applyPreExecutionConfigOverride) {
      const finalOptions = {
        ...options,
        ...preExecutionResult as Partial<STABLE_FUNCTION<TArgs, TReturn>>
      }
      Object.assign(options, finalOptions);
    }
  } catch(e) {
    if (!preExecution?.continueOnPreExecutionHookFailure) {
      throw e;
    }
  }

  const {
    fn,
    args,
    responseAnalyzer = ({ data, trialMode = { enabled: false } }) => true,
    returnResult = false,
    attempts: givenAttempts = 1,
    performAllAttempts = false,
    wait = 1000,
    maxAllowedWait = 60000,
    retryStrategy = RETRY_STRATEGIES.FIXED,
    logAllErrors = false,
    handleErrors = ({ fn, args, errorLog, maxSerializableChars = 1000, executionContext }) => 
      console.error(
        `${formatLogContext(executionContext)}stable-request:\n`,
        `Function: ${fn.name || 'anonymous'}\n`,
        'Args:\n',
        safelyStringify(args, maxSerializableChars),
        '\nError log:\n',
        safelyStringify(errorLog, maxSerializableChars)
      ),
    logAllSuccessfulAttempts = false,
    handleSuccessfulAttemptData = ({ fn, args, successfulAttemptData, maxSerializableChars = 1000, executionContext }) =>
      console.info(
        `${formatLogContext(executionContext)}stable-request:\n`,
        `Function: ${fn.name || 'anonymous'}\n`,
        'Args:\n',
        safelyStringify(args, maxSerializableChars),
        '\nSuccessful attempt:\n',
        safelyStringify(successfulAttemptData, maxSerializableChars)
      ),
    maxSerializableChars = 1000,
    finalErrorAnalyzer = ({ fn, args, error, trialMode = { enabled: false } }) => false,
    trialMode = { enabled: false },
    hookParams = {},
    cache,
    circuitBreaker,
    jitter = 0,
    statePersistence,
    rateLimit,
    maxConcurrentRequests
  } = options;

  let attempts = givenAttempts;
  
  const functionStartTime = Date.now();
  const errorLogs: FUNCTION_ERROR_LOG[] = [];
  const successfulAttemptsList: SUCCESSFUL_FUNCTION_ATTEMPT_DATA<TReturn>[] = [];
  let totalAttemptsMade = 0;
  let successfulAttemptsCount = 0;
  
  const buildResult = (success: boolean, data?: TReturn, error?: string): STABLE_FUNCTION_RESULT<TReturn> => {
    const totalExecutionTime = Date.now() - functionStartTime;
    const failedAttemptsCount = totalAttemptsMade - successfulAttemptsCount;
    
    const result: STABLE_FUNCTION_RESULT<TReturn> = {
      success,
      ...(data !== undefined && { data }),
      ...(error && { error }),
      ...(errorLogs.length > 0 && { errorLogs }),
      ...(successfulAttemptsList.length > 0 && { successfulAttempts: successfulAttemptsList }),
      metrics: {
        totalAttempts: totalAttemptsMade,
        successfulAttempts: successfulAttemptsCount,
        failedAttempts: failedAttemptsCount,
        totalExecutionTime,
        averageAttemptTime: totalAttemptsMade > 0 ? totalExecutionTime / totalAttemptsMade : 0,
        infrastructureMetrics: {
          ...(circuitBreakerInstance && { circuitBreaker: MetricsAggregator.extractCircuitBreakerMetrics(circuitBreakerInstance) }),
          ...(cache && getGlobalFunctionCacheManager() && { cache: MetricsAggregator.extractFunctionCacheMetrics(getGlobalFunctionCacheManager()) }),
          ...(rateLimiterInstance && { rateLimiter: MetricsAggregator.extractRateLimiterMetrics(rateLimiterInstance) }),
          ...(concurrencyLimiterInstance && { concurrencyLimiter: MetricsAggregator.extractConcurrencyLimiterMetrics(concurrencyLimiterInstance) })
        }
      }
    };
    
    if (options.metricsGuardrails && result.metrics) {
      result.metrics.validation = MetricsValidator.validateRequestMetrics(
        result.metrics,
        options.metricsGuardrails
      );
    }
    
    return result;
  };
  
  let circuitBreakerInstance: CircuitBreaker | null = null;
  if (circuitBreaker) {
    circuitBreakerInstance = circuitBreaker instanceof CircuitBreaker
      ? circuitBreaker
      : new CircuitBreaker(circuitBreaker as any);
  }

  let rateLimiterInstance: RateLimiter | null = null;
  if (rateLimit && rateLimit.maxRequests > 0 && rateLimit.windowMs > 0) {
    rateLimiterInstance = new RateLimiter(rateLimit.maxRequests, rateLimit.windowMs);
  }

  let concurrencyLimiterInstance: ConcurrencyLimiter | null = null;
  if (maxConcurrentRequests && maxConcurrentRequests > 0) {
    concurrencyLimiterInstance = new ConcurrencyLimiter(maxConcurrentRequests);
  }

  try {
    validateTrialModeProbabilities(trialMode);

    let res: FnExecResponse<TReturn> = {
      ok: false,
      isRetryable: true,
      timestamp: new Date().toISOString(),
      executionTime: 0
    };

    const maxAttempts = attempts;
    let lastSuccessfulAttemptData: TReturn | undefined = undefined;
    let hadAtLeastOneSuccess = false;

    do {
      attempts--;
      const currentAttempt = maxAttempts - attempts;
      totalAttemptsMade = currentAttempt;

      if (circuitBreakerInstance) {
        const cbConfig = circuitBreakerInstance.getState().config;
        if (cbConfig.trackIndividualAttempts || currentAttempt === 1) {
          const canExecute = await circuitBreakerInstance.canExecute();
          if (!canExecute) {
            throw new CircuitBreakerOpenError(
              `${formatLogContext(executionContext)}stable-request: Circuit breaker is ${circuitBreakerInstance.getState().state}. Function execution blocked at attempt ${currentAttempt}.`
            );
          }
        }
      }

      try {
        const executeAttempt = async () => {
          return await fnExec<TArgs, TReturn>(fn, args, returnResult, maxSerializableChars, trialMode, cache, executionContext);
        };

        if (rateLimiterInstance && concurrencyLimiterInstance) {
          res = await rateLimiterInstance.execute(() => concurrencyLimiterInstance!.execute(executeAttempt));
        } else if (rateLimiterInstance) {
          res = await rateLimiterInstance.execute(executeAttempt);
        } else if (concurrencyLimiterInstance) {
          res = await concurrencyLimiterInstance.execute(executeAttempt);
        } else {
          res = await executeAttempt();
        }
        
        if (res.fromCache && res.ok) {
          if (trialMode.enabled) {
            console.info(
              `${formatLogContext(executionContext)}stable-request: Response served from cache:\n`,
              safelyStringify(res?.data as Record<string, any>, maxSerializableChars)
            );
          }
          return buildResult(true, returnResult ? res?.data as TReturn : true as any);
        }
        
      } catch(attemptError: any) {
        if (attemptError instanceof CircuitBreakerOpenError) {
          throw attemptError;
        }
        if (circuitBreakerInstance && circuitBreakerInstance.getState().config.trackIndividualAttempts) {
          circuitBreakerInstance.recordAttemptFailure();
          if (circuitBreakerInstance.getState().state === CircuitBreakerState.OPEN) {
            throw new CircuitBreakerOpenError(
              `${formatLogContext(executionContext)}stable-request: Circuit breaker opened after attempt ${currentAttempt}. No further retries.`
            );
          }
        }
        throw attemptError;
      }

      const originalResOk = res.ok;
      let performNextAttempt: boolean = false;

      if (res.ok) {
        try {
          performNextAttempt = !(await executeWithPersistence<boolean>(
            responseAnalyzer,
            {
              fn,
              args,
              data: res?.data,
              trialMode,
              params: hookParams?.responseAnalyzerParams,
              preExecutionResult,
              commonBuffer,
              executionContext
            },
            statePersistence,
            executionContext || {},
            commonBuffer
          ));
        } catch (e: any) {
          console.error(
            `${formatLogContext(executionContext)}stable-request: Unable to analyze the response returned on attempt #${currentAttempt}. Response: ${safelyStringify(
              res?.data as Record<string, any>,
              maxSerializableChars
            )}`
          );
          console.error(
            `${formatLogContext(executionContext)}stable-request: Error message provided by your responseAnalyzer: ${safelyStringify(
              e.message,
              maxSerializableChars
            )}`
          );
          performNextAttempt = true;
        }
      }
      
      if (circuitBreakerInstance && circuitBreakerInstance.getState().config.trackIndividualAttempts) {
        if (res.ok && !performNextAttempt) {
          circuitBreakerInstance.recordAttemptSuccess();
        } else if (!res.ok || performNextAttempt) {
          circuitBreakerInstance.recordAttemptFailure();
          if (circuitBreakerInstance.getState().state === CircuitBreakerState.OPEN) {
            throw new CircuitBreakerOpenError(
              `${formatLogContext(executionContext)}stable-request: Circuit breaker opened after attempt ${currentAttempt}/${maxAttempts}. Blocking further retries.`
            );
          }
        }
      }
      
      if ((!res.ok || (res.ok && performNextAttempt)) && logAllErrors) {
        const errorLog: FUNCTION_ERROR_LOG = {
          timestamp: res.timestamp,
          attempt: `${currentAttempt}/${maxAttempts}`,
          error:
            res?.error ??
            `${formatLogContext(executionContext)}stable-request: The response did not match your expectations! Response: ${safelyStringify(
              res?.data as Record<string, any>,
              maxSerializableChars
            )}`,
          isRetryable: res.isRetryable,
          executionTime: res.executionTime
        };
        errorLogs.push(errorLog);

        try {
          await executeWithPersistence<void>(
            handleErrors,
            {
              fn,
              args,
              errorLog,
              maxSerializableChars,
              params: hookParams?.handleErrorsParams,
              preExecutionResult,
              commonBuffer,
              executionContext
            },
            statePersistence,
            executionContext || {},
            commonBuffer
          );
        } catch (e: any) {
          console.error(
            `${formatLogContext(executionContext)}stable-request: Unable to report errors due to issues with error handler! Error message provided by your handleErrors: ${safelyStringify(
              e.message,
              maxSerializableChars
            )}`
          );
        }
      }

      if (res.ok && !performNextAttempt) {
        hadAtLeastOneSuccess = true;
        lastSuccessfulAttemptData = res?.data as TReturn;
        successfulAttemptsCount++;

        if (logAllSuccessfulAttempts) {
          const successfulAttemptLog: SUCCESSFUL_FUNCTION_ATTEMPT_DATA<TReturn> = {
            attempt: `${currentAttempt}/${maxAttempts}`,
            timestamp: res.timestamp,
            data: res?.data as TReturn,
            executionTime: res.executionTime
          };
          successfulAttemptsList.push(successfulAttemptLog);

          try {
            await executeWithPersistence<void>(
              handleSuccessfulAttemptData,
              {
                fn,
                args,
                successfulAttemptData: successfulAttemptLog,
                maxSerializableChars,
                params: hookParams?.handleSuccessfulAttemptDataParams,
                preExecutionResult,
                commonBuffer,
                executionContext
              },
              statePersistence,
              executionContext || {},
              commonBuffer
            );
          } catch (e: any) {
            console.error(
              `${formatLogContext(executionContext)}stable-request: Unable to report successful attempts due to issues with successful attempt data handler! Error message provided by your handleSuccessfulAttemptData: ${safelyStringify(
                e.message,
                maxSerializableChars
              )}`
            );
          }
        }
      }

      if (performNextAttempt && res.isRetryable) {
        res.ok = false;
      }

      if (
        attempts > 0 &&
        ((!originalResOk && res.isRetryable) ||
          (originalResOk && performNextAttempt) ||
          performAllAttempts)
      ) {
        await delay(getNewDelayTime(retryStrategy, wait, currentAttempt, jitter), maxAllowedWait);
      }
    } while (
      attempts > 0 &&
      ((res.isRetryable && !res.ok) || performAllAttempts)
    );
    
    if (performAllAttempts && hadAtLeastOneSuccess) {
      if (trialMode.enabled) {
        console.info(
          `${formatLogContext(executionContext)}stable-request: Final response (performAllAttempts mode):\n`,
          safelyStringify(lastSuccessfulAttemptData as Record<string, any>, maxSerializableChars)
        );
      }
      return buildResult(true, returnResult ? lastSuccessfulAttemptData! : true as any);
    } else if (res.ok) {
      if (trialMode.enabled) {
        const finalResponse = res?.data ?? lastSuccessfulAttemptData;
        console.info(
          `${formatLogContext(executionContext)}stable-request: Final response:\n`,
          safelyStringify(finalResponse as Record<string, any>, maxSerializableChars)
        );
      }
      return buildResult(true, returnResult ? ((res?.data ?? lastSuccessfulAttemptData) as TReturn) : true as any);
    } else {
      throw new Error(
        safelyStringify(
          {
            error: res?.error,
            'Function': fn.name || 'anonymous',
            'Args': args,
          },
          maxSerializableChars
        )
      );
    }
  } catch (e: any) {
    if (trialMode.enabled) {
      console.error(`${formatLogContext(executionContext)}stable-request: Final error:\n`, e.message);
    }

    let errorAnalysisResult = false;
    try {
      errorAnalysisResult = await executeWithPersistence<boolean>(
        finalErrorAnalyzer,
        {
          fn,
          args,
          error: e,
          trialMode,
          params: hookParams?.finalErrorAnalyzerParams,
          preExecutionResult,
          commonBuffer,
          executionContext
        },
        statePersistence,
        executionContext || {},
        commonBuffer
      );
    } catch(errorAnalysisError: any) {
      console.error(
        `${formatLogContext(executionContext)}stable-request: Unable to analyze the final error returned. Error message provided by your finalErrorAnalyzer: ${safelyStringify(
          errorAnalysisError.message,
          maxSerializableChars
        )}`
      );
    }

    if(!errorAnalysisResult) {
      throw e;
    } else {
      return buildResult(false, undefined, e.message || 'Function execution failed');
    }
  }
}
