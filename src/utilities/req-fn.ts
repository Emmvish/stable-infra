import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { TRIAL_MODE_OPTIONS } from '../types/index.js';
import { safelyStringify } from './safely-stringify.js';
import { isRetryableError } from './is-retryable-error.js';

export async function reqFn<T = any>(
  reqData: AxiosRequestConfig,
  resReq = false,
  maxSerializableChars = 1000,
  trialMode: TRIAL_MODE_OPTIONS = { enabled: false }
) {
  const timestamp = new Date().toISOString();
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
          ...(resReq && { data: { trialMode } }),
        };
      }
    }
    const res = await axios.request(reqData);
    return resReq
      ? {
          ok: true,
          isRetryable: true,
          data: res?.data as T,
          timestamp,
        }
      : { ok: true, isRetryable: true, timestamp };
  } catch (e: any) {
    if(axios.isCancel(e)) {
        return {
            ok: false,
            error: 'Request was cancelled.',
            isRetryable: false,
            timestamp
        };
    }
    return {
      ok: false,
      error: (e as AxiosError)?.response?.data ?? e?.message,
      isRetryable: isRetryableError(e as AxiosError, trialMode),
      timestamp,
    };
  }
}