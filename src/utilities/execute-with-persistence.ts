import { PersistenceStage } from '../enums/index.js';
import { StatePersistenceConfig, ExecutionContext } from '../types/index.js';
import { safelyExecuteUnknownFunction } from './safely-execute-unknown-function.js';
import { formatLogContext } from './format-log-context.js';

export async function executeWithPersistence<T = any>(
  hookFn: Function,
  hookOptions: any,
  persistenceConfig?: StatePersistenceConfig,
  executionContext: ExecutionContext = {},
  buffer: Record<string, any> = {}
): Promise<T> {
  if (persistenceConfig?.loadBeforeHooks && persistenceConfig.persistenceFunction) {
    try {
      const loadedState = await safelyExecuteUnknownFunction(
        persistenceConfig.persistenceFunction,
        {
          executionContext,
          params: persistenceConfig.persistenceParams,
          buffer: { ...buffer },
          persistenceStage: PersistenceStage.BEFORE_HOOK
        }
      );
      
      if (loadedState && typeof loadedState === 'object') {
        Object.assign(buffer, loadedState);
      }
    } catch (error: any) {
      console.error(
        `${formatLogContext(executionContext)}stable-request: \nState persistence: Failed to load state before hook execution: ${error.message}`
      );
    }
  }

  const result = await safelyExecuteUnknownFunction(hookFn, hookOptions);

  if (persistenceConfig?.storeAfterHooks && persistenceConfig.persistenceFunction) {
    try {
      await safelyExecuteUnknownFunction(
        persistenceConfig.persistenceFunction,
        {
          executionContext,
          params: persistenceConfig.persistenceParams,
          buffer: { ...buffer },
          persistenceStage: PersistenceStage.AFTER_HOOK
        }
      );
    } catch (error: any) {
      console.error(
        `${formatLogContext(executionContext)}stable-request: \nState persistence: Failed to store state after hook execution: ${error.message}`
      );
    }
  }

  return result;
}
