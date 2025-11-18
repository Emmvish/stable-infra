import {
    API_GATEWAY_OPTIONS,
    API_GATEWAY_REQUEST
} from '../types/index.js';
import { 
    executeConcurrently,
    executeSequentially
} from '../utilities/index.js';

export async function stableApiGateway<RequestDataType = any, ResponseDataType = any>(
    requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[] = [],
    options: API_GATEWAY_OPTIONS = {}
) {
    const {
        concurrentExecution = true,
        stopOnFirstError = false
    } = options;

    if (!Array.isArray(requests) || requests.length === 0) {
        return [];
    }

    if (concurrentExecution) {
        return executeConcurrently<RequestDataType, ResponseDataType>(requests);
    } else {
        return executeSequentially<RequestDataType, ResponseDataType>(requests, stopOnFirstError);
    }
}