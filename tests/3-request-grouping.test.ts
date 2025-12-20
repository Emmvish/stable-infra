import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosRequestConfig } from 'axios';
import { stableApiGateway } from '../src/core/index.js';
import { RETRY_STRATEGIES } from '../src/enums/index.js';
import { API_GATEWAY_REQUEST } from '../src/types/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Request Grouping - Hierarchical Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should apply group configuration over global configuration', async () => {
    mockedAxios.request
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    const requests = [
      {
        id: 'critical-request',
        groupId: 'critical',
        requestOptions: {
          reqData: { path: '/critical' },
          resReq: true
        }
      }
    ] satisfies API_GATEWAY_REQUEST[];

    await stableApiGateway(requests, {
      commonRequestData: { hostname: 'api.example.com' },
      commonAttempts: 1, // Global: 1 attempt
      commonWait: 10,
      
      requestGroups: [
        {
          id: 'critical',
          commonConfig: {
            commonAttempts: 3, // Group: 3 attempts (overrides global)
            commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
          }
        }
      ]
    });

    // Should use group's 3 attempts, not global's 1
    expect(mockedAxios.request).toHaveBeenCalledTimes(3);
  });

  it('should apply individual request options over group and global config', async () => {
    mockedAxios.request
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    const requests = [
      {
        id: 'special-request',
        groupId: 'standard',
        requestOptions: {
          reqData: { path: '/special' },
          resReq: true,
          attempts: 5 // Individual: 5 attempts (highest priority)
        }
      }
    ] satisfies API_GATEWAY_REQUEST[];

    await stableApiGateway(requests, {
      commonRequestData: { hostname: 'api.example.com' },
      commonAttempts: 1, // Global: 1
      commonWait: 10,
      
      requestGroups: [
        {
          id: 'standard',
          commonConfig: {
            commonAttempts: 3 // Group: 3
          }
        }
      ]
    });

    // Should use individual's 5 attempts
    expect(mockedAxios.request).toHaveBeenCalledTimes(5);
  });

  it('should correctly merge requestData from global, group, and individual levels', async () => {
    mockedAxios.request.mockResolvedValue({
      status: 200,
      data: { success: true },
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    const requests = [
      {
        id: 'req-1',
        groupId: 'payments',
        requestOptions: {
          reqData: {
            path: '/charge',
            body: { amount: 100 }
          },
          resReq: true
        }
      }
    ] satisfies API_GATEWAY_REQUEST[];

    await stableApiGateway(requests, {
      commonRequestData: {
        hostname: 'api.example.com', // Global
        timeout: 5000
      },
      
      requestGroups: [
        {
          id: 'payments',
          commonConfig: {
            commonRequestData: {
              headers: { 'X-Payment-Key': 'secret' }, // Group
              timeout: 10000 // Overrides global timeout
            }
          }
        }
      ]
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://api.example.com:443', // From global
        url: '/charge', // From individual
        headers: expect.objectContaining({
          'X-Payment-Key': 'secret' // From group
        }),
        timeout: 10000, // From group (overrides global)
        data: { amount: 100 } // From individual
      })
    );
  });

  it('should apply different configurations to different groups', async () => {
    const errorHandlerCritical = jest.fn();
    const errorHandlerOptional = jest.fn();

    jest.spyOn(mockedAxios, 'request').mockImplementation(async (config: AxiosRequestConfig) => {
        if (config.url === '/critical') {
            if (!('retried' in (config as any))) {
                (config as any).retried = true;
                throw { response: { status: 500 } };
            }
            return {
                status: 200,
                data: { success: true },
                statusText: 'OK',
                headers: {},
                config
            };
        }

        if (config.url === '/optional') {
            throw {
                response: { status: 500 },
                message: 'Server Error'
            };
        }

        throw new Error('Unexpected request');
    });


    const requests = [
      {
        id: 'critical-1',
        groupId: 'critical',
        requestOptions: {
          reqData: { path: '/critical' },
          resReq: true
        }
      },
      {
        id: 'optional-1',
        groupId: 'optional',
        requestOptions: {
          reqData: { path: '/optional' },
          resReq: false
        }
      }
    ] satisfies API_GATEWAY_REQUEST[];

    const results = await stableApiGateway(requests, {
      concurrentExecution: true,
      commonRequestData: { hostname: 'api.example.com' },
      commonWait: 10,
      
      requestGroups: [
        {
          id: 'critical',
          commonConfig: {
            commonAttempts: 3,
            commonLogAllErrors: true,
            commonHandleErrors: errorHandlerCritical
          }
        },
        {
          id: 'optional',
          commonConfig: {
            commonAttempts: 1,
            commonLogAllErrors: true,
            commonHandleErrors: errorHandlerOptional,
            commonFinalErrorAnalyzer: async () => true // Suppress errors
          }
        }
      ]
    });

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true); // Critical succeeded after retry
    expect(results[1].success).toBe(false); // Optional failed but suppressed
    expect(errorHandlerCritical).toHaveBeenCalledTimes(1);
    expect(errorHandlerOptional).toHaveBeenCalledTimes(1);
  });

  it('should handle requests without groupId using only global config', async () => {
    mockedAxios.request
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    const requests = [
      {
        id: 'ungrouped',
        requestOptions: {
          reqData: { path: '/ungrouped' },
          resReq: true
        }
      }
    ] satisfies API_GATEWAY_REQUEST[];

    await stableApiGateway(requests, {
      commonRequestData: { hostname: 'api.example.com' },
      commonAttempts: 2, // Should use this
      commonWait: 10,
      commonMaxAllowedWait: 500,
      requestGroups: [
        {
          id: 'critical',
          commonConfig: {
            commonAttempts: 5 // Should NOT use this
          }
        }
      ]
    });

    // Should use global config (2 attempts)
    expect(mockedAxios.request).toHaveBeenCalledTimes(2);
  });

  it('should include groupId in response for grouped requests', async () => {
    mockedAxios.request.mockResolvedValue({
      status: 200,
      data: { success: true },
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    const requests = [
      {
        id: 'req-1',
        groupId: 'my-group',
        requestOptions: {
          reqData: { path: '/test' },
          resReq: true
        }
      }
    ] satisfies API_GATEWAY_REQUEST[];

    const results = await stableApiGateway(requests, {
      commonRequestData: { hostname: 'api.example.com' },
      requestGroups: [{ id: 'my-group', commonConfig: {} }]
    });

    expect(results[0]).toEqual({
      requestId: 'req-1',
      groupId: 'my-group',
      success: true,
      data: { success: true }
    });
  });
});