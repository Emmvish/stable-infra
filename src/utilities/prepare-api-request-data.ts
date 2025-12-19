import { 
    API_GATEWAY_REQUEST,
    CONCURRENT_REQUEST_EXECUTION_OPTIONS,
    REQUEST_DATA,
    SEQUENTIAL_REQUEST_EXECUTION_OPTIONS
} from "../types/index.js";

export function prepareApiRequestData<RequestDataType = any, ResponseDataType = any>(
    request: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>,
    commonRequestExecutionOptions: CONCURRENT_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType> | 
                                SEQUENTIAL_REQUEST_EXECUTION_OPTIONS<RequestDataType, ResponseDataType>
): REQUEST_DATA<RequestDataType> {
    const { requestOptions: localOptions } = request;
    const reqGroup = request.groupId ? commonRequestExecutionOptions.requestGroups?.find(group => group.id === request.groupId) : undefined;

    const result = {
        ...(commonRequestExecutionOptions.hasOwnProperty('commonRequestData') ? commonRequestExecutionOptions.commonRequestData : {}),
        ...(reqGroup && reqGroup?.commonConfig?.hasOwnProperty('commonRequestData') ? reqGroup?.commonConfig?.commonRequestData : {}),
        ...localOptions.reqData
    };

    if(!result.hasOwnProperty('hostname')) {
        console.log('stable-request: Hostname is missing in gateway request data. Setting it to an empty string to avoid errors.');
        result.hostname = '';
    }
    return result as REQUEST_DATA<RequestDataType>;
}