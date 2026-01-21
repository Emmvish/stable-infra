import { 
    API_GATEWAY_FUNCTION,
    API_GATEWAY_OPTIONS,
    STABLE_FUNCTION,
} from '../types/index.js';

export function prepareApiFunctionOptions<TArgs extends any[], TReturn, RequestDataType = any, ResponseDataType = any>(
    func: API_GATEWAY_FUNCTION<TArgs, TReturn>,
    gatewayOptions: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, TArgs, TReturn>
): Omit<STABLE_FUNCTION<TArgs, TReturn>, 'fn' | 'args'> {
    const funcGroup = (func.groupId && Array.isArray(gatewayOptions.requestGroups)) 
        ? gatewayOptions.requestGroups?.find(group => group.id === func.groupId) 
        : undefined;
    
    const functionOptions: Omit<STABLE_FUNCTION<TArgs, TReturn>, 'fn' | 'args'> = {
        ...func.functionOptions,
        returnResult: func.functionOptions.returnResult ?? funcGroup?.commonConfig?.commonReturnResult ?? gatewayOptions.commonReturnResult ?? true,
        attempts: func.functionOptions.attempts ?? funcGroup?.commonConfig?.commonAttempts ?? gatewayOptions.commonAttempts,
        performAllAttempts: func.functionOptions.performAllAttempts ?? funcGroup?.commonConfig?.commonPerformAllAttempts ?? gatewayOptions.commonPerformAllAttempts,
        wait: func.functionOptions.wait ?? funcGroup?.commonConfig?.commonWait ?? gatewayOptions.commonWait,
        maxAllowedWait: func.functionOptions.maxAllowedWait ?? funcGroup?.commonConfig?.commonMaxAllowedWait ?? gatewayOptions.commonMaxAllowedWait,
        retryStrategy: func.functionOptions.retryStrategy ?? funcGroup?.commonConfig?.commonRetryStrategy ?? gatewayOptions.commonRetryStrategy,
        jitter: func.functionOptions.jitter ?? funcGroup?.commonConfig?.commonJitter ?? gatewayOptions.commonJitter,
        logAllErrors: func.functionOptions.logAllErrors ?? funcGroup?.commonConfig?.commonLogAllErrors ?? gatewayOptions.commonLogAllErrors,
        logAllSuccessfulAttempts: func.functionOptions.logAllSuccessfulAttempts ?? funcGroup?.commonConfig?.commonLogAllSuccessfulAttempts ?? gatewayOptions.commonLogAllSuccessfulAttempts,
        maxSerializableChars: func.functionOptions.maxSerializableChars ?? funcGroup?.commonConfig?.commonMaxSerializableChars ?? gatewayOptions.commonMaxSerializableChars,
        trialMode: func.functionOptions.trialMode ?? funcGroup?.commonConfig?.commonTrialMode ?? gatewayOptions.commonTrialMode,
        hookParams: func.functionOptions.hookParams ?? funcGroup?.commonConfig?.commonFunctionHookParams ?? gatewayOptions.commonFunctionHookParams,
        preExecution: func.functionOptions.preExecution ?? funcGroup?.commonConfig?.commonFunctionPreExecution ?? gatewayOptions.commonFunctionPreExecution,
        commonBuffer: func.functionOptions.commonBuffer ?? gatewayOptions.sharedBuffer,
        cache: func.functionOptions.cache ?? funcGroup?.commonConfig?.commonFunctionCache ?? gatewayOptions.commonFunctionCache,
        statePersistence: func.functionOptions.statePersistence ?? funcGroup?.commonConfig?.commonStatePersistence ?? gatewayOptions.commonStatePersistence,
        executionTimeout: func.functionOptions.executionTimeout ?? funcGroup?.commonConfig?.commonExecutionTimeout ?? gatewayOptions.commonExecutionTimeout,
    };

    if (!func.functionOptions.handleErrors && funcGroup?.commonConfig?.commonHandleFunctionErrors) {
        functionOptions.handleErrors = funcGroup.commonConfig.commonHandleFunctionErrors;
    } else if (!func.functionOptions.handleErrors && gatewayOptions.commonHandleFunctionErrors) {
        functionOptions.handleErrors = gatewayOptions.commonHandleFunctionErrors;
    }
    
    if (!func.functionOptions.handleSuccessfulAttemptData && funcGroup?.commonConfig?.commonHandleSuccessfulFunctionAttemptData) {
        functionOptions.handleSuccessfulAttemptData = funcGroup.commonConfig.commonHandleSuccessfulFunctionAttemptData;
    } else if (!func.functionOptions.handleSuccessfulAttemptData && gatewayOptions.commonHandleSuccessfulFunctionAttemptData) {
        functionOptions.handleSuccessfulAttemptData = gatewayOptions.commonHandleSuccessfulFunctionAttemptData;
    }
    
    if (!func.functionOptions.responseAnalyzer && funcGroup?.commonConfig?.commonFunctionResponseAnalyzer) {
        functionOptions.responseAnalyzer = funcGroup.commonConfig.commonFunctionResponseAnalyzer;
    } else if (!func.functionOptions.responseAnalyzer && gatewayOptions.commonFunctionResponseAnalyzer) {
        functionOptions.responseAnalyzer = gatewayOptions.commonFunctionResponseAnalyzer;
    }
    
    if (!func.functionOptions.finalErrorAnalyzer && funcGroup?.commonConfig?.commonFinalFunctionErrorAnalyzer) {
        functionOptions.finalErrorAnalyzer = funcGroup.commonConfig.commonFinalFunctionErrorAnalyzer;
    } else if (!func.functionOptions.finalErrorAnalyzer && gatewayOptions.commonFinalFunctionErrorAnalyzer) {
        functionOptions.finalErrorAnalyzer = gatewayOptions.commonFinalFunctionErrorAnalyzer;
    }

    return functionOptions;
}
