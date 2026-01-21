import { 
    API_GATEWAY_REQUEST,
    CONCURRENT_REQUEST_EXECUTION_OPTIONS,
    REQUEST_DATA,
    SEQUENTIAL_REQUEST_EXECUTION_OPTIONS
} from "../types/index.js";

export function prepareApiRequestData<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
    request: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>,
    commonRequestExecutionOptions: CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> | 
                                SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
): REQUEST_DATA<RequestDataType> {
    const { requestOptions: localOptions } = request;
    const reqGroup = (request.groupId && Array.isArray(commonRequestExecutionOptions.requestGroups) ) ? commonRequestExecutionOptions.requestGroups?.find(group => group.id === request.groupId) : undefined;

    const result = {
        ...(commonRequestExecutionOptions.commonRequestData || {}),
        ...(reqGroup?.commonConfig?.commonRequestData || {}),
        ...(localOptions.reqData || {})
    };

    if(!result.hostname) {
        console.info('stable-request: Hostname is missing in gateway request data. Setting it to an empty string to avoid errors.');
        result.hostname = '';
    }
    return result as REQUEST_DATA<RequestDataType>;
}