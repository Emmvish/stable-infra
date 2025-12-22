import { AxiosRequestConfig } from 'axios';

import {
  RETRY_STRATEGIES,
  RESPONSE_ERRORS
} from '../enums/index.js';

import { 
    ERROR_LOG,
    PreExecutionHookOptions,
    ReqFnResponse, 
    STABLE_REQUEST,
    SUCCESSFUL_ATTEMPT_DATA,
} from '../types/index.js';

import {
    generateAxiosRequestConfig,
    getNewDelayTime,
    delay,
    reqFn,
    safelyExecuteUnknownFunction,
    safelyStringify,
    validateTrialModeProbabilities
} from '../utilities/index.js';

export async function sendStableRequest<RequestDataType = any, ResponseDataType = any>(
  options: STABLE_REQUEST<RequestDataType, ResponseDataType>
): Promise<ResponseDataType | boolean> {
  const { 
    preExecution = {
      preExecutionHook: ({ inputParams, outputBuffer }: PreExecutionHookOptions) => {},
      preExecutionHookParams: {},
      applyPreExecutionConfigOverride: false,
      continueOnPreExecutionHookFailure: false,
      preExecutionOutputBuffer: {}
    }
  } = options;
  let result: Partial<STABLE_REQUEST<RequestDataType, ResponseDataType>> | unknown;
  try {
    result = await safelyExecuteUnknownFunction(
      preExecution?.preExecutionHook as Function,
      {
        inputParams: preExecution?.preExecutionHookParams,
        outputBuffer: preExecution?.preExecutionOutputBuffer
      }
    );
    if(preExecution?.applyPreExecutionConfigOverride) {
      const finalOptions = {
        ...options,
        ...result as Partial<STABLE_REQUEST<RequestDataType, ResponseDataType>>
      }
      Object.assign(options, finalOptions);
    }
  } catch(e) {
    if (!preExecution?.continueOnPreExecutionHookFailure) {
      throw e;
    }
  }
  const {
    reqData: givenReqData,
    responseAnalyzer = ({ reqData, data, trialMode = { enabled: false } }) => true,
    resReq = false,
    attempts: givenAttempts = 1,
    performAllAttempts = false,
    wait = 1000,
    maxAllowedWait = 60000,
    retryStrategy = RETRY_STRATEGIES.FIXED,
    logAllErrors = false,
    handleErrors = ({ reqData, errorLog, maxSerializableChars = 1000 }) => 
      console.error(
        'stable-request:\n',
        'Request data:\n',
        safelyStringify(reqData, maxSerializableChars),
        '\nError log:\n',
        safelyStringify(errorLog, maxSerializableChars)
      ),
    logAllSuccessfulAttempts = false,
    handleSuccessfulAttemptData = ({ reqData, successfulAttemptData, maxSerializableChars = 1000 }) =>
      console.info(
        'stable-request:\n',
        'Request data:\n',
        safelyStringify(reqData, maxSerializableChars),
        '\nSuccessful attempt:\n',
        safelyStringify(successfulAttemptData, maxSerializableChars)
      ),
    maxSerializableChars = 1000,
    finalErrorAnalyzer = ({ reqData, error, trialMode = { enabled: false } }) => false,
    trialMode = { enabled: false },
    hookParams = {},
  } = options;
  let attempts = givenAttempts;
  const reqData: AxiosRequestConfig<RequestDataType> = generateAxiosRequestConfig<RequestDataType>(givenReqData);
  try {
    validateTrialModeProbabilities(trialMode);
    let res: ReqFnResponse = {
      ok: false,
      isRetryable: true,
      timestamp: new Date().toISOString(),
      executionTime: 0,
      statusCode: 0
    };
    const maxAttempts = attempts;
    let lastSuccessfulAttemptData: ResponseDataType | undefined = undefined;
    let hadAtLeastOneSuccess = false;
    do {
      attempts--;
      const currentAttempt = maxAttempts - attempts;
      res = await reqFn<RequestDataType, ResponseDataType>(reqData, resReq, maxSerializableChars, trialMode);
      const originalResOk = res.ok;
      let performNextAttempt: boolean = false;
      if (res.ok) {
        try {
          performNextAttempt = !(await safelyExecuteUnknownFunction(
            responseAnalyzer,
            {
              reqData,
              data: res?.data,
              trialMode,
              params: hookParams?.responseAnalyzerParams
            }
          ));
        } catch (e) {
          console.error(
            `stable-request: Unable to analyze the response returned on attempt #${currentAttempt}. Response: ${safelyStringify(
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
            `stable-request: The response did not match your expectations! Response: ${safelyStringify(
              res?.data,
              maxSerializableChars
            )}`,
          type: !res.ok
            ? RESPONSE_ERRORS.HTTP_ERROR
            : RESPONSE_ERRORS.INVALID_CONTENT,
          isRetryable: res.isRetryable,
          executionTime: res.executionTime,
          statusCode: res.statusCode
        };
        try {
          await safelyExecuteUnknownFunction(
            handleErrors,
            {
              reqData,
              errorLog,
              maxSerializableChars,
              params: hookParams?.handleErrorsParams
            }
          );
        } catch (e) {
          console.error(
            'stable-request: Unable to report errors due to issues with error handler!'
          );
        }
      }
      if (res.ok && !performNextAttempt) {
        hadAtLeastOneSuccess = true;
        lastSuccessfulAttemptData = res?.data;
        if (logAllSuccessfulAttempts) {
          const successfulAttemptLog: SUCCESSFUL_ATTEMPT_DATA<ResponseDataType> = {
            attempt: `${currentAttempt}/${maxAttempts}`,
            timestamp: res.timestamp,
            data: res?.data,
            executionTime: res.executionTime,
            statusCode: res.statusCode
          };
          try {
            await safelyExecuteUnknownFunction(
              handleSuccessfulAttemptData,
              {
                reqData,
                successfulAttemptData: successfulAttemptLog,
                maxSerializableChars,
                params: hookParams?.handleSuccessfulAttemptDataParams
              }
            );
          } catch (e) {
            console.error(
              'stable-request: Unable to report successful attempts due to issues with successful attempt data handler!'
            );
          }
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
        await delay(getNewDelayTime(retryStrategy, wait, currentAttempt), maxAllowedWait);
      }
    } while (
      attempts > 0 &&
      ((res.isRetryable && !res.ok) || performAllAttempts)
    );
    
    if (performAllAttempts && hadAtLeastOneSuccess) {
      if (trialMode.enabled) {
        console.info(
          'stable-request: Final response (performAllAttempts mode):\n',
          safelyStringify(lastSuccessfulAttemptData as Record<string, any>, maxSerializableChars)
        );
      }
      return resReq ? lastSuccessfulAttemptData! : true;
    } else if (res.ok) {
      if (trialMode.enabled) {
        const finalResponse = res?.data ?? lastSuccessfulAttemptData;
        console.info(
          'stable-request: Final response:\n',
          safelyStringify(finalResponse, maxSerializableChars)
        );
      }
      return resReq ? res?.data ?? lastSuccessfulAttemptData! : true;
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
      console.error('stable-request: Final error:\n', e.message);
    }
    const errorAnalysisResult = await safelyExecuteUnknownFunction(
      finalErrorAnalyzer,
      {
        reqData,
        error: e,
        trialMode,
        params: hookParams?.finalErrorAnalyzerParams
      }
    );
    if(!errorAnalysisResult) {
      throw e;
    } else {
      return false;
    }
  }
}