import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import axios from 'axios';
import { stableRequest, stableApiGateway } from '../src/core/index.js';
import { RETRY_STRATEGIES } from '../src/enums/index.js';

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
  
    it('should apply jitter to retry delays with FIXED strategy', async () => {
      const delays: number[] = [];
      const baseWait = 1000;
  
      mockedAxios.request
        .mockRejectedValueOnce({
          response: { status: 500, data: 'Error 1' },
          code: undefined
        })
        .mockRejectedValueOnce({
          response: { status: 500, data: 'Error 2' },
          code: undefined
        })
        .mockRejectedValueOnce({
          response: { status: 500, data: 'Error 3' },
          code: undefined
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true },
          statusText: 'OK',
          headers: {},
          config: {} as any
        });
  
      const startTime = Date.now();
      let lastTime = startTime;
  
      // Intercept delays by mocking setTimeout
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = ((callback: any, delay: number) => {
        if (delay && delay > 0) {
          delays.push(delay);
          const now = Date.now();
          lastTime = now;
        }
        return originalSetTimeout(callback, 0) as any;
      }) as any;
  
      try {
        await stableRequest({
          reqData: {
            hostname: 'api.example.com',
            path: '/data'
          },
          resReq: true,
          attempts: 4,
          wait: baseWait,
          retryStrategy: RETRY_STRATEGIES.FIXED,
          jitter: 0.5
        });
  
        // Should have 3 delays (between 4 attempts)
        expect(delays).toHaveLength(3);
  
        delays.forEach(delay => {
          expect(delay).toBeGreaterThanOrEqual(baseWait * 0.5);
          expect(delay).toBeLessThanOrEqual(baseWait * 1.5);
        });
  
        // Verify delays are randomized (not all the same)
        const uniqueDelays = new Set(delays);
        expect(uniqueDelays.size).toBeGreaterThan(1);
  
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });
  
    it('should apply jitter to exponential backoff delays', async () => {
      const delays: number[] = [];
      const baseWait = 100;
  
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
  
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = ((callback: any, delay: number) => {
        if (delay && delay > 0) {
          delays.push(delay);
        }
        return originalSetTimeout(callback, 0) as any;
      }) as any;
  
      try {
        await stableRequest({
          reqData: {
            hostname: 'api.example.com',
            path: '/data'
          },
          resReq: true,
          attempts: 3,
          wait: baseWait,
          retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
          jitter: 0.3
        });
  
        // Should have 2 delays
        expect(delays).toHaveLength(2);
  
        // First delay: baseWait * 2^0 = 100ms, with jitter 0.3: 70-130ms
        expect(delays[0]).toBeGreaterThanOrEqual(70);
        expect(delays[0]).toBeLessThanOrEqual(130);
  
        // Second delay: baseWait * 2^1 = 200ms, with jitter 0.3: 140-260ms
        expect(delays[1]).toBeGreaterThanOrEqual(140);
        expect(delays[1]).toBeLessThanOrEqual(260);
  
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });
  
    it('should apply jitter to linear backoff delays', async () => {
      const delays: number[] = [];
      const baseWait = 100;
  
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
  
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = ((callback: any, delay: number) => {
        if (delay && delay > 0) {
          delays.push(delay);
        }
        return originalSetTimeout(callback, 0) as any;
      }) as any;
  
      try {
        await stableRequest({
          reqData: {
            hostname: 'api.example.com',
            path: '/data'
          },
          resReq: true,
          attempts: 3,
          wait: baseWait,
          retryStrategy: RETRY_STRATEGIES.LINEAR,
          jitter: 0.5
        });
  
        // Should have 2 delays
        expect(delays).toHaveLength(2);
  
        // First delay: baseWait * 1 = 100ms, with jitter 0.5: 50-150ms
        expect(delays[0]).toBeGreaterThanOrEqual(50);
        expect(delays[0]).toBeLessThanOrEqual(150);
  
        // Second delay: baseWait * 2 = 200ms, with jitter 0.5: 100-300ms
        expect(delays[1]).toBeGreaterThanOrEqual(100);
        expect(delays[1]).toBeLessThanOrEqual(300);
  
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });
  
    it('should work without jitter (default behavior)', async () => {
      const delays: number[] = [];
      const baseWait = 100;
  
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
  
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = ((callback: any, delay: number) => {
        if (delay && delay > 0) {
          delays.push(delay);
        }
        return originalSetTimeout(callback, 0) as any;
      }) as any;
  
      try {
        await stableRequest({
          reqData: {
            hostname: 'api.example.com',
            path: '/data'
          },
          resReq: true,
          attempts: 3,
          wait: baseWait,
          retryStrategy: RETRY_STRATEGIES.FIXED
          // jitter not enabled
        });
  
        // Should have 2 delays
        expect(delays).toHaveLength(2);
  
        // All delays should be exactly baseWait (no jitter)
        delays.forEach(delay => {
          expect(delay).toBe(baseWait);
        });
  
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });
  
    it('should apply commonJitter in API Gateway', async () => {
      const delays: number[] = [];
      const baseWait = 100;
  
      mockedAxios.request
        .mockRejectedValueOnce({
          response: { status: 500, data: 'Error 1' },
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
  
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = ((callback: any, delay: number) => {
        if (delay && delay > 0) {
          delays.push(delay);
        }
        return originalSetTimeout(callback, 0) as any;
      }) as any;
  
      try {
        await stableApiGateway(
          [
            {
              id: 'req1',
              requestOptions: {
                reqData: {
                  hostname: 'api.example.com',
                  path: '/endpoint1'
                }
              }
            },
            {
              id: 'req2',
              requestOptions: {
                reqData: {
                  hostname: 'api.example.com',
                  path: '/endpoint2'
                }
              }
            }
          ],
          {
            concurrentExecution: false,
            commonAttempts: 2,
            commonWait: baseWait,
            commonRetryStrategy: RETRY_STRATEGIES.FIXED,
            commonJitter: 0.4
          }
        );
  
        // Should have 2 delays (one per failing request)
        expect(delays).toHaveLength(2);
  
        // With jitter 0.4, delays should be between 60ms and 140ms
        delays.forEach(delay => {
          expect(delay).toBeGreaterThanOrEqual(baseWait * 0.6);
          expect(delay).toBeLessThanOrEqual(baseWait * 1.4);
        });
  
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });
  
    it('should respect custom jitter values', async () => {
      const delays: number[] = [];
      const baseWait = 1000;
      const jitter = 0.1; // Very narrow jitter range
  
      mockedAxios.request
        .mockRejectedValueOnce({
          response: { status: 500, data: 'Error 1' },
          code: undefined
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true },
          statusText: 'OK',
          headers: {},
          config: {} as any
        });
  
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = ((callback: any, delay: number) => {
        if (delay && delay > 0) {
          delays.push(delay);
        }
        return originalSetTimeout(callback, 0) as any;
      }) as any;
  
      try {
        await stableRequest({
          reqData: {
            hostname: 'api.example.com',
            path: '/data'
          },
          resReq: true,
          attempts: 2,
          wait: baseWait,
          retryStrategy: RETRY_STRATEGIES.FIXED,
          jitter
        });
  
        // Should have 1 delay
        expect(delays).toHaveLength(1);
  
        // With jitter 0.1, delay should be between 900ms and 1100ms
        expect(delays[0]).toBeGreaterThanOrEqual(baseWait * 0.9);
        expect(delays[0]).toBeLessThanOrEqual(baseWait * 1.1);
  
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });
});