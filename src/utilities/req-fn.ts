import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { ReqFnResponse ,TRIAL_MODE_OPTIONS } from '../types/index.js';
import { safelyStringify } from './safely-stringify.js';
import { isRetryableError } from './is-retryable-error.js';

export async function reqFn<RequestDataType = any, ResponseDataType = any>(
  reqData: AxiosRequestConfig<RequestDataType>,
  resReq = false,
  maxSerializableChars = 1000,
  trialMode: TRIAL_MODE_OPTIONS = { enabled: false }
): Promise<ReqFnResponse<ResponseDataType>> {
  const startTime = Date.now();
  let stopTime = 0;
  const timestamp = new Date(startTime).toISOString();
  try {
    if (trialMode.enabled) {
      const trialCondition =
        Math.random() <= (trialMode?.reqFailureProbability ?? 0);
      if (trialCondition) {
        console.log(
          'Request failed in trial mode.\nRequest data:\n',
          safelyStringify(reqData, maxSerializableChars)
        );
        throw new Error('Request failed in trial mode.');
      } else {
        return {
          ok: true,
          isRetryable: true,
          timestamp,
          executionTime: Date.now() - startTime,
          statusCode: 200,
          ...(resReq && { data: { trialMode } }),
        };
      }
    }
    const res = await axios.request<ResponseDataType>(reqData);
    stopTime = Date.now();
    return resReq
      ? {
          ok: true,
          isRetryable: true,
          data: res?.data,
          timestamp,
          executionTime: stopTime - startTime,
          statusCode: res?.status || 200
        }
      : { 
          ok: true, 
          isRetryable: true, 
          timestamp,
          executionTime: stopTime - startTime,
          statusCode: res?.status || 200
        };
  } catch (e: any) {
    stopTime = Date.now();
    if(axios.isCancel(e)) {
      return {
        ok: false,
        error: 'Request was cancelled.',
        isRetryable: false,
        timestamp,
        executionTime: stopTime - startTime,
        statusCode: (e as AxiosError)?.response?.status || 0
      };
    }
    return {
      ok: false,
      error: (e as AxiosError)?.response?.data ?? e?.message,
      isRetryable: isRetryableError(e as AxiosError, trialMode),
      timestamp,
      executionTime: stopTime - startTime,
      statusCode: (e as AxiosError)?.response?.status || 0
    };
  }
}