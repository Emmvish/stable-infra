import { REQUEST_DATA } from "../types/index.js";
export declare function generateAxiosRequestConfig<RequestDataType = any>(reqData: REQUEST_DATA<RequestDataType>): {
    signal?: AbortSignal | undefined;
    method: import("../types/index.js").REQUEST_METHOD_TYPES;
    url: string;
    baseURL: string;
    headers: Record<string, any>;
    params: Record<string, any>;
    data: RequestDataType | undefined;
    timeout: number;
};
//# sourceMappingURL=generate-axios-request-config.d.ts.map