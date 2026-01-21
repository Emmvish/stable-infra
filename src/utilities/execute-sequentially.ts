import { executeGatewayItem } from "./execute-gateway-item.js";
import { RequestOrFunction } from "../enums/index.js";
import {
    API_GATEWAY_REQUEST,
    API_GATEWAY_ITEM,
    API_GATEWAY_RESPONSE,
    SEQUENTIAL_REQUEST_EXECUTION_OPTIONS 
} from '../types/index.js';
import { CircuitBreaker, CircuitBreakerOpenError } from "./circuit-breaker.js";

export async function executeSequentially<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
    items: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[] | API_GATEWAY_ITEM<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[] = [],
    requestExecutionOptions: SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> = {}
): Promise<API_GATEWAY_RESPONSE<ResponseDataType | FunctionReturnType>[]> {
    const responses: API_GATEWAY_RESPONSE<ResponseDataType | FunctionReturnType>[] = [];
    
    const circuitBreaker = requestExecutionOptions.circuitBreaker
        ? (requestExecutionOptions.circuitBreaker instanceof CircuitBreaker 
            ? requestExecutionOptions.circuitBreaker 
            : new CircuitBreaker(requestExecutionOptions.circuitBreaker))
        : null;
    
    const unifiedItems: API_GATEWAY_ITEM<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[] = items.map(item => {
        if ('type' in item) {
            return item as API_GATEWAY_ITEM<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>;
        }
        return {
            type: RequestOrFunction.REQUEST,
            request: item
        };
    });
    
    for (let i = 0; i < unifiedItems.length; i++) {
        const item = unifiedItems[i];
        
        try {
            const response = await executeGatewayItem(item, requestExecutionOptions, circuitBreaker);
            responses.push(response);
            
            if (!response.success && requestExecutionOptions.stopOnFirstError) {
                break;
            }
        } catch (error: any) {
            const itemId = item.type === RequestOrFunction.REQUEST ? item.request.id : item.function.id;
            const groupId = item.type === RequestOrFunction.REQUEST ? item.request.groupId : item.function.groupId;
            const isCircuitBreakerError = error instanceof CircuitBreakerOpenError;
            
            responses.push({
                requestId: itemId,
                ...(groupId && { groupId }),
                success: false,
                error: isCircuitBreakerError 
                    ? `Circuit breaker open: ${error.message}`
                    : (error?.message || 'An error occurred! Error description is unavailable.'),
                type: item.type
            });
            
            if (requestExecutionOptions.stopOnFirstError) {
                break;
            }
        }
    }
    
    return responses;
}