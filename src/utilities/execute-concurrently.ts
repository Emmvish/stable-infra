import {
    API_GATEWAY_REQUEST,
    API_GATEWAY_RESPONSE 
} from '../types/index.js';
import { stableRequest } from "../core/index.js";

export async function executeConcurrently<RequestDataType = any, ResponseDataType = any>(
    requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[]
): Promise<API_GATEWAY_RESPONSE<ResponseDataType>[]> {
    const responses: API_GATEWAY_RESPONSE<ResponseDataType>[] = [];
    const stableRequests: Promise<boolean | ResponseDataType>[] = [];
    for (const req of requests) {
        stableRequests.push(stableRequest<RequestDataType, ResponseDataType>(req.requestOptions));
    }
    const settledResponses = await Promise.allSettled(stableRequests);
    for (let i = 0; i < settledResponses.length; i++) {
        const res = settledResponses[i];
        const req = requests[i];
        if(res.status === 'fulfilled') {
            const value = res.value;
            responses.push({
                id: req.id,
                success: value ? true : false,
                ...(value && { data: value as ResponseDataType }),
                ...(!value && { error: 'Request was unsuccessful, but analyzed successfully!' })
            });
        } else {
            responses.push({
                id: req.id,
                success: false,
                error: res.reason?.message || 'An error occurred! Error description is unavailable.'
            });
        }
    }
    return responses;
}