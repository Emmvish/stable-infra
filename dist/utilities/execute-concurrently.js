import { stableRequest } from "../core/index.js";
import { prepareApiRequestData } from "./prepare-api-request-data.js";
import { prepareApiRequestOptions } from "./prepare-api-request-options.js";
export async function executeConcurrently(requests = [], requestExecutionOptions = {}) {
    const responses = [];
    const stableRequests = [];
    for (const req of requests) {
        const finalRequestOptions = {
            reqData: prepareApiRequestData(req, requestExecutionOptions),
            ...prepareApiRequestOptions(req, requestExecutionOptions)
        };
        stableRequests.push(stableRequest(finalRequestOptions));
    }
    const settledResponses = await Promise.allSettled(stableRequests);
    for (let i = 0; i < settledResponses.length; i++) {
        const res = settledResponses[i];
        const req = requests[i];
        if (res.status === 'fulfilled') {
            const value = res.value;
            responses.push({
                id: req.id,
                success: value ? true : false,
                ...(value && { data: value }),
                ...(!value && { error: 'Request was unsuccessful, but the error was analyzed successfully!' })
            });
        }
        else {
            responses.push({
                id: req.id,
                success: false,
                error: res.reason?.message || 'An error occurred! Error description is unavailable.'
            });
        }
    }
    return responses;
}
//# sourceMappingURL=execute-concurrently.js.map