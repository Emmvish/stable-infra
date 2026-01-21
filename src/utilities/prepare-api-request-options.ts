import { PrepareApiRequestOptionsMapping } from "../constants/index.js";

import { 
    API_GATEWAY_REQUEST,
    CONCURRENT_REQUEST_EXECUTION_OPTIONS,
    SEQUENTIAL_REQUEST_EXECUTION_OPTIONS,
    STABLE_REQUEST
} from "../types/index.js";

export function prepareApiRequestOptions<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
    request: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>,
    commonRequestExecutionOptions: CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> | 
                                SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
): Omit<STABLE_REQUEST<RequestDataType, ResponseDataType>, 'reqData'> {
    const { requestOptions: localOptions } = request;
    const reqGroup = (request.groupId && Array.isArray(commonRequestExecutionOptions.requestGroups)) ? commonRequestExecutionOptions.requestGroups?.find(group => group.id === request.groupId) : undefined;
    const localOptionsRecord = localOptions as Record<string, unknown>;
    const groupConfigRecord = (reqGroup?.commonConfig ?? {}) as Record<string, unknown>;
    const commonOptionsRecord = commonRequestExecutionOptions as Record<string, unknown>;
    const result: Record<string, any> = {};

    for (const mapping of PrepareApiRequestOptionsMapping) {
        if (Object.prototype.hasOwnProperty.call(localOptionsRecord, mapping.localKey)) {
            result[mapping.targetKey] = localOptionsRecord[mapping.localKey];
        } else if (Object.prototype.hasOwnProperty.call(groupConfigRecord, mapping.groupCommonKey)) {
            result[mapping.targetKey] = groupConfigRecord[mapping.groupCommonKey];
        } else if (Object.prototype.hasOwnProperty.call(commonOptionsRecord, mapping.commonKey)) {
            result[mapping.targetKey] = commonOptionsRecord[mapping.commonKey];
        }
    }

    return result as Omit<STABLE_REQUEST<RequestDataType, ResponseDataType>, 'reqData'>;
}