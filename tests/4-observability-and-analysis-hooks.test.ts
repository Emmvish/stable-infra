import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { stableRequest } from '../src/core/index.js';
import { ResponseAnalysisHookOptions, FinalErrorAnalysisHookOptions } from '../src/types/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Hook System - Observability & Analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should pass custom parameters to responseAnalyzer hook', async () => {
    const mockAnalyzer = jest.fn<
    (options: ResponseAnalysisHookOptions) => Promise<boolean>
    >(async (_options) => true);

    const customParams = { expectedVersion: 42, minItems: 5 };

    mockedAxios.request.mockResolvedValue({
      status: 200,
      data: { version: 42, items: [1, 2, 3, 4, 5, 6] },
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/data'
      },
      resReq: true,
      hookParams: {
        responseAnalyzerParams: customParams
      },
      responseAnalyzer: mockAnalyzer
    });

    expect(mockAnalyzer).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.any(Object),
        params: customParams
      })
    );
  });

  it('should pass custom parameters to finalErrorAnalyzer hook', async () => {
    const mockErrorAnalyzer = jest.fn<
    (options: FinalErrorAnalysisHookOptions) => Promise<boolean>
    >(async (_options) => true);

    const customParams = { alertTeam: true, severity: 'high' };

    mockedAxios.request.mockRejectedValue({
      response: { status: 500, data: 'Error' },
      message: 'Server Error'
    });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/data'
      },
      attempts: 2,
      wait: 10,
      hookParams: {
        finalErrorAnalyzerParams: customParams
      },
      finalErrorAnalyzer: mockErrorAnalyzer
    });

    expect(mockErrorAnalyzer).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        params: customParams
      })
    );
  });

  it('should call handleSuccessfulAttemptData hook with correct data structure', async () => {
    const successHandler = jest.fn();

    mockedAxios.request.mockResolvedValue({
      status: 201,
      data: { id: 123, created: true },
      statusText: 'Created',
      headers: {},
      config: {} as any
    });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/create'
      },
      resReq: true,
      logAllSuccessfulAttempts: true,
      handleSuccessfulAttemptData: successHandler
    });

    expect(successHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        reqData: expect.any(Object),
        successfulAttemptData: expect.objectContaining({
          attempt: '1/1',
          timestamp: expect.any(String),
          executionTime: expect.any(Number),
          data: { id: 123, created: true },
          statusCode: 201
        })
      })
    );
  });

  it('should call handleErrors hook with detailed error information', async () => {
    const errorHandler = jest.fn();

    mockedAxios.request.mockRejectedValue({
      response: { status: 503, data: 'Service Unavailable' },
      code: 'ECONNREFUSED'
    });

    await expect(
      stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data'
        },
        attempts: 2,
        wait: 10,
        logAllErrors: true,
        handleErrors: errorHandler
      })
    ).rejects.toThrow();

    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        errorLog: expect.objectContaining({
          timestamp: expect.any(String),
          executionTime: expect.any(Number),
          statusCode: 503,
          attempt: expect.stringMatching(/\d+\/2/),
          error: expect.any(String),
          type: 'HTTP_ERROR',
          isRetryable: true
        })
      })
    );
  });

  it('should handle hooks that throw errors gracefully', async () => {
    const brokenHandler = jest.fn().mockImplementation(() => {
      throw new Error('Hook error');
    });

    mockedAxios.request.mockRejectedValue({
      response: { status: 500 },
      code: undefined
    });

    // Should not throw due to hook error, but due to actual request error
    await expect(
      stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data'
        },
        attempts: 1,
        logAllErrors: true,
        handleErrors: brokenHandler
      })
    ).rejects.toThrow();

    expect(brokenHandler).toHaveBeenCalled();
  });

  it('should call responseAnalyzer and retry when it returns false', async () => {
    let callCount = 0;

    const analyzer = jest.fn<
        (options: ResponseAnalysisHookOptions) => boolean
    >((_options) => {
        callCount++;
        return callCount >= 3;
    });

    mockedAxios.request.mockResolvedValue({
      status: 200,
      data: { processing: true },
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/job'
      },
      resReq: true,
      attempts: 5,
      wait: 10,
      responseAnalyzer: analyzer
    });

    expect(analyzer).toHaveBeenCalledTimes(3);
    expect(mockedAxios.request).toHaveBeenCalledTimes(3);
  });
});