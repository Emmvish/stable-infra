import {
    API_GATEWAY_OPTIONS,
    API_GATEWAY_REQUEST,
    CONCURRENT_REQUEST_EXECUTION_OPTIONS,
    SEQUENTIAL_REQUEST_EXECUTION_OPTIONS
} from '../types/index.js';
import { 
    executeConcurrently,
    executeSequentially,
    extractCommonRequestConfigOptions as extractCommonOptions
} from '../utilities/index.js';

export async function stableApiGateway<RequestDataType = any, ResponseDataType = any>(
    requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[] = [],
    options: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType> = {}
) {
    const {
        concurrentExecution = true,
        stopOnFirstError = false,
        requestGroups = []
    } = options;

    if (!Array.isArray(requests) || requests.length === 0) {
        return [];
    }

    const requestExecutionOptions: CONCURRENT_REQUEST_EXECUTION_OPTIONS | SEQUENTIAL_REQUEST_EXECUTION_OPTIONS = {
        stopOnFirstError,
        requestGroups,
        ...extractCommonOptions<RequestDataType, ResponseDataType>(options)
    }

    if (concurrentExecution) {
        return executeConcurrently<RequestDataType, ResponseDataType>(requests,  { ...requestExecutionOptions, stopOnFirstError: undefined } as CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType>);
    } else {
        return executeSequentially<RequestDataType, ResponseDataType>(requests, requestExecutionOptions as SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType>);
    }
}