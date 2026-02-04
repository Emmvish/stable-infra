import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { stableApiGateway } from '../src/core/index.js';
import { REQUEST_METHODS, RequestOrFunction } from '../src/enums/index.js';
import { API_GATEWAY_REQUEST } from '../src/types/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('stableApiGateway - Batch Processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute multiple requests concurrently and return all results', async () => {
    mockedAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { id: 1, name: 'User 1' },
        statusText: 'OK',
        headers: {},
        config: {} as any
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { id: 2, name: 'User 2' },
        statusText: 'OK',
        headers: {},
        config: {} as any
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { id: 3, name: 'User 3' },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    const requests = [
      { id: 'user-1', requestOptions: { reqData: { path: '/users/1' }, resReq: true } },
      { id: 'user-2', requestOptions: { reqData: { path: '/users/2' }, resReq: true } },
      { id: 'user-3', requestOptions: { reqData: { path: '/users/3' }, resReq: true } }
    ] satisfies API_GATEWAY_REQUEST[];

    const results = await stableApiGateway(requests, {
      concurrentExecution: true,
      commonRequestData: {
        hostname: 'api.example.com'
      },
      commonMaxAllowedWait: 500
    });

    expect(results).toHaveLength(3);
    expect(results.every(r => r.success)).toBe(true);
    expect(results[0]).toMatchObject({
      requestId: 'user-1',
      success: true,
      data: { id: 1, name: 'User 1' }
    });
  });

  it('should execute requests sequentially when concurrentExecution is false', async () => {
    const executionOrder: number[] = [];

    jest.spyOn(mockedAxios, 'request').mockImplementation(async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
      const match = config.url?.match(/\/users\/(\d+)/);
      const userId = match ? parseInt(match[1]) : 0;
      executionOrder.push(userId);
      
      return {
        status: 200,
        data: { id: userId },
        statusText: 'OK',
        headers: {},
        config: {} as any
      };
    });

    const requests = [
      { id: 'user-1', requestOptions: { reqData: { path: '/users/1' }, resReq: true } },
      { id: 'user-2', requestOptions: { reqData: { path: '/users/2' }, resReq: true } },
      { id: 'user-3', requestOptions: { reqData: { path: '/users/3' }, resReq: true } }
    ] satisfies API_GATEWAY_REQUEST[];

    await stableApiGateway(requests, {
      concurrentExecution: false,
      commonRequestData: {
        hostname: 'api.example.com'
      }
    });

    expect(executionOrder).toEqual([1, 2, 3]);
  });

  it('should stop on first error when stopOnFirstError is true in sequential mode', async () => {
    mockedAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      })
      .mockRejectedValueOnce({
        response: { status: 500, data: 'Error' },
        code: undefined
      });

    const requests = [
      { id: 'req-1', requestOptions: { reqData: { path: '/step1' }, resReq: true } },
      { id: 'req-2', requestOptions: { reqData: { path: '/step2' }, resReq: true } },
      { id: 'req-3', requestOptions: { reqData: { path: '/step3' }, resReq: true } }
    ] satisfies API_GATEWAY_REQUEST[];

    const results = await stableApiGateway(requests, {
      concurrentExecution: false,
      stopOnFirstError: true,
      commonRequestData: {
        hostname: 'api.example.com'
      }
    });

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(mockedAxios.request).toHaveBeenCalledTimes(2);
  });

  it('should handle mixed success and failure in concurrent execution', async () => {
    mockedAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      })
      .mockRejectedValueOnce({
        response: { status: 500, data: 'Error' },
        message: 'Server Error'
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    const requests = [
      { id: 'req-1', requestOptions: { reqData: { path: '/success' }, resReq: true } },
      { id: 'req-2', requestOptions: { reqData: { path: '/fail' }, resReq: true } },
      { id: 'req-3', requestOptions: { reqData: { path: '/success' }, resReq: true } }
    ] satisfies API_GATEWAY_REQUEST[];

    const results = await stableApiGateway(requests, {
      concurrentExecution: true,
      commonRequestData: {
        hostname: 'api.example.com'
      }
    });

    expect(results).toHaveLength(3);
    expect(results.filter(r => r.success)).toHaveLength(2);
    expect(results.filter(r => !r.success)).toHaveLength(1);
  });

  it('should apply common configuration to all requests', async () => {
    mockedAxios.request.mockResolvedValue({
      status: 200,
      data: { success: true },
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    const requests = [
      { id: 'req-1', requestOptions: { reqData: { path: '/api1' } } },
      { id: 'req-2', requestOptions: { reqData: { path: '/api2' } } }
    ] satisfies API_GATEWAY_REQUEST[];

    await stableApiGateway(requests, {
      commonRequestData: {
        hostname: 'api.example.com',
        method: REQUEST_METHODS.POST,
        headers: { 'X-API-Key': 'test-key' }
      },
      commonResReq: true
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        baseURL: 'https://api.example.com:443',
        headers: expect.objectContaining({ 'X-API-Key': 'test-key' })
      })
    );
  });

  it('should return empty array when requests array is empty', async () => {
    const results = await stableApiGateway([], {
      commonRequestData: { hostname: 'api.example.com' }
    });

    expect(results.length).toBe(0);
    expect(results.metrics).toBeDefined();
    expect(results.metrics?.totalRequests).toBe(0);
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('should stop on first error in concurrent execution when stopOnFirstError is true', async () => {
    const executionOrder: string[] = [];
    let requestCount = 0;

    jest.spyOn(mockedAxios, 'request').mockImplementation(async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
      const path = config.url || '';
      requestCount++;
      executionOrder.push(path);
      
      // First request fails immediately, subsequent ones have delay
      if (path.includes('fail')) {
        throw {
          response: { status: 500, data: 'Error' },
          message: 'Server Error'
        };
      }
      
      // Add delay to subsequent requests
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        status: 200,
        data: { success: true, path },
        statusText: 'OK',
        headers: {},
        config: {} as any
      };
    });

    const requests = [
      { id: 'req-1', requestOptions: { reqData: { path: '/fail' }, resReq: true } }, // Fails first
      { id: 'req-2', requestOptions: { reqData: { path: '/success1' }, resReq: true } },
      { id: 'req-3', requestOptions: { reqData: { path: '/success2' }, resReq: true } },
      { id: 'req-4', requestOptions: { reqData: { path: '/success3' }, resReq: true } },
      { id: 'req-5', requestOptions: { reqData: { path: '/success4' }, resReq: true } }
    ] satisfies API_GATEWAY_REQUEST[];

    const results = await stableApiGateway(requests, {
      concurrentExecution: true,
      stopOnFirstError: true,
      commonRequestData: {
        hostname: 'api.example.com'
      }
    });

    // Should have stopped launching new requests after detecting the error
    // The first request fails, so subsequent requests should not all be launched
    expect(results.length).toBeLessThan(requests.length);
    expect(results[0].success).toBe(false);
    expect(results[0].requestId).toBe('req-1');
  });

  it('should execute all requests in concurrent mode when stopOnFirstError is false', async () => {
    mockedAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      })
      .mockRejectedValueOnce({
        response: { status: 500, data: 'Error' },
        message: 'Server Error'
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    const requests = [
      { id: 'req-1', requestOptions: { reqData: { path: '/success1' }, resReq: true } },
      { id: 'req-2', requestOptions: { reqData: { path: '/fail' }, resReq: true } },
      { id: 'req-3', requestOptions: { reqData: { path: '/success2' }, resReq: true } }
    ] satisfies API_GATEWAY_REQUEST[];

    const results = await stableApiGateway(requests, {
      concurrentExecution: true,
      stopOnFirstError: false, // Explicitly false
      commonRequestData: {
        hostname: 'api.example.com'
      }
    });

    // All requests should have been executed
    expect(results).toHaveLength(3);
    expect(mockedAxios.request).toHaveBeenCalledTimes(3);
  });

  describe('Gateway maxTimeout enforcement', () => {
    it('should terminate gateway execution if maxTimeout is exceeded', async () => {
      const slowFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return 'completed';
      };

      const start = Date.now();
      
      try {
        await stableApiGateway([
          {
            type: RequestOrFunction.FUNCTION,
            function: {
              id: 'fn1' as `/fn1`,
              functionOptions: {
                fn: slowFunction,
                args: []
              }
            }
          }
        ], {
          maxTimeout: 200, // Gateway will timeout after 200ms
          executionContext: { requestId: 'test-gateway-1' }
        });
        
        fail('Expected timeout error');
      } catch (error: any) {
        const elapsed = Date.now() - start;
        expect(error.message).toContain('stable-infra:');
        expect(error.message).toContain('Gateway execution exceeded maxTimeout of 200ms');
        expect(error.message).toContain('requestId=test-gateway-1');
        expect(elapsed).toBeLessThan(300);
      }
    });

    it('should complete successfully if execution finishes before maxTimeout', async () => {
      const fastFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'completed';
      };

      const result = await stableApiGateway([
        {
          type: RequestOrFunction.FUNCTION,
          function: {
            id: 'fn1' as `/fn1`,
            functionOptions: {
              fn: fastFunction,
              args: []
            }
          }
        }
      ], {
        maxTimeout: 500
      });

      expect(result[0].success).toBe(true);
      expect(result[0].data).toBe('completed');
    });

    it('should include execution context in timeout error', async () => {
      const slowFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return 'completed';
      };

      try {
        await stableApiGateway([
          {
            type: RequestOrFunction.FUNCTION,
            function: {
              id: 'fn1' as `/fn1`,
              functionOptions: {
                fn: slowFunction,
                args: []
              }
            }
          }
        ], {
          maxTimeout: 100,
          executionContext: { 
            requestId: 'gw-123',
            workflowId: 'user-456'
          }
        });
        
        fail('Expected timeout error');
      } catch (error: any) {
        expect(error.message).toContain('stable-infra:');
        expect(error.message).toContain('requestId=gw-123');
        expect(error.message).toContain('workflowId=user-456');
      }
    });
  });
});