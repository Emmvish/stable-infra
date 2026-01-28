import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { stableRequest } from '../src/core/index.js';
import { RETRY_STRATEGIES } from '../src/enums/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('stableRequest - preExecution option (stableRequest)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls preExecutionHook with preExecutionHookParams', async () => {
    const preExecutionHook = jest.fn(({ inputParams }: any) => {
      expect(inputParams).toEqual({ tenantId: 't-123', feature: 'x' });
      return {};
    });

    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { ok: true },
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    const result = await stableRequest({
      reqData: { hostname: 'api.example.com', path: '/ping' },
      resReq: true,
      preExecution: {
        preExecutionHook,
        preExecutionHookParams: { tenantId: 't-123', feature: 'x' },
        applyPreExecutionConfigOverride: false,
        continueOnPreExecutionHookFailure: false
      },
      commonBuffer: {}
    });

    expect(preExecutionHook).toHaveBeenCalledTimes(1);
    expect(mockedAxios.request).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ok: true });
  });

  it('applies returned overrides when applyPreExecutionConfigOverride=true (e.g., override attempts)', async () => {
    mockedAxios.request
      .mockRejectedValueOnce({ response: { status: 500, data: 'e1' }, code: undefined })
      .mockRejectedValueOnce({ response: { status: 500, data: 'e2' }, code: undefined })
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    const result = await stableRequest({
      reqData: { hostname: 'api.example.com', path: '/retry-me' },
      resReq: true,
      attempts: 1,
      wait: 1,
      retryStrategy: RETRY_STRATEGIES.FIXED,
      preExecution: {
        preExecutionHook: () => ({ attempts: 3 }),
        preExecutionHookParams: {},
        applyPreExecutionConfigOverride: true,
        continueOnPreExecutionHookFailure: false
      },
      commonBuffer: {}
    });

    expect(mockedAxios.request).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ok: true });
  });

  it('does NOT apply returned overrides when applyPreExecutionConfigOverride=false', async () => {
    mockedAxios.request.mockRejectedValueOnce({
      response: { status: 500, data: 'boom' },
      code: undefined
    });

    const result = await stableRequest({
      reqData: { hostname: 'api.example.com', path: '/no-override' },
      resReq: true,
      attempts: 1,
      wait: 1,
      retryStrategy: RETRY_STRATEGIES.FIXED,
      preExecution: {
        preExecutionHook: () => ({ attempts: 3 }),
        preExecutionHookParams: {},
        applyPreExecutionConfigOverride: false,
        continueOnPreExecutionHookFailure: false
      },
      commonBuffer: {}
    });

    expect(result.success).toBe(false);
    expect(mockedAxios.request).toHaveBeenCalledTimes(1);
  });

  it('can override reqData (e.g., path) via preExecution when applyPreExecutionConfigOverride=true', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { ok: true },
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    await stableRequest({
      reqData: { hostname: 'api.example.com', path: '/original' },
      resReq: true,
      preExecution: {
        preExecutionHook: () => ({
          reqData: { hostname: 'api.example.com', path: '/overridden' }
        }),
        preExecutionHookParams: {},
        applyPreExecutionConfigOverride: true,
        continueOnPreExecutionHookFailure: false
      },
      commonBuffer: {}
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/overridden' })
    );
    expect(mockedAxios.request).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: '/original' })
    );
  });

  it('returns failed result if preExecutionHook throws and continueOnPreExecutionHookFailure=false (axios not called)', async () => {
    const preExecutionHook = () => {
      throw new Error('pre-exec failed');
    };

    const result = await stableRequest({
      reqData: { hostname: 'api.example.com', path: '/will-not-run' },
      attempts: 1,
      wait: 1,
      preExecution: {
        preExecutionHook,
        preExecutionHookParams: {},
        applyPreExecutionConfigOverride: true,
        continueOnPreExecutionHookFailure: false
      },
      commonBuffer: {}
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('pre-exec failed');
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('throws if preExecutionHook throws and continueOnPreExecutionHookFailure=false with throwOnFailedErrorAnalysis=true', async () => {
    const preExecutionHook = () => {
      throw new Error('pre-exec failed');
    };

    await expect(
      stableRequest({
        reqData: { hostname: 'api.example.com', path: '/will-not-run' },
        attempts: 1,
        wait: 1,
        preExecution: {
          preExecutionHook,
          preExecutionHookParams: {},
          applyPreExecutionConfigOverride: true,
          continueOnPreExecutionHookFailure: false
        },
        commonBuffer: {},
        throwOnFailedErrorAnalysis: true
      })
    ).rejects.toThrow('pre-exec failed');

    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('continues if preExecutionHook throws and continueOnPreExecutionHookFailure=true', async () => {
    const preExecutionHook = () => {
      throw new Error('pre-exec failed');
    };

    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { ok: true },
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    const result = await stableRequest({
      reqData: { hostname: 'api.example.com', path: '/still-runs' },
      resReq: true,
      preExecution: {
        preExecutionHook,
        preExecutionHookParams: {},
        applyPreExecutionConfigOverride: true,
        continueOnPreExecutionHookFailure: true
      },
      commonBuffer: {}
    });

    expect(mockedAxios.request).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ok: true });
  });

  it('can override hooks (example: override responseAnalyzer) via preExecution when applyPreExecutionConfigOverride=true', async () => {
    mockedAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { state: 'not-ready' },
        statusText: 'OK',
        headers: {},
        config: { url: '/job' } as AxiosRequestConfig
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { state: 'ready' },
        statusText: 'OK',
        headers: {},
        config: { url: '/job' } as AxiosRequestConfig
      });

    const result = await stableRequest({
      reqData: { hostname: 'api.example.com', path: '/job' },
      resReq: true,
      attempts: 2,
      wait: 1,
      preExecution: {
        preExecutionHook: () => ({
          responseAnalyzer: async ({ data }: any) => data?.state === 'ready'
        }),
        preExecutionHookParams: {},
        applyPreExecutionConfigOverride: true,
        continueOnPreExecutionHookFailure: false
      },
      commonBuffer: {}
    });

    expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ state: 'ready' });
  });

  it('records output in common buffer and it is visible during request execution', async () => {
    const buffer: Record<string, any> = {};

    mockedAxios.request.mockImplementationOnce(
      async <T = any, R = AxiosResponse<T>, D = any>(
        config: AxiosRequestConfig<D>
      ): Promise<R> => {
        expect(buffer).toEqual(
          expect.objectContaining({
            token: 'tok_123',
            preparedAt: expect.any(String)
          })
        );

        const response: AxiosResponse = {
          status: 200,
          data: { ok: true, url: config.url },
          statusText: 'OK',
          headers: {},
          config: config as any
        };

        return response as unknown as R;
      }
    );

    const result = await stableRequest({
      reqData: { hostname: 'api.example.com', path: '/needs-token' },
      resReq: true,
      preExecution: {
        preExecutionHook: ({ commonBuffer }: any) => {
          commonBuffer.token = 'tok_123';
          commonBuffer.preparedAt = new Date().toISOString();
          return {};
        },
        preExecutionHookParams: { userId: 'u1' },
        applyPreExecutionConfigOverride: false,
        continueOnPreExecutionHookFailure: false
      },
      commonBuffer: buffer
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ok: true, url: '/needs-token' });
    expect(buffer.token).toBe('tok_123');
  });

  it('records output in common buffer and can also override config', async () => {
    const buffer: Record<string, any> = {};

    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { ok: true },
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    await stableRequest({
      reqData: { hostname: 'api.example.com', path: '/original-path' },
      resReq: true,
      preExecution: {
        preExecutionHook: async ({ commonBuffer }: any) => {
          commonBuffer.traceId = 'trace-abc';
          commonBuffer.didOverride = true;

          return {
            reqData: { hostname: 'api.example.com', path: '/overridden-path' }
          };
        },
        preExecutionHookParams: {},
        applyPreExecutionConfigOverride: true,
        continueOnPreExecutionHookFailure: false
      },
      commonBuffer: buffer
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/overridden-path' })
    );
    expect(buffer).toEqual(
      expect.objectContaining({
        traceId: 'trace-abc',
        didOverride: true
      })
    );
  });
});