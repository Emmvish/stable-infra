import { stableRequest } from "../core/index.js";
import { prepareApiRequestData } from "./prepare-api-request-data.js";
import { prepareApiRequestOptions } from './prepare-api-request-options.js';
export async function executeSequentially(requests = [], requestExecutionOptions = {}) {
    const responses = [];
    for (const req of requests) {
        try {
            const finalRequestOptions = {
                reqData: prepareApiRequestData(req, requestExecutionOptions),
                ...prepareApiRequestOptions(req, requestExecutionOptions)
            };
            const res = await stableRequest(finalRequestOptions);
            responses.push({
                id: req.id,
                success: res ? true : false,
                ...(res && { data: res }),
                ...(!res && { error: 'Request was unsuccessful, but analyzed successfully!' })
            });
        }
        catch (e) {
            responses.push({
                id: req.id,
                success: false,
                error: e?.message || 'An error occurred! Error description is unavailable.'
            });
            if (requestExecutionOptions.stopOnFirstError) {
                break;
            }
        }
    }
    return responses;
}
//# sourceMappingURL=execute-sequentially.js.map