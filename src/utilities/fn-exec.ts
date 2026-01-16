import { FnExecResponse, TRIAL_MODE_OPTIONS, FunctionCacheConfig, ExecutionContext } from '../types/index.js';
import { safelyStringify } from './safely-stringify.js';
import { FunctionCacheManager, getGlobalFunctionCacheManager } from './function-cache-manager.js';
import { formatLogContext } from './format-log-context.js';

export async function fnExec<TArgs extends any[] = any[], TReturn = any>(
  fn: (...args: TArgs) => TReturn | Promise<TReturn>,
  args: TArgs,
  returnResult = false,
  maxSerializableChars = 1000,
  trialMode: TRIAL_MODE_OPTIONS = { enabled: false },
  cacheConfig?: FunctionCacheConfig<TArgs, TReturn>,
  executionContext?: ExecutionContext
): Promise<FnExecResponse<TReturn>> {
  const startTime = Date.now();
  let stopTime = 0;
  const timestamp = new Date(startTime).toISOString();

  let cacheManager: FunctionCacheManager | null = null;
  if (cacheConfig?.enabled) {
    cacheManager = getGlobalFunctionCacheManager(cacheConfig);
    
    const cached = cacheManager.get<TArgs, TReturn>(fn, args);
    if (cached) {
      return {
        ok: true,
        isRetryable: true,
        data: returnResult ? cached.data : undefined,
        timestamp: new Date(cached.timestamp).toISOString(),
        executionTime: 0,
        fromCache: true
      };
    }
  }

  try {
    if (trialMode.enabled) {
      const trialCondition =
        Math.random() <= (trialMode?.reqFailureProbability ?? 0);
      if (trialCondition) {
        console.error(
          `${formatLogContext(executionContext)}stable-request: Function execution failed in trial mode.\nFunction: ${fn.name || 'anonymous'}\nArgs:\n`,
          safelyStringify(args, maxSerializableChars)
        );
        throw new Error(`${formatLogContext(executionContext)}stable-request: Function execution failed in trial mode.`);
      } else {
        stopTime = Date.now();
        return {
          ok: true,
          isRetryable: true,
          data: returnResult ? { trialMode } as any : undefined,
          timestamp,
          executionTime: stopTime - startTime
        };
      }
    }

    const result = await fn(...args);
    stopTime = Date.now();
    
    if (cacheManager) {
      cacheManager.set(fn, args, result);
    }

    return {
      ok: true,
      isRetryable: true,
      data: returnResult ? result : undefined,
      timestamp,
      executionTime: stopTime - startTime
    };
  } catch (error: any) {
    stopTime = Date.now();
    const executionTime = stopTime - startTime;
    
    return {
      ok: false,
      isRetryable: true,
      error: `${formatLogContext(executionContext)}stable-request: ${error.message || String(error)}`,
      timestamp,
      executionTime
    };
  }
}
