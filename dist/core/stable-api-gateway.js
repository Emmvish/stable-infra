import { executeConcurrently, executeSequentially, extractCommonRequestConfigOptions as extractCommonOptions } from '../utilities/index.js';
export async function stableApiGateway(requests = [], options = {}) {
    const { concurrentExecution = true, stopOnFirstError = false, } = options;
    if (!Array.isArray(requests) || requests.length === 0) {
        return [];
    }
    const requestExecutionOptions = {
        stopOnFirstError,
        ...extractCommonOptions(options)
    };
    if (concurrentExecution) {
        return executeConcurrently(requests, { ...requestExecutionOptions, stopOnFirstError: undefined });
    }
    else {
        return executeSequentially(requests, requestExecutionOptions);
    }
}
//# sourceMappingURL=stable-api-gateway.js.map