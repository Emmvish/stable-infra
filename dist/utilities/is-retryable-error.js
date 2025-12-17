import { INVALID_AXIOS_RESPONSES } from '../enums/index.js';
export function isRetryableError(error, trialMode = { enabled: false }) {
    if (trialMode.enabled) {
        if (Math.random() <= (trialMode?.retryFailureProbability ?? 0)) {
            console.log('Retry failed in trial mode.');
            return false;
        }
        return true;
    }
    const statusCode = error?.response?.status ?? 200;
    const errorCode = error.code;
    return (statusCode >= 500 ||
        statusCode === 408 ||
        statusCode === 429 ||
        statusCode === 409 ||
        errorCode === INVALID_AXIOS_RESPONSES.RESET ||
        errorCode === INVALID_AXIOS_RESPONSES.TIMEDOUT ||
        errorCode === INVALID_AXIOS_RESPONSES.REFUSED ||
        errorCode === INVALID_AXIOS_RESPONSES.NOTFOUND ||
        errorCode === INVALID_AXIOS_RESPONSES.EAI_AGAIN);
}
//# sourceMappingURL=is-retryable-error.js.map