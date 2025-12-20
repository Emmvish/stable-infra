import { extractCommonOptionsKeys } from "../constants/index.js";
import { API_GATEWAY_OPTIONS } from "../types/index.js";

export function extractCommonRequestConfigOptions<RequestDataType = any, ResponseDataType = any>(
    options: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>
) {
    const extracted: Record<string, any> = {};

    for (const key of extractCommonOptionsKeys) {
        if (options.hasOwnProperty(key)) {
            extracted[key] = options[key];
        }
    }

    return extracted;
}
