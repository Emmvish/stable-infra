export function prepareApiRequestData(request, commonRequestExecutionOptions) {
    const { requestOptions: localOptions } = request;
    const result = {
        ...(commonRequestExecutionOptions.hasOwnProperty('commonRequestData') ? commonRequestExecutionOptions.commonRequestData : {}),
        ...localOptions.reqData
    };
    if (!result.hasOwnProperty('hostname')) {
        console.log('stable-request: Hostname is missing in gateway request data. Setting it to an empty string to avoid Axios errors.');
        result.hostname = '';
    }
    return result;
}
//# sourceMappingURL=prepare-api-request-data.js.map