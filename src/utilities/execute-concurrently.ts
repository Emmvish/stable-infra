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

export async function executeConcurrently<RequestDataType = any, ResponseDataType = any>(
    items: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[] | API_GATEWAY_ITEM<RequestDataType, ResponseDataType, any[], any>[] = [],
    requestExecutionOptions: CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType> = {}
): Promise<API_GATEWAY_RESPONSE<ResponseDataType>[]> {
    const responses: API_GATEWAY_RESPONSE<ResponseDataType>[] = [];
    const stopOnFirstError = requestExecutionOptions.stopOnFirstError || false;
    
    const circuitBreaker = requestExecutionOptions.circuitBreaker
        ? (requestExecutionOptions.circuitBreaker instanceof CircuitBreaker 
            ? requestExecutionOptions.circuitBreaker 
            : new CircuitBreaker(requestExecutionOptions.circuitBreaker as any))
        : null;
    
    const unifiedItems: API_GATEWAY_ITEM<RequestDataType, ResponseDataType, any[], any>[] = items.map(item => {
        if ('type' in item) {
            return item as API_GATEWAY_ITEM<RequestDataType, ResponseDataType, any[], any>;
        } else {
            return {
                type: RequestOrFunction.REQUEST as const,
                request: item as API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>
            };
        }
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

    let itemResults: Promise<API_GATEWAY_RESPONSE<ResponseDataType>>[];
    let settledResponses: PromiseSettledResult<API_GATEWAY_RESPONSE<ResponseDataType>>[];

    if (stopOnFirstError) {
        const results: PromiseSettledResult<API_GATEWAY_RESPONSE<ResponseDataType>>[] = [];
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

        const createExecutor = (fn: () => Promise<API_GATEWAY_RESPONSE<ResponseDataType>>) => {
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