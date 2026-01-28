import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { stableRequest } from '../src/core/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PerformAllAttempts Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute all attempts even when first attempt succeeds', async () => {
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

    expect(mockedAxios.request).toHaveBeenCalledTimes(5);
  });

  it('should return data from last successful attempt when resReq is true', async () => {
    let callCount = 0;

    mockedAxios.request.mockImplementation(
      (async () => ({
        status: 200,
        data: { attempt: ++callCount },
        statusText: 'OK',
        headers: {},
        config: {} as any,
      })) as unknown as jest.MockedFunction<typeof mockedAxios.request>
    );

    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/test'
      },
      resReq: true,
      attempts: 3,
      wait: 10,
      performAllAttempts: true
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ attempt: 3 });
    expect(mockedAxios.request).toHaveBeenCalledTimes(3);
  });

  it('should return failed result if all attempts fail even with performAllAttempts', async () => {
    mockedAxios.request.mockRejectedValue({
      response: { status: 500, data: 'Error' },
      code: undefined
    });

    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/test'
      },
      attempts: 3,
      wait: 10,
      performAllAttempts: true
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.metrics?.totalAttempts).toBe(3);
    expect(mockedAxios.request).toHaveBeenCalledTimes(3);
  });

  it('should return true when performAllAttempts and at least one attempt succeeds', async () => {
    mockedAxios.request
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
      })
      .mockRejectedValueOnce({
        response: { status: 500 },
        code: undefined
      });

    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/test'
      },
      resReq: false,
      attempts: 3,
      wait: 10,
      performAllAttempts: true
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe(true);
    expect(mockedAxios.request).toHaveBeenCalledTimes(3);
  });
});