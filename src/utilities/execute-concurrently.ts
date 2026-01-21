import { RequestOrFunction } from '../enums/index.js';
import {
    API_GATEWAY_REQUEST,
    API_GATEWAY_ITEM,
    API_GATEWAY_RESPONSE,
    CONCURRENT_REQUEST_EXECUTION_OPTIONS,
} from '../types/index.js';
import { executeGatewayItem } from "./execute-gateway-item.js";
import { ConcurrencyLimiter } from "./concurrency-limiter.js";
import { RateLimiter } from "./rate-limiter.js";
import { CircuitBreaker, CircuitBreakerOpenError } from "./circuit-breaker.js";

export async function executeConcurrently<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
    items: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[] | API_GATEWAY_ITEM<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[] = [],
    requestExecutionOptions: CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> = {}
): Promise<API_GATEWAY_RESPONSE<ResponseDataType | FunctionReturnType>[]> {
    const responses: API_GATEWAY_RESPONSE<ResponseDataType | FunctionReturnType>[] = [];
    const stopOnFirstError = requestExecutionOptions.stopOnFirstError || false;
    const enableRacing = requestExecutionOptions.enableRacing || false;
    
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
            type: RequestOrFunction.REQUEST as const,
            request: item
        };
    });
    
    const itemFunctions = unifiedItems.map((item) => {
        return async () => {
            return await executeGatewayItem(item, requestExecutionOptions, circuitBreaker);
        };
    });

    const hasConcurrencyLimit = requestExecutionOptions.maxConcurrentRequests && 
        requestExecutionOptions.maxConcurrentRequests > 0 && 
        requestExecutionOptions.maxConcurrentRequests < unifiedItems.length;
    
    const hasRateLimit = requestExecutionOptions.rateLimit && 
        requestExecutionOptions.rateLimit.maxRequests > 0 &&
        requestExecutionOptions.rateLimit.windowMs > 0;

    let itemResults: Promise<API_GATEWAY_RESPONSE<ResponseDataType | FunctionReturnType>>[];
    let settledResponses: PromiseSettledResult<API_GATEWAY_RESPONSE<ResponseDataType | FunctionReturnType>>[];

    if (enableRacing) {
        const abortControllers = new Map<number, AbortController>();
        
        const concurrencyLimiter = hasConcurrencyLimit 
            ? new ConcurrencyLimiter(requestExecutionOptions.maxConcurrentRequests!)
            : null;
        const rateLimiter = hasRateLimit 
            ? new RateLimiter(
                requestExecutionOptions.rateLimit!.maxRequests,
                requestExecutionOptions.rateLimit!.windowMs
            )
            : null;

        const createExecutor = (fn: () => Promise<API_GATEWAY_RESPONSE<ResponseDataType | FunctionReturnType>>, index: number) => {
            const wrappedFn = async () => {
                const controller = new AbortController();
                abortControllers.set(index, controller);
                
                try {
                    const result = await fn();
                    return result;
                } finally {
                    abortControllers.delete(index);
                }
            };
            
            if (concurrencyLimiter && rateLimiter) {
                return () => concurrencyLimiter.execute(() => rateLimiter.execute(wrappedFn));
            } else if (concurrencyLimiter) {
                return () => concurrencyLimiter.execute(wrappedFn);
            } else if (rateLimiter) {
                return () => rateLimiter.execute(wrappedFn);
            }
            return wrappedFn;
        };

        const racePromises = itemFunctions.map((fn, index) => {
            const executor = createExecutor(fn, index);
            return executor().then(
                result => ({ index, result, error: null }),
                error => ({ index, result: null, error })
            );
        });

        try {
            const winner = await Promise.race(racePromises);
            
            abortControllers.forEach(controller => {
                try {
                    controller.abort();
                } catch (e) {
                }
            });

            if (winner.result && winner.result.success) {
                responses.push(winner.result);
                
                for (let i = 0; i < unifiedItems.length; i++) {
                    if (i !== winner.index) {
                        const item = unifiedItems[i];
                        const itemId = item.type === RequestOrFunction.REQUEST ? item.request.id : item.function.id;
                        const groupId = item.type === RequestOrFunction.REQUEST ? item.request.groupId : item.function.groupId;
                        
                        responses.push({
                            requestId: itemId,
                            ...(groupId && { groupId }),
                            success: false,
                            error: 'Cancelled - another request/function won the race',
                            type: item.type
                        });
                    }
                }
            } else {
                const allResults = await Promise.allSettled(racePromises);
                
                let foundSuccess = false;
                for (const settled of allResults) {
                    if (settled.status === 'fulfilled' && settled.value.result && settled.value.result.success) {
                        responses.push(settled.value.result);
                        foundSuccess = true;
                        break;
                    }
                }
                
                if (!foundSuccess) {
                    if (winner.result) {
                        responses.push(winner.result);
                    } else if (winner.error) {
                        const item = unifiedItems[winner.index];
                        const itemId = item.type === RequestOrFunction.REQUEST ? item.request.id : item.function.id;
                        const groupId = item.type === RequestOrFunction.REQUEST ? item.request.groupId : item.function.groupId;
                        const isCircuitBreakerError = winner.error instanceof CircuitBreakerOpenError;
                        
                        responses.push({
                            requestId: itemId,
                            ...(groupId && { groupId }),
                            success: false,
                            error: isCircuitBreakerError 
                                ? `Circuit breaker open: ${winner.error.message}`
                                : (winner.error?.message || 'An error occurred! Error description is unavailable.'),
                            type: item.type
                        });
                    }
                }
                
                for (let i = 0; i < unifiedItems.length; i++) {
                    if (i !== winner.index) {
                        const item = unifiedItems[i];
                        const itemId = item.type === RequestOrFunction.REQUEST ? item.request.id : item.function.id;
                        const groupId = item.type === RequestOrFunction.REQUEST ? item.request.groupId : item.function.groupId;
                        
                        responses.push({
                            requestId: itemId,
                            ...(groupId && { groupId }),
                            success: false,
                            error: 'Cancelled - racing mode',
                            type: item.type
                        });
                    }
                }
            }
        } catch (error) {
            for (let i = 0; i < unifiedItems.length; i++) {
                const item = unifiedItems[i];
                const itemId = item.type === RequestOrFunction.REQUEST ? item.request.id : item.function.id;
                const groupId = item.type === RequestOrFunction.REQUEST ? item.request.groupId : item.function.groupId;
                
                responses.push({
                    requestId: itemId,
                    ...(groupId && { groupId }),
                    success: false,
                    error: error instanceof Error ? error.message : 'An error occurred during racing',
                    type: item.type
                });
            }
        }
        
        return responses;
    }

    if (stopOnFirstError) {
        const results: PromiseSettledResult<API_GATEWAY_RESPONSE<ResponseDataType | FunctionReturnType>>[] = [];
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

        const createExecutor = (fn: () => Promise<API_GATEWAY_RESPONSE<ResponseDataType | FunctionReturnType>>) => {
            if (concurrencyLimiter && rateLimiter) {
                return () => concurrencyLimiter.execute(() => rateLimiter.execute(fn));
            } else if (concurrencyLimiter) {
                return () => concurrencyLimiter.execute(fn);
            } else if (rateLimiter) {
                return () => rateLimiter.execute(fn);
            }
            return fn;
        };

        for (let i = 0; i < itemFunctions.length; i++) {
            if (errorDetected) {
                break;
            }

            const executor = createExecutor(itemFunctions[i]);
            const executeItem = async (index: number) => {
                try {
                    const result = await executor();
                    results[index] = { status: 'fulfilled', value: result };
                    if (!result.success) {
                        errorDetected = true;
                    }
                } catch (error) {
                    results[index] = { status: 'rejected', reason: error };
                    errorDetected = true;
                }
            };

            const promise = executeItem(i);
            activePromises.add(promise);
            
            promise.finally(() => activePromises.delete(promise));

            if (i < itemFunctions.length - 1) {
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

            itemResults = itemFunctions.map(fn => 
                concurrencyLimiter.execute(() => rateLimiter.execute(fn))
            );
        } else if (hasConcurrencyLimit) {
            const concurrencyLimiter = new ConcurrencyLimiter(requestExecutionOptions.maxConcurrentRequests!);
            itemResults = itemFunctions.map(fn => concurrencyLimiter.execute(fn));
        } else if (hasRateLimit) {
            const rateLimiter = new RateLimiter(
                requestExecutionOptions.rateLimit!.maxRequests,
                requestExecutionOptions.rateLimit!.windowMs
            );
            itemResults = itemFunctions.map(fn => rateLimiter.execute(fn));
        } else {
            itemResults = itemFunctions.map(fn => fn());
        }

        settledResponses = await Promise.allSettled(itemResults);
    }
    
    for (let i = 0; i < settledResponses.length; i++) {
        const res = settledResponses[i];
        
        if(res.status === 'fulfilled') {
            responses.push(res.value);
        } else {
            const error = res.reason;
            const item = unifiedItems[i];
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
        }
    }
    
    return responses;
}