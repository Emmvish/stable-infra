import { stableRequest } from "../core/index.js";
import { prepareApiRequestData } from "./prepare-api-request-data.js";
import { prepareApiRequestOptions } from './prepare-api-request-options.js';
import {
    API_GATEWAY_REQUEST,
    API_GATEWAY_RESPONSE,
    SEQUENTIAL_REQUEST_EXECUTION_OPTIONS 
} from '../types/index.js';
import { CircuitBreaker, CircuitBreakerOpenError } from "./circuit-breaker.js";

export async function executeSequentially<RequestDataType = any, ResponseDataType = any>(
    requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[] = [],
    requestExecutionOptions: SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType> = {}
): Promise<API_GATEWAY_RESPONSE<ResponseDataType>[]> {
    const responses: API_GATEWAY_RESPONSE<ResponseDataType>[] = [];
    
    // Support both config and instance
    const circuitBreaker = requestExecutionOptions.circuitBreaker
        ? (requestExecutionOptions.circuitBreaker instanceof CircuitBreaker 
            ? requestExecutionOptions.circuitBreaker 
            : new CircuitBreaker(requestExecutionOptions.circuitBreaker as any))
        : null;
    
    for (let i = 0; i < requests.length; i++) {
        const req = requests[i];
        
        try {
            if (circuitBreaker) {
                const canExecute = await circuitBreaker.canExecute();
                if (!canExecute) {
                    throw new CircuitBreakerOpenError(
                        `Circuit breaker is ${circuitBreaker.getState().state}. Request blocked.`
                    );
                }
            }

            const finalRequestOptions = { 
                reqData: prepareApiRequestData<RequestDataType, ResponseDataType>(req, requestExecutionOptions),
                ...prepareApiRequestOptions<RequestDataType, ResponseDataType>(req, requestExecutionOptions),
                commonBuffer: requestExecutionOptions.sharedBuffer ?? req.requestOptions.commonBuffer 
            };
            
            const stableReq = await stableRequest<RequestDataType, ResponseDataType>(finalRequestOptions);
            
            if (circuitBreaker) {
                circuitBreaker.recordSuccess();
            }
            
            const isSuccess = stableReq !== false;
            responses.push({
                requestId: req.id,
                ...(req.groupId && { groupId: req.groupId }),
                success: isSuccess,
                ...(isSuccess && typeof stableReq !== 'boolean' && { data: stableReq as ResponseDataType }),
                ...(!isSuccess && {
                    error: 'Request was unsuccessful, but the error was analyzed successfully!'
                })
            });
            
        } catch (error: any) {
            if (circuitBreaker && !(error instanceof CircuitBreakerOpenError)) {
                circuitBreaker.recordFailure();
            }
            
            const isCircuitBreakerError = error instanceof CircuitBreakerOpenError;
            
            responses.push({
                requestId: req.id,
                ...(req.groupId && { groupId: req.groupId }),
                success: false,
                error: isCircuitBreakerError 
                    ? `Circuit breaker open: ${error.message}`
                    : (error?.message || 'An error occurred! Error description is unavailable.')
            });
            
            if (requestExecutionOptions.stopOnFirstError) {
                break;
            }
        }
    }
    
    return responses;
}