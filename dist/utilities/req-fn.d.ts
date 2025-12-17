import { AxiosRequestConfig } from 'axios';
import { ReqFnResponse, TRIAL_MODE_OPTIONS } from '../types/index.js';
export declare function reqFn<RequestDataType = any, ResponseDataType = any>(reqData: AxiosRequestConfig<RequestDataType>, resReq?: boolean, maxSerializableChars?: number, trialMode?: TRIAL_MODE_OPTIONS): Promise<ReqFnResponse<ResponseDataType>>;
//# sourceMappingURL=req-fn.d.ts.map