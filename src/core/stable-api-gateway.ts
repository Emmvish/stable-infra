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
    let functions: API_GATEWAY_FUNCTION<FunctionArgsType, FunctionReturnType>[] = [];
    let finalOptions: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> = {};
    
    if (Array.isArray(functionsOrOptions)) {
        functions = functionsOrOptions as API_GATEWAY_FUNCTION<FunctionArgsType, FunctionReturnType>[];
        finalOptions = options || {};
    } else {
        finalOptions = functionsOrOptions || {};
    }
    
    const {
        concurrentExecution = true,
        stopOnFirstError = false,
        requestGroups = [],
        maxConcurrentRequests,
        rateLimit,
        circuitBreaker,
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
        const emptyResult = [] as API_GATEWAY_RESULT<ResponseDataType | FunctionReturnType>;
        emptyResult.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            successRate: 0,
            failureRate: 0
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
        ...extractCommonOptions<RequestDataType, ResponseDataType>(finalOptions),
        executionContext: finalOptions.executionContext
    }

    let responses: API_GATEWAY_RESPONSE<ResponseDataType | FunctionReturnType>[];
    if (concurrentExecution) {
        responses = await executeConcurrently<RequestDataType, ResponseDataType>(items as any, requestExecutionOptions as CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>);
    } else {
        responses = await executeSequentially<RequestDataType, ResponseDataType>(items as any, requestExecutionOptions as SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>);
    }

    const successfulRequests = responses.filter(r => r.success).length;
    const failedRequests = responses.filter(r => !r.success).length;
    const totalRequests = responses.length;

    const result = responses as API_GATEWAY_RESULT<ResponseDataType | FunctionReturnType>;
    result.metrics = {
        totalRequests,
        successfulRequests,
        failedRequests,
        successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
        failureRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
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

    return result;
}