import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { TRIAL_MODE_OPTIONS } from '../types/index.js';
import { safelyStringify } from './safely-stringify.js';
import { isRetryableError } from './is-retryable-error.js';

export async function reqFn<RequestDataType = any, ResponseDataType = any>(
  reqData: AxiosRequestConfig<RequestDataType>,
  resReq = false,
  maxSerializableChars = 1000,
  trialMode: TRIAL_MODE_OPTIONS = { enabled: false }
) {
  const startTime = Date.now()
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
          ...(resReq && { data: { trialMode } }),
        };
      }
    }
    const res = await axios.request<ResponseDataType>(reqData);
    return resReq
      ? {
          ok: true,
          isRetryable: true,
          data: res?.data,
          timestamp,
          executionTime: Date.now() - startTime
        }
      : { 
          ok: true, 
          isRetryable: true, 
          timestamp,
          executionTime: Date.now() - startTime 
        };
  } catch (e: any) {
    if(axios.isCancel(e)) {
      return {
        ok: false,
        error: 'Request was cancelled.',
        isRetryable: false,
        timestamp,
        executionTime: Date.now() - startTime
      };
    }
    return {
      ok: false,
      error: (e as AxiosError)?.response?.data ?? e?.message,
      isRetryable: isRetryableError(e as AxiosError, trialMode),
      timestamp,
      executionTime: Date.now() - startTime
    };
  }
}