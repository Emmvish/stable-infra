
import { stableRequest, stableFunction } from "../core/index.js";
import {
    API_GATEWAY_REQUEST,
    API_GATEWAY_FUNCTION,
    API_GATEWAY_ITEM,
    API_GATEWAY_RESPONSE,
    API_GATEWAY_OPTIONS,
    STABLE_REQUEST_RESULT,
    STABLE_FUNCTION_RESULT
} from '../types/index.js';
import { prepareApiRequestData } from "./prepare-api-request-data.js";
import { prepareApiRequestOptions } from "./prepare-api-request-options.js";
import { prepareApiFunctionOptions } from "./prepare-api-function-options.js";
import { CircuitBreaker, CircuitBreakerOpenError } from "./circuit-breaker.js";
import { RequestOrFunction } from "../enums/index.js";

export async function executeGatewayItem<RequestDataType = any, ResponseDataType = any>(
    item: API_GATEWAY_ITEM<RequestDataType, ResponseDataType, any[], any>,
    gatewayOptions: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>,
    circuitBreaker: CircuitBreaker | null
): Promise<API_GATEWAY_RESPONSE<ResponseDataType>> {
    if (item.type === RequestOrFunction.REQUEST) {
        return await executeGatewayRequest(item.request, gatewayOptions, circuitBreaker);
    } else {
        return await executeGatewayFunction(item.function, gatewayOptions, circuitBreaker);
    }
}

export async function executeGatewayRequest<RequestDataType = any, ResponseDataType = any>(
    req: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>,
    gatewayOptions: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>,
    circuitBreaker: CircuitBreaker | null
): Promise<API_GATEWAY_RESPONSE<ResponseDataType>> {
    if (circuitBreaker && !circuitBreaker.getState().config.trackIndividualAttempts) {
        const canExecute = await circuitBreaker.canExecute();
        if (!canExecute) {
            throw new CircuitBreakerOpenError(
                `stable-request: Circuit breaker is ${circuitBreaker.getState().state}. Request blocked.`
            );
        }
    }

    const finalRequestOptions = { 
        reqData: prepareApiRequestData<RequestDataType, ResponseDataType>(req, gatewayOptions),
        ...prepareApiRequestOptions<RequestDataType, ResponseDataType>(req, gatewayOptions),
        commonBuffer: gatewayOptions.sharedBuffer ?? req.requestOptions.commonBuffer,
        ...(circuitBreaker ? { circuitBreaker } : {}),
        executionContext: {
            ...gatewayOptions.executionContext,
            requestId: req.id
        }
    };

    try {
        const result: STABLE_REQUEST_RESULT<ResponseDataType> = await stableRequest<RequestDataType, ResponseDataType>(finalRequestOptions);
        
        if (circuitBreaker && !circuitBreaker.getState().config.trackIndividualAttempts) {
            circuitBreaker.recordSuccess();
        }
        
        return {
            requestId: req.id,
            groupId: req.groupId,
            success: result.success,
            data: result.data,
            error: result.error,
            type: RequestOrFunction.REQUEST
        };
    } catch (error: any) {
        if (circuitBreaker && 
            !(error instanceof CircuitBreakerOpenError) &&
            !circuitBreaker.getState().config.trackIndividualAttempts) {
            circuitBreaker.recordFailure();
        }
        
        return {
            requestId: req.id,
            groupId: req.groupId,
            success: false,
            error: error.message || String(error),
            type: RequestOrFunction.REQUEST
        };
    }
}

export async function executeGatewayFunction<TArgs extends any[] = any[], TReturn = any>(
    func: API_GATEWAY_FUNCTION<TArgs, TReturn>,
    gatewayOptions: API_GATEWAY_OPTIONS<any, any>,
    circuitBreaker: CircuitBreaker | null
): Promise<API_GATEWAY_RESPONSE<TReturn>> {
    if (!func.functionOptions.fn || !func.functionOptions.args) {
        return {
            requestId: func.id,
            groupId: func.groupId,
            success: false,
            error: 'Function or args not provided',
            type: RequestOrFunction.FUNCTION
        };
    }

    if (circuitBreaker && !circuitBreaker.getState().config.trackIndividualAttempts) {
        const canExecute = await circuitBreaker.canExecute();
        if (!canExecute) {
            throw new CircuitBreakerOpenError(
                `stable-request: Circuit breaker is ${circuitBreaker.getState().state}. Function execution blocked.`
            );
        }
    }

    const finalFunctionOptions = {
        fn: func.functionOptions.fn,
        args: func.functionOptions.args,
        ...prepareApiFunctionOptions(func, gatewayOptions),
        commonBuffer: gatewayOptions.sharedBuffer ?? func.functionOptions.commonBuffer,
        ...(circuitBreaker ? { circuitBreaker } : {}),
        executionContext: {
            ...gatewayOptions.executionContext,
            requestId: func.id
        }
    };

    try {
        const result: STABLE_FUNCTION_RESULT<TReturn> = await stableFunction<TArgs, TReturn>(finalFunctionOptions);
        
        if (circuitBreaker && !circuitBreaker.getState().config.trackIndividualAttempts) {
            circuitBreaker.recordSuccess();
        }
        
        return {
            requestId: func.id,
            groupId: func.groupId,
            success: result.success,
            data: result.data,
            error: result.error,
            type: RequestOrFunction.FUNCTION
        };
    } catch (error: any) {
        if (circuitBreaker && 
            !(error instanceof CircuitBreakerOpenError) &&
            !circuitBreaker.getState().config.trackIndividualAttempts) {
            circuitBreaker.recordFailure();
        }
        
        return {
            requestId: func.id,
            groupId: func.groupId,
            success: false,
            error: error.message || String(error),
            type: RequestOrFunction.FUNCTION
        };
    }
}
