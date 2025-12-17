import axios from 'axios';
import { safelyStringify } from './safely-stringify.js';
import { isRetryableError } from './is-retryable-error.js';
export async function reqFn(reqData, resReq = false, maxSerializableChars = 1000, trialMode = { enabled: false }) {
    const startTime = Date.now();
    let stopTime = 0;
    const timestamp = new Date(startTime).toISOString();
    try {
        if (trialMode.enabled) {
            const trialCondition = Math.random() <= (trialMode?.reqFailureProbability ?? 0);
            if (trialCondition) {
                console.log('Request failed in trial mode.\nRequest data:\n', safelyStringify(reqData, maxSerializableChars));
                throw new Error('Request failed in trial mode.');
            }
            else {
                return {
                    ok: true,
                    isRetryable: true,
                    timestamp,
                    executionTime: Date.now() - startTime,
                    ...(resReq && { data: { trialMode } }),
                };
            }
        }
        const res = await axios.request(reqData);
        stopTime = Date.now();
        return resReq
            ? {
                ok: true,
                isRetryable: true,
                data: res?.data,
                timestamp,
                executionTime: stopTime - startTime
            }
            : {
                ok: true,
                isRetryable: true,
                timestamp,
                executionTime: stopTime - startTime
            };
    }
    catch (e) {
        stopTime = Date.now();
        if (axios.isCancel(e)) {
            return {
                ok: false,
                error: 'Request was cancelled.',
                isRetryable: false,
                timestamp,
                executionTime: stopTime - startTime
            };
        }
        return {
            ok: false,
            error: e?.response?.data ?? e?.message,
            isRetryable: isRetryableError(e, trialMode),
            timestamp,
            executionTime: stopTime - startTime
        };
    }
}
//# sourceMappingURL=req-fn.js.map