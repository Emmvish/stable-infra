import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { stableApiGateway } from '../src/core/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('stableApiGateway - sharedBuffer option', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shares the same buffer across sequential requests (mutate in first, read in second)', async () => {
    const sharedBuffer: Record<string, any> = {};

    const seenConfigs: AxiosRequestConfig[] = [];

    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
        seenConfigs.push(config);

        return {
          status: 200,
          data: { ok: true, url: config.url },
          statusText: 'OK',
          headers: {},
          config: config as any
        };
      }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
    );

    const results = await stableApiGateway(
      [
        {
          id: 'r1',
          requestOptions: {
            reqData: { path: '/a' },
            resReq: true,
            preExecution: {
              preExecutionHook: ({ commonBuffer }: any) => {
                commonBuffer.token = 'tok_123';
                commonBuffer.setBy = 'r1';
                return {};
              },
              preExecutionHookParams: {},
              applyPreExecutionConfigOverride: false,
              continueOnPreExecutionHookFailure: false
            }
          }
        },
        {
          id: 'r2',
          requestOptions: {
            reqData: { path: '/b' },
            resReq: true,
            preExecution: {
              preExecutionHook: ({ commonBuffer }: any) => {
                expect(commonBuffer.token).toBe('tok_123');
                expect(commonBuffer.setBy).toBe('r1');
                return {
                  reqData: {
                    hostname: 'api.example.com',
                    path: '/b',
                    headers: {
                      Authorization: `Bearer ${commonBuffer.token}`
                    }
                  }
                };
              },
              preExecutionHookParams: {},
              applyPreExecutionConfigOverride: true,
              continueOnPreExecutionHookFailure: false
            }
          }
        }
      ],
      {
        concurrentExecution: false,
        commonRequestData: { hostname: 'api.example.com' },
        sharedBuffer
      }
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(
      expect.objectContaining({ requestId: 'r1', success: true, data: expect.any(Object) })
    );
    expect(results[1]).toEqual(
      expect.objectContaining({ requestId: 'r2', success: true, data: expect.any(Object) })
    );

    expect(sharedBuffer).toEqual(expect.objectContaining({ token: 'tok_123', setBy: 'r1' }));

    const secondConfig = seenConfigs.find(c => c.url === '/b');
    expect(secondConfig).toBeDefined();
    expect(secondConfig?.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer tok_123'
      })
    );
  });

  it('prefers sharedBuffer over per-request commonBuffer when both are provided', async () => {
    const sharedBuffer: Record<string, any> = { marker: 'from-shared' };

    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { ok: true },
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    const preExecutionHook = jest.fn(({ commonBuffer }: any) => {
      expect(commonBuffer.marker).toBe('from-shared');
      commonBuffer.touched = true;
      return {};
    });

    const results = await stableApiGateway(
      [
        {
          id: 'r1',
          requestOptions: {
            reqData: { path: '/only' },
            resReq: true,
            commonBuffer: { marker: 'from-request' },
            preExecution: {
              preExecutionHook,
              preExecutionHookParams: {},
              applyPreExecutionConfigOverride: false,
              continueOnPreExecutionHookFailure: false
            }
          }
        }
      ],
      {
        concurrentExecution: false,
        commonRequestData: { hostname: 'api.example.com' },
        sharedBuffer
      }
    );

    expect(preExecutionHook).toHaveBeenCalledTimes(1);
    expect(sharedBuffer).toEqual(expect.objectContaining({ marker: 'from-shared', touched: true }));
    expect(results[0]).toEqual(expect.objectContaining({ requestId: 'r1', success: true }));
  });
});