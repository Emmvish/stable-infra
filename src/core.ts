import {
  RETRY_STRATEGIES,
  RESPONSE_ERRORS
} from './enums/index.js';

import { 
    ERROR_LOG,
    ReqFnResponse, 
    STABLE_REQUEST,
    SUCCESSFUL_ATTEMPT_DATA,
} from './types/index.js';

import {
    generateAxiosRequestConfig,
    getNewDelayTime,
    delay,
    reqFn,
    safelyExecuteUnknownFunction,
    safelyStringify,
    validateTrialModeProbabilities
} from './utilities/index.js';

export async function sendStableRequest<T = any>(
  options: STABLE_REQUEST<T>
): Promise<T | boolean> {
  const {
    reqData: givenReqData,
    responseAnalyzer = (reqData, data, trialMode = { enabled: false }) => true,
    resReq = false,
    attempts: givenAttempts = 1,
    performAllAttempts = false,
    wait = 1000,
    retryStrategy = RETRY_STRATEGIES.FIXED,
    logAllErrors = false,
    handleErrors = (reqData, error, maxSerializableChars = 1000) => 
      console.log(
        'Request data:\n',
        safelyStringify(reqData, maxSerializableChars),
        '\nError log:\n',
        safelyStringify(error, maxSerializableChars)
      ),
    logAllSuccessfulAttempts = false,
    handleSuccessfulAttemptData = (reqData, successfulAttemptData, maxSerializableChars = 1000) =>
      console.log(
        'Request data:\n',
        safelyStringify(reqData, maxSerializableChars),
        '\nSuccessful attempt:\n',
        safelyStringify(successfulAttemptData, maxSerializableChars)
      ),
    maxSerializableChars = 1000,
    finalErrorAnalyzer = (reqData, error, trialMode = { enabled: false }) => false,
    trialMode = { enabled: false }
  } = options;
  let attempts = givenAttempts;
  let reqData = givenReqData;
  try {
    validateTrialModeProbabilities(trialMode);
    let res: ReqFnResponse = {
      ok: false,
      isRetryable: true,
      timestamp: new Date().toISOString(),
    };
    const maxAttempts = attempts;
    let lastSuccessfulAttemptData: T = {} as T;
    reqData = generateAxiosRequestConfig(reqData);
    do {
      attempts--;
      const currentAttempt = maxAttempts - attempts;
      res = await reqFn<T>(reqData, resReq, maxSerializableChars, trialMode);
      const originalResOk = res.ok;
      let performNextAttempt: boolean = false;
      if (res.ok) {
        try {
          performNextAttempt = !(await safelyExecuteUnknownFunction(
            responseAnalyzer,
            res?.data,
            trialMode
          ));
        } catch (e) {
          console.log(
            `Unable to analyze the response returned on attempt #${currentAttempt}. Response: ${safelyStringify(
              res?.data,
              maxSerializableChars
            )}`
          );
          performNextAttempt = true;
        }
      }
      if ((!res.ok || (res.ok && performNextAttempt)) && logAllErrors) {
        const errorLog: ERROR_LOG = {
          timestamp: res.timestamp,
          attempt: `${currentAttempt}/${maxAttempts}`,
          error:
            res?.error ??
            `The response did not match your expectations! Response: ${safelyStringify(
              res?.data,
              maxSerializableChars
            )}`,
          type: !res.ok
            ? RESPONSE_ERRORS.HTTP_ERROR
            : RESPONSE_ERRORS.INVALID_CONTENT,
          isRetryable: res.isRetryable,
        };
        try {
          await safelyExecuteUnknownFunction(
            handleErrors,
            reqData,
            errorLog,
            maxSerializableChars
          );
        } catch (e) {
          console.log(
            'sendStableRequest: Unable to report errors due to issues with error handler!'
          );
        }
      }
      if (res.ok && !performNextAttempt && logAllSuccessfulAttempts) {
        lastSuccessfulAttemptData = res?.data;
        const successfulAttemptLog: SUCCESSFUL_ATTEMPT_DATA = {
          attempt: `${currentAttempt}/${maxAttempts}`,
          timestamp: res.timestamp,
          data: res?.data,
        };
        try {
          await safelyExecuteUnknownFunction(
            handleSuccessfulAttemptData,
            reqData,
            successfulAttemptLog,
            maxSerializableChars
          );
        } catch (e) {
          console.log(
            'sendStableRequest: Unable to report successful attempts due to issues with successful attempt data handler!'
          );
        }
      }
      if (performNextAttempt && res.isRetryable) {
        res.ok = false;
      }
      if (
        attempts > 0 &&
        ((!originalResOk && res.isRetryable) ||
          (originalResOk && performNextAttempt) ||
          performAllAttempts)
      ) {
        await delay(getNewDelayTime(retryStrategy, wait, currentAttempt));
      }
    } while (
      attempts > 0 &&
      ((res.isRetryable && !res.ok) || performAllAttempts)
    );
    if (res.ok || performAllAttempts) {
      if (trialMode.enabled) {
        const finalResponse = res?.data ?? lastSuccessfulAttemptData;
        console.log(
          'Final response:\n',
          safelyStringify(finalResponse, maxSerializableChars)
        );
      }
      return resReq ? res?.data ?? lastSuccessfulAttemptData : true;
    } else {
      throw new Error(
        safelyStringify(
          {
            error: res?.error,
            'Request Data': reqData,
          },
          maxSerializableChars
        )
      );
    }
  } catch (e: any) {
    if (trialMode.enabled) {
      console.log('Final error:\n', e.message);
    }
    const errorAnalysisResult = await safelyExecuteUnknownFunction(
      finalErrorAnalyzer,
      reqData,
      e,
      trialMode
    );
    if(!errorAnalysisResult) {
      throw e;
    } else {
      return false;
    }
  }
}