import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import axios from 'axios';
import { stableRequest } from '../src/core/index.js';
import { RETRY_STRATEGIES, REQUEST_METHODS } from '../src/enums/index.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('stableRequest - Core Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should successfully make a request and return data when resReq is true', async () => {
    const mockData = { id: 1, name: 'Test User' };
    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      data: mockData,
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/users/1'
      },
      resReq: true
    });

    expect(result).toEqual(mockData);
    expect(mockedAxios.request).toHaveBeenCalledTimes(1);
  });

  it('should return true when resReq is false on successful request', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      data: {},
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/ping'
      },
      resReq: false
    });

    expect(result).toBe(true);
  });

  it('should retry on transient failures and eventually succeed', async () => {
    const mockData = { status: 'success' };
    
    // First two attempts fail with 500, third succeeds
    mockedAxios.request
      .mockRejectedValueOnce({
        response: { status: 500, data: 'Server Error' },
        code: undefined
      })
      .mockRejectedValueOnce({
        response: { status: 500, data: 'Server Error' },
        code: undefined
      })
      .mockResolvedValueOnce({
        status: 200,
        data: mockData,
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/data'
      },
      resReq: true,
      attempts: 3,
      wait: 100,
      retryStrategy: RETRY_STRATEGIES.FIXED
    });

    expect(result).toEqual(mockData);
    expect(mockedAxios.request).toHaveBeenCalledTimes(3);
  });

  it('should throw error when all retry attempts are exhausted', async () => {
    mockedAxios.request.mockRejectedValue({
      response: { status: 500, data: 'Server Error' },
      code: undefined
    });

    await expect(
      stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data'
        },
        attempts: 3,
        wait: 10
      })
    ).rejects.toThrow();

    expect(mockedAxios.request).toHaveBeenCalledTimes(3);
  });

  it('should not retry on non-retryable errors (4xx)', async () => {
    mockedAxios.request.mockRejectedValue({
      response: { status: 404, data: 'Not Found' },
      code: undefined
    });

    await expect(
      stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/missing'
        },
        attempts: 3,
        wait: 10
      })
    ).rejects.toThrow();

    // Should only attempt once since 404 is not retryable
    expect(mockedAxios.request).toHaveBeenCalledTimes(1);
  });

  it('should use responseAnalyzer to validate content and retry on invalid data', async () => {
    const invalidData = { status: 'processing', progress: 50 };
    const validData = { status: 'completed', progress: 100 };

    mockedAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: invalidData,
        statusText: 'OK',
        headers: {},
        config: {} as any
      })
      .mockResolvedValueOnce({
        status: 200,
        data: validData,
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/job/status'
      },
      resReq: true,
      attempts: 3,
      wait: 10,
      responseAnalyzer: async ({ data }) => {
        return data.status === 'completed';
      }
    });

    expect(result).toEqual(validData);
    expect(mockedAxios.request).toHaveBeenCalledTimes(2);
  });

  it('should call handleErrors hook on each failed attempt', async () => {
    const errorHandler = jest.fn();

    mockedAxios.request
      .mockRejectedValueOnce({
        response: { status: 500, data: 'Error 1' },
        code: undefined
      })
      .mockRejectedValueOnce({
        response: { status: 500, data: 'Error 2' },
        code: undefined
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true },
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
      attempts: 3,
      wait: 10,
      logAllErrors: true,
      handleErrors: errorHandler
    });

    expect(errorHandler).toHaveBeenCalledTimes(2);
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        reqData: expect.any(Object),
        errorLog: expect.objectContaining({
          attempt: expect.stringContaining('/3'),
          error: expect.any(String),
          isRetryable: true,
          type: 'HTTP_ERROR'
        })
      })
    );
  });

  it('should use finalErrorAnalyzer to suppress errors gracefully', async () => {
    mockedAxios.request.mockRejectedValue({
      response: { status: 404, data: 'Not Found' },
      code: undefined,
      message: '404 Not Found'
    });

    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/optional'
      },
      resReq: true,
      attempts: 2,
      wait: 10,
      finalErrorAnalyzer: async ({ error }) => {
        // Suppress 404 errors
        return error?.message?.includes('Not Found');
      }
    });

    expect(result).toBe(false);
  });

  it('should apply different retry strategies correctly', async () => {
    const startTime = Date.now();
    
    mockedAxios.request
      .mockRejectedValueOnce({
        response: { status: 500 },
        code: undefined
      })
      .mockRejectedValueOnce({
        response: { status: 500 },
        code: undefined
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/data'
      },
      attempts: 3,
      wait: 100,
      retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
    });

    const elapsed = Date.now() - startTime;
    
    // Exponential: wait(100) * 2^0 + wait(100) * 2^1 = 100 + 200 = 300ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(250);
  });

  it('should execute all attempts when performAllAttempts is true', async () => {
    mockedAxios.request.mockResolvedValue({
      status: 200,
      data: { success: true },
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/warmup'
      },
      attempts: 5,
      wait: 10,
      performAllAttempts: true
    });

    // Should execute all 5 attempts even though first one succeeds
    expect(mockedAxios.request).toHaveBeenCalledTimes(5);
  });
});