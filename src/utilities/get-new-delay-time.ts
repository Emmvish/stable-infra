import { RETRY_STRATEGIES } from "../enums/index.js";

export function getNewDelayTime(
  retryStrategy = RETRY_STRATEGIES.FIXED,
  delay = 1000,
  currentAttempt = 1
) {
  switch (retryStrategy) {
    case RETRY_STRATEGIES.FIXED:
      return delay;
    case RETRY_STRATEGIES.LINEAR:
      return currentAttempt * delay;
    case RETRY_STRATEGIES.EXPONENTIAL:
      return (
        delay *
        Math.pow(2, currentAttempt > 0 ? currentAttempt - 1 : currentAttempt)
      );
    default:
      return delay;
  }
}