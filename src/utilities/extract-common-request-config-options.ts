import { extractCommonOptionsKeys } from "../constants/index.js";
import { API_GATEWAY_OPTIONS } from "../types/index.js";

export function extractCommonRequestConfigOptions<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
    options: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>
) {
    const extracted: Record<string, unknown> = {};
    const optionsRecord = options as Record<string, unknown>;

    for (const key of extractCommonOptionsKeys) {
        if (Object.prototype.hasOwnProperty.call(optionsRecord, key)) {
            extracted[key] = optionsRecord[key];
        }
    }

    return extracted;
}
