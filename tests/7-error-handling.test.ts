import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosError, CanceledError } from 'axios';
import { stableRequest } from '../src/core/index.js';
import { ResponseAnalysisHookOptions } from '../src/types/index.js';
import { isRetryableError } from '../src/utilities/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should identify retryable HTTP errors (5xx)', () => {
    const error = {
      response: { status: 500, data: 'Internal Server Error' }
    } as AxiosError;

    expect(isRetryableError(error)).toBe(true);
  });

  it('should identify retryable timeout errors (408)', () => {
    const error = {
      response: { status: 408, data: 'Request Timeout' }
    } as AxiosError;

    expect(isRetryableError(error)).toBe(true);
  });

  it('should identify retryable rate limit errors (429)', () => {
    const error = {
      response: { status: 429, data: 'Too Many Requests' }
    } as AxiosError;

    expect(isRetryableError(error)).toBe(true);
  });

  it('should identify non-retryable client errors (4xx except 408, 409, 429)', () => {
    const error = {
      response: { status: 404, data: 'Not Found' }
    } as AxiosError;

    expect(isRetryableError(error)).toBe(false);
  });

  it('should identify retryable network errors', () => {
    const errors = [
      { code: 'ECONNRESET' },
      { code: 'ETIMEDOUT' },
      { code: 'ECONNREFUSED' },
      { code: 'ENOTFOUND' },
      { code: 'EAI_AGAIN' }
    ];

    errors.forEach(error => {
      expect(isRetryableError(error as AxiosError)).toBe(true);
    });
  });

  it('should handle request cancellation correctly', async () => {
    jest.spyOn(axios, 'isCancel').mockImplementation(
        ((value: any): value is CanceledError<any> => true)
    );

    mockedAxios.request.mockRejectedValue({
      message: 'Request cancelled'
    });

    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/data'
      },
      attempts: 3,
      wait: 10
    });

    expect(result.success).toBe(false);
    // Should not retry cancelled requests
    expect(mockedAxios.request).toHaveBeenCalledTimes(1);
  });

  it('should respect finalErrorAnalyzer return value', async () => {
    mockedAxios.request.mockRejectedValue({
      response: { status: 404, data: 'Not Found' },
      message: '404 Not Found'
    });

    // When finalErrorAnalyzer returns true, should return false instead of throwing
    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/optional'
      },
      resReq: true,
      attempts: 1,
      finalErrorAnalyzer: async () => true
    });

    expect(result.success).toBe(false);
  });

  it('should return failed result when finalErrorAnalyzer returns false', async () => {
    mockedAxios.request.mockRejectedValue({
      response: { status: 500, data: 'Server Error' },
      message: 'Server Error'
    });

    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/critical'
      },
      attempts: 1,
      finalErrorAnalyzer: async () => false
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should throw error when finalErrorAnalyzer returns false and throwOnFailedErrorAnalysis is true', async () => {
    mockedAxios.request.mockRejectedValue({
      response: { status: 500, data: 'Server Error' },
      message: 'Server Error'
    });

    await expect(
      stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/critical'
        },
        attempts: 1,
        finalErrorAnalyzer: async () => false,
        throwOnFailedErrorAnalysis: true
      })
    ).rejects.toThrow();
  });

  it('should handle errors in responseAnalyzer gracefully', async () => {
    mockedAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { value: 'test' },
        statusText: 'OK',
        headers: {},
        config: {} as any
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { value: 'success' },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    const brokenAnalyzer = jest.fn<
        (options: ResponseAnalysisHookOptions<any, any>) => boolean
    >()
    .mockImplementationOnce(() => {
        throw new Error('Analyzer error');
    })
    .mockImplementationOnce(() => true);


    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/data'
      },
      resReq: true,
      attempts: 3,
      wait: 10,
      responseAnalyzer: brokenAnalyzer
    });

    // Should retry when analyzer throws
    expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ value: 'success' });
  });
});