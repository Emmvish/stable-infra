import { stableRequest } from "../core/index.js";
import {
    API_GATEWAY_REQUEST,
    API_GATEWAY_RESPONSE ,
    CONCURRENT_REQUEST_EXECUTION_OPTIONS,
} from '../types/index.js';
import { prepareApiRequestData } from "./prepare-api-request-data.js";
import { prepareApiRequestOptions } from "./prepare-api-request-options.js";

export async function executeConcurrently<RequestDataType = any, ResponseDataType = any>(
    requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[] = [],
    requestExecutionOptions: CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType> = {}
): Promise<API_GATEWAY_RESPONSE<ResponseDataType>[]> {
    const responses: API_GATEWAY_RESPONSE<ResponseDataType>[] = [];
    const stableRequests: Promise<boolean | ResponseDataType>[] = [];
    for (const req of requests) {
        const finalRequestOptions = { 
            reqData: prepareApiRequestData<RequestDataType, ResponseDataType>(req, requestExecutionOptions),
            ...prepareApiRequestOptions<RequestDataType, ResponseDataType>(req, requestExecutionOptions) 
        };
        stableRequests.push(stableRequest<RequestDataType, ResponseDataType>(finalRequestOptions));
    }
    const settledResponses = await Promise.allSettled(stableRequests);
    for (let i = 0; i < settledResponses.length; i++) {
        const res = settledResponses[i];
        const req = requests[i];
        if(res.status === 'fulfilled') {
            const value = res.value;
            responses.push({
                requestId: req.id,
                ...(req.groupId && { groupId: req.groupId }),
                success: value ? true : false,
                ...(value && { data: value as ResponseDataType }),
                ...(!value && { error: 'Request was unsuccessful, but the error was analyzed successfully!' })
            });
        } else {
            responses.push({
                requestId: req.id,
                ...(req.groupId && { groupId: req.groupId }),
                success: false,
                error: res.reason?.message || 'An error occurred! Error description is unavailable.'
            });
        }
    }
    return responses;
}