import {
    API_GATEWAY_OPTIONS,
    API_GATEWAY_REQUEST,
    API_GATEWAY_FUNCTION,
    API_GATEWAY_ITEM,
    API_GATEWAY_RESPONSE,
    API_GATEWAY_RESULT,
    CacheDashboardMetrics,
    ConcurrencyLimiterDashboardMetrics,
    RateLimiterDashboardMetrics,
    CircuitBreakerDashboardMetrics,
    CONCURRENT_REQUEST_EXECUTION_OPTIONS,
    SEQUENTIAL_REQUEST_EXECUTION_OPTIONS
} from '../types/index.js';
import { 
    executeConcurrently,
    executeSequentially,
    extractCommonRequestConfigOptions as extractCommonOptions,
    MetricsAggregator,
    MetricsValidator,
    CircuitBreaker, 
    getGlobalCircuitBreaker,
    getGlobalCacheManager,
    getGlobalRateLimiter,
    getGlobalConcurrencyLimiter
} from '../utilities/index.js';
import { RequestOrFunction } from '../enums/index.js';

export async function stableApiGateway<RequestDataType = any, ResponseDataType = any>(
    requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[] | API_GATEWAY_ITEM<RequestDataType, ResponseDataType, any[], any>[],
    options: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>
): Promise<API_GATEWAY_RESULT<ResponseDataType>>;

export async function stableApiGateway<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
    requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[] | API_GATEWAY_ITEM<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[],
    functions: API_GATEWAY_FUNCTION<FunctionArgsType, FunctionReturnType>[],
    options: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
): Promise<API_GATEWAY_RESULT<ResponseDataType | FunctionReturnType>>;

export async function stableApiGateway<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
    requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[] | API_GATEWAY_ITEM<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[] = [],
    functionsOrOptions?: API_GATEWAY_FUNCTION<FunctionArgsType, FunctionReturnType>[] | API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>,
    options?: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
): Promise<API_GATEWAY_RESULT<ResponseDataType | FunctionReturnType>> {
    const startTime = Date.now();
    
    let functions: API_GATEWAY_FUNCTION<FunctionArgsType, FunctionReturnType>[] = [];
    let finalOptions: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> = {};
    
    if (Array.isArray(functionsOrOptions)) {
        functions = functionsOrOptions as API_GATEWAY_FUNCTION<FunctionArgsType, FunctionReturnType>[];
        finalOptions = options || {};
    } else {
        finalOptions = functionsOrOptions || {};
    }

    if (finalOptions.maxTimeout) {
        const timeoutPromise = new Promise<API_GATEWAY_RESULT<ResponseDataType | FunctionReturnType>>((_, reject) => {
            setTimeout(() => {
                const contextStr = finalOptions.executionContext 
                    ? ` [${Object.entries(finalOptions.executionContext).map(([k, v]) => `${k}=${v}`).join(', ')}]`
                    : '';
                reject(new Error(`stable-request: Gateway execution exceeded maxTimeout of ${finalOptions.maxTimeout}ms${contextStr}`));
            }, finalOptions.maxTimeout);
        });

        const executionPromise = executeGateway(requests, functions, finalOptions, startTime);
        return Promise.race([executionPromise, timeoutPromise]);
    }

    return executeGateway(requests, functions, finalOptions, startTime);
}

async function executeGateway<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
    requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[] | API_GATEWAY_ITEM<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[],
    functions: API_GATEWAY_FUNCTION<FunctionArgsType, FunctionReturnType>[],
    finalOptions: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>,
    startTime: number
): Promise<API_GATEWAY_RESULT<ResponseDataType | FunctionReturnType>> {
    const {
        concurrentExecution = true,
        stopOnFirstError = false,
        requestGroups = [],
        maxConcurrentRequests,
        rateLimit,
        circuitBreaker,
        enableRacing = false,
    } = finalOptions;

    let items: API_GATEWAY_ITEM<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[] = [];
    
    if (requests.length > 0 && 'type' in requests[0]) {
        items = requests as API_GATEWAY_ITEM<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>[];
    } else {
        items = (requests as API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[]).map(req => ({
            type: RequestOrFunction.REQUEST,
            request: req
        }));
        
        items.push(...functions.map(fn => ({
            type: RequestOrFunction.FUNCTION as const,
            function: fn
        })));
    }

    if (items.length === 0) {
        const executionTime = Date.now() - startTime;
        const emptyResult = [] as API_GATEWAY_RESULT<ResponseDataType | FunctionReturnType>;
        emptyResult.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            successRate: 0,
            failureRate: 0,
            executionTime,
            timestamp: new Date().toISOString(),
            throughput: 0,
            averageRequestDuration: 0
        };
        return emptyResult;
    }

    const requestExecutionOptions: CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> | SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> = {
        stopOnFirstError,
        requestGroups,
        sharedBuffer: finalOptions.sharedBuffer,
        ...(maxConcurrentRequests !== undefined && { maxConcurrentRequests }),
        ...(rateLimit !== undefined && { rateLimit }),
        ...(circuitBreaker !== undefined && { circuitBreaker }),
        ...(enableRacing !== undefined && { enableRacing }),
        ...extractCommonOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>(finalOptions),
        executionContext: finalOptions.executionContext
    }

    let responses: API_GATEWAY_RESPONSE<ResponseDataType | FunctionReturnType>[];
    if (concurrentExecution) {
        responses = await executeConcurrently<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>(
            items,
            requestExecutionOptions
        );
    } else {
        responses = await executeSequentially<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>(
            items,
            requestExecutionOptions
        );
    }

    const successfulRequests = responses.filter(r => r.success).length;
    const failedRequests = responses.filter(r => !r.success).length;
    const totalRequests = responses.length;
    const executionTime = Date.now() - startTime;
    const throughput = executionTime > 0 ? (totalRequests / (executionTime / 1000)) : 0;
    const averageRequestDuration = totalRequests > 0 ? executionTime / totalRequests : 0;

    const result = responses as API_GATEWAY_RESULT<ResponseDataType | FunctionReturnType>;
    result.metrics = {
        totalRequests,
        successfulRequests,
        failedRequests,
        successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
        failureRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
        executionTime,
        timestamp: new Date().toISOString(),
        throughput,
        averageRequestDuration,
        requestGroups: MetricsAggregator.extractRequestGroupMetrics(responses)
    };

    const infrastructureMetrics: {
        circuitBreaker?: CircuitBreakerDashboardMetrics;
        cache?: CacheDashboardMetrics;
        rateLimiter?: RateLimiterDashboardMetrics;
        concurrencyLimiter?: ConcurrencyLimiterDashboardMetrics;
    } = {};
    
    if (circuitBreaker) {
        const cb = circuitBreaker instanceof CircuitBreaker ? circuitBreaker : getGlobalCircuitBreaker();
        if (cb) {
            infrastructureMetrics.circuitBreaker = MetricsAggregator.extractCircuitBreakerMetrics(cb);
        }
    }
    
    if (finalOptions.commonCache) {
        const cache = getGlobalCacheManager();
        if (cache) {
            infrastructureMetrics.cache = MetricsAggregator.extractCacheMetrics(cache);
        }
    }
    
    if (rateLimit) {
        const rateLimiter = getGlobalRateLimiter();
        if (rateLimiter) {
            infrastructureMetrics.rateLimiter = MetricsAggregator.extractRateLimiterMetrics(rateLimiter);
        }
    }
    
    if (maxConcurrentRequests) {
        const concurrencyLimiter = getGlobalConcurrencyLimiter();
        if (concurrencyLimiter) {
            infrastructureMetrics.concurrencyLimiter = MetricsAggregator.extractConcurrencyLimiterMetrics(concurrencyLimiter);
        }
    }
    
    if (Object.keys(infrastructureMetrics).length > 0) {
        result.metrics.infrastructureMetrics = infrastructureMetrics;
    }

    if (finalOptions.metricsGuardrails) {
        const validation = MetricsValidator.validateApiGatewayMetrics(
            result.metrics,
            finalOptions.metricsGuardrails
        );
        
        if (result.metrics.infrastructureMetrics) {
            const infraValidation = MetricsValidator.validateInfrastructureMetrics(
                result.metrics.infrastructureMetrics,
                finalOptions.metricsGuardrails
            );
            
            validation.anomalies.push(...infraValidation.anomalies);
            validation.isValid = validation.isValid && infraValidation.isValid;
        }
        
        result.metrics.validation = validation;
    }

    return result;
}