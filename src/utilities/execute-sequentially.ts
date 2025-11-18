import {
    API_GATEWAY_REQUEST,
    API_GATEWAY_RESPONSE 
} from '../types/index.js';
import { stableRequest } from "../core/index.js";

export async function executeSequentially<RequestDataType = any, ResponseDataType = any>(
    requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[],
    stopOnFirstError: boolean = false
): Promise<API_GATEWAY_RESPONSE<ResponseDataType>[]> {
    const responses: API_GATEWAY_RESPONSE<ResponseDataType>[] = [];
    for (const req of requests) {
        try {
            const res = await stableRequest<RequestDataType, ResponseDataType>(req.requestOptions);
            responses.push({
                id: req.id,
                success: res ? true : false,
                ...(res && { data: res as ResponseDataType }),
                ...(!res && { error: 'Request was unsuccessful, but analyzed successfully!' })
            })
        } catch(e: any) {
            responses.push({
                id: req.id,
                success: false,
                error: e?.message || 'An error occurred! Error description is unavailable.'
            });
            if(stopOnFirstError) {
                break;
            }
        }
    }
    return responses;
}