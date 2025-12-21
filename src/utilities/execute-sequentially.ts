import { stableRequest } from "../core/index.js";
import { prepareApiRequestData } from "./prepare-api-request-data.js";
import { prepareApiRequestOptions } from './prepare-api-request-options.js';
import {
    API_GATEWAY_REQUEST,
    API_GATEWAY_RESPONSE,
    SEQUENTIAL_REQUEST_EXECUTION_OPTIONS 
} from '../types/index.js';

export async function executeSequentially<RequestDataType = any, ResponseDataType = any>(
    requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[] = [],
    requestExecutionOptions: SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType> = {}
): Promise<API_GATEWAY_RESPONSE<ResponseDataType>[]> {
    const responses: API_GATEWAY_RESPONSE<ResponseDataType>[] = [];
    for (const req of requests) {
        try {
            const finalRequestOptions = { 
                reqData: prepareApiRequestData<RequestDataType, ResponseDataType>(req, requestExecutionOptions),
                ...prepareApiRequestOptions<RequestDataType, ResponseDataType>(req, requestExecutionOptions) 
            };
            const res = await stableRequest<RequestDataType, ResponseDataType>(finalRequestOptions);
            responses.push({
                requestId: req.id,
                ...(req.groupId && { groupId: req.groupId }),
                success: res ? true : false,
                ...(res && { data: res as ResponseDataType }),
                ...(!res && { error: 'Request was unsuccessful, but the error was analyzed successfully!' })
            })
        } catch(e: any) {
            responses.push({
                requestId: req.id,
                ...(req.groupId && { groupId: req.groupId }),
                success: false,
                error: e?.message || 'An error occurred! Error description is unavailable.'
            });
            if(requestExecutionOptions.stopOnFirstError) {
                break;
            }
        }
    }
    return responses;
}