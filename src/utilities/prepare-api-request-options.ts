import { PrepareApiRequestOptionsMapping } from "../constants/index.js";

import { 
    API_GATEWAY_REQUEST,
    CONCURRENT_REQUEST_EXECUTION_OPTIONS,
    SEQUENTIAL_REQUEST_EXECUTION_OPTIONS,
    STABLE_REQUEST
} from "../types/index.js";


export function prepareApiRequestOptions<RequestDataType = any, ResponseDataType = any>(
    request: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>,
    commonRequestExecutionOptions: CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType> | 
                                SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType>
): Omit<STABLE_REQUEST<RequestDataType, ResponseDataType>, 'reqData'> {
    const { requestOptions: localOptions } = request;
    const reqGroup = request.groupId ? commonRequestExecutionOptions.requestGroups?.find(group => group.id === request.groupId) : undefined;
    const result: Record<string, Omit<STABLE_REQUEST<RequestDataType, ResponseDataType>, 'reqData'>> = {};

    for (const mapping of PrepareApiRequestOptionsMapping) {
        if (localOptions.hasOwnProperty(mapping.localKey)) {
            result[mapping.targetKey] = (localOptions as any)[mapping.localKey];
        } else if(reqGroup && (reqGroup).hasOwnProperty(mapping.groupCommonKey)) {
            result[mapping.targetKey] = (reqGroup?.commonConfig as any)[mapping.groupCommonKey];
        } else if (commonRequestExecutionOptions.hasOwnProperty(mapping.commonKey)) {
            result[mapping.targetKey] = (commonRequestExecutionOptions as any)[mapping.commonKey];
        }
    }

    return result as Omit<STABLE_REQUEST<RequestDataType, ResponseDataType>, 'reqData'>;
}