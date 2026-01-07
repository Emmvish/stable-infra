import { stableRequest } from "../core/index.js";
import {
    API_GATEWAY_REQUEST,
    API_GATEWAY_RESPONSE ,
    CONCURRENT_REQUEST_EXECUTION_OPTIONS,
} from '../types/index.js';
import { prepareApiRequestData } from "./prepare-api-request-data.js";
import { prepareApiRequestOptions } from "./prepare-api-request-options.js";
import { ConcurrencyLimiter } from "./concurrency-limiter.js";
import { RateLimiter } from "./rate-limiter.js";
import { CircuitBreaker, CircuitBreakerOpenError } from "./circuit-breaker.js";

export async function executeConcurrently<RequestDataType = any, ResponseDataType = any>(
    requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[] = [],
    requestExecutionOptions: CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType> = {}
): Promise<API_GATEWAY_RESPONSE<ResponseDataType>[]> {
    const responses: API_GATEWAY_RESPONSE<ResponseDataType>[] = [];
    const stopOnFirstError = requestExecutionOptions.stopOnFirstError || false;
    
    const circuitBreaker = requestExecutionOptions.circuitBreaker
        ? (requestExecutionOptions.circuitBreaker instanceof CircuitBreaker 
            ? requestExecutionOptions.circuitBreaker 
            : new CircuitBreaker(requestExecutionOptions.circuitBreaker as any))
        : null;
    
    const requestFunctions = requests.map((req) => {
        return async () => {
            if (circuitBreaker && !circuitBreaker.getState().config.trackIndividualAttempts) {
                const canExecute = await circuitBreaker.canExecute();
                if (!canExecute) {
                    throw new CircuitBreakerOpenError(
                        `stable-request: Circuit breaker is ${circuitBreaker.getState().state}. Request blocked.`
                    );
                }
            }

            const finalRequestOptions = { 
                reqData: prepareApiRequestData<RequestDataType, ResponseDataType>(req, requestExecutionOptions),
                ...prepareApiRequestOptions<RequestDataType, ResponseDataType>(req, requestExecutionOptions),
                commonBuffer: requestExecutionOptions.sharedBuffer ?? req.requestOptions.commonBuffer,
                ...(circuitBreaker ? { circuitBreaker } : {}),
                executionContext: {
                    ...requestExecutionOptions.executionContext,
                    requestId: req.id
                }
            };

            try {
                const result = await stableRequest<RequestDataType, ResponseDataType>(finalRequestOptions);
                
                if (circuitBreaker && !circuitBreaker.getState().config.trackIndividualAttempts) {
                    circuitBreaker.recordSuccess();
                }
                
                return result;
            } catch (error) {
                if (circuitBreaker && 
                    !(error instanceof CircuitBreakerOpenError) &&
                    !circuitBreaker.getState().config.trackIndividualAttempts) {
                    circuitBreaker.recordFailure();
                }
                throw error;
            }
        };
    });

    const hasConcurrencyLimit = requestExecutionOptions.maxConcurrentRequests && 
        requestExecutionOptions.maxConcurrentRequests > 0 && 
        requestExecutionOptions.maxConcurrentRequests < requests.length;
    
    const hasRateLimit = requestExecutionOptions.rateLimit && 
        requestExecutionOptions.rateLimit.maxRequests > 0 &&
        requestExecutionOptions.rateLimit.windowMs > 0;

    let stableRequests: Promise<boolean | ResponseDataType>[];
    let settledResponses: PromiseSettledResult<boolean | ResponseDataType>[];

    if (stopOnFirstError) {
        const results: PromiseSettledResult<boolean | ResponseDataType>[] = [];
        let errorDetected = false;
        const activePromises = new Set<Promise<void>>();

        const concurrencyLimiter = hasConcurrencyLimit 
            ? new ConcurrencyLimiter(requestExecutionOptions.maxConcurrentRequests!)
            : null;
        const rateLimiter = hasRateLimit 
            ? new RateLimiter(
                requestExecutionOptions.rateLimit!.maxRequests,
                requestExecutionOptions.rateLimit!.windowMs
            )
            : null;

        const createExecutor = (fn: () => Promise<boolean | ResponseDataType>) => {
            if (concurrencyLimiter && rateLimiter) {
                return () => concurrencyLimiter.execute(() => rateLimiter.execute(fn));
            } else if (concurrencyLimiter) {
                return () => concurrencyLimiter.execute(fn);
            } else if (rateLimiter) {
                return () => rateLimiter.execute(fn);
            }
            return fn;
        };

        for (let i = 0; i < requestFunctions.length; i++) {
            if (errorDetected) {
                break;
            }

            const executor = createExecutor(requestFunctions[i]);
            const executeRequest = async (index: number) => {
                try {
                    const result = await executor();
                    results[index] = { status: 'fulfilled', value: result };
                } catch (error) {
                    results[index] = { status: 'rejected', reason: error };
                    errorDetected = true;
                }
            };

            const promise = executeRequest(i);
            activePromises.add(promise);
            
            promise.finally(() => activePromises.delete(promise));

            if (i < requestFunctions.length - 1) {
                await Promise.race([
                    promise,
                    new Promise(resolve => setTimeout(resolve, 0))
                ]);
            }
        }

        if (activePromises.size > 0) {
            await Promise.all(Array.from(activePromises));
        }
        
        settledResponses = results.filter(r => r !== undefined);
    } else {
        if (hasConcurrencyLimit && hasRateLimit) {
            const concurrencyLimiter = new ConcurrencyLimiter(requestExecutionOptions.maxConcurrentRequests!);
            const rateLimiter = new RateLimiter(
                requestExecutionOptions.rateLimit!.maxRequests,
                requestExecutionOptions.rateLimit!.windowMs
            );

            stableRequests = requestFunctions.map(fn => 
                concurrencyLimiter.execute(() => rateLimiter.execute(fn))
            );
        } else if (hasConcurrencyLimit) {
            const concurrencyLimiter = new ConcurrencyLimiter(requestExecutionOptions.maxConcurrentRequests!);
            stableRequests = requestFunctions.map(fn => concurrencyLimiter.execute(fn));
        } else if (hasRateLimit) {
            const rateLimiter = new RateLimiter(
                requestExecutionOptions.rateLimit!.maxRequests,
                requestExecutionOptions.rateLimit!.windowMs
            );
            stableRequests = requestFunctions.map(fn => rateLimiter.execute(fn));
        } else {
            stableRequests = requestFunctions.map(fn => fn());
        }

        settledResponses = await Promise.allSettled(stableRequests);
    }
    
    for (let i = 0; i < settledResponses.length; i++) {
        const res = settledResponses[i];
        const req = requests[i];
        
        if(res.status === 'fulfilled') {
            const value = res.value;
            const isSuccess = value !== false;
            responses.push({
                requestId: req.id,
                ...(req.groupId && { groupId: req.groupId }),
                success: isSuccess,
                ...(isSuccess && typeof value !== 'boolean' && { data: value as ResponseDataType }),
                ...(!isSuccess && {
                    error: 'Request was unsuccessful, but the error was analyzed successfully!'
                })
            });
        } else {
            const error = res.reason;
            const isCircuitBreakerError = error instanceof CircuitBreakerOpenError;
            
            responses.push({
                requestId: req.id,
                ...(req.groupId && { groupId: req.groupId }),
                success: false,
                error: isCircuitBreakerError 
                    ? `Circuit breaker open: ${error.message}`
                    : (error?.message || 'An error occurred! Error description is unavailable.')
            });
        }
    }
    
    return responses;
}