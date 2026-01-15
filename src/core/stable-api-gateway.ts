import {
    API_GATEWAY_OPTIONS,
    API_GATEWAY_REQUEST,
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

export async function stableApiGateway<RequestDataType = any, ResponseDataType = any>(
    requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[] = [],
    options: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType> = {}
): Promise<API_GATEWAY_RESULT<ResponseDataType>> {
    const {
        concurrentExecution = true,
        stopOnFirstError = false,
        requestGroups = [],
        maxConcurrentRequests,
        rateLimit,
        circuitBreaker,
    } = options;

    if (!Array.isArray(requests) || requests.length === 0) {
        const emptyResult = [] as API_GATEWAY_RESULT<ResponseDataType>;
        emptyResult.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            successRate: 0,
            failureRate: 0
        };
        return emptyResult;
    }

    const requestExecutionOptions: CONCURRENT_REQUEST_EXECUTION_OPTIONS | SEQUENTIAL_REQUEST_EXECUTION_OPTIONS = {
        stopOnFirstError,
        requestGroups,
        sharedBuffer: options.sharedBuffer,
        ...(maxConcurrentRequests !== undefined && { maxConcurrentRequests }),
        ...(rateLimit !== undefined && { rateLimit }),
        ...(circuitBreaker !== undefined && { circuitBreaker }),
        ...extractCommonOptions<RequestDataType, ResponseDataType>(options)
    }

    let responses: API_GATEWAY_RESPONSE<ResponseDataType>[];
    if (concurrentExecution) {
        responses = await executeConcurrently<RequestDataType, ResponseDataType>(requests, requestExecutionOptions as CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType>);
    } else {
        responses = await executeSequentially<RequestDataType, ResponseDataType>(requests, requestExecutionOptions as SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType>);
    }

    const successfulRequests = responses.filter(r => r.success).length;
    const failedRequests = responses.filter(r => !r.success).length;
    const totalRequests = responses.length;

    const result = responses as API_GATEWAY_RESULT<ResponseDataType>;
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
    
    if (options.commonCache) {
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