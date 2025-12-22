import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosRequestConfig } from 'axios';
import { stableWorkflow } from '../src/core/index.js';
import { STABLE_WORKFLOW_PHASE } from '../src/types/index.js';
import { RETRY_STRATEGIES } from '../src/enums/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Multi-Phase Workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute multiple phases and return an aggregated workflow result', async () => {
    mockedAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { step: 'init', ok: true },
        statusText: 'OK',
        headers: {},
        config: {} as AxiosRequestConfig
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { step: 'process', ok: true },
        statusText: 'OK',
        headers: {},
        config: {} as AxiosRequestConfig
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { step: 'finalize', ok: true },
        statusText: 'OK',
        headers: {},
        config: {} as AxiosRequestConfig
      });

    const phases = [
      {
        id: 'phase-1-init',
        requests: [
          {
            id: 'init',
            requestOptions: { reqData: { path: '/init' }, resReq: true }
          }
        ]
      },
      {
        id: 'phase-2-process-and-finalize',
        concurrentExecution: false,
        stopOnFirstError: true,
        requests: [
          {
            id: 'process',
            requestOptions: { reqData: { path: '/process' }, resReq: true }
          },
          {
            id: 'finalize',
            requestOptions: { reqData: { path: '/finalize' }, resReq: true }
          }
        ]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-basic',
      commonRequestData: { hostname: 'api.example.com' },
      commonAttempts: 1,
      commonWait: 1
    });

    expect(result.workflowId).toBe('wf-basic');
    expect(result.success).toBe(true);
    expect(result.totalPhases).toBe(2);
    expect(result.completedPhases).toBe(2);
    expect(result.totalRequests).toBe(3);
    expect(result.successfulRequests).toBe(3);
    expect(result.failedRequests).toBe(0);

    expect(result.phases).toHaveLength(2);
    expect(result.phases[0]).toEqual(
      expect.objectContaining({
        phaseId: 'phase-1-init',
        success: true,
        totalRequests: 1,
        successfulRequests: 1,
        failedRequests: 0,
        responses: [
          expect.objectContaining({
            requestId: 'init',
            success: true,
            data: { step: 'init', ok: true }
          })
        ]
      })
    );
  });

  it('should stop after the first phase that has failed requests when stopOnFirstPhaseError is true', async () => {
    mockedAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true },
        statusText: 'OK',
        headers: {},
        config: {} as AxiosRequestConfig
      })
      .mockRejectedValueOnce({
        response: { status: 500, data: 'Server Error' },
        message: 'Server Error'
      });

    const phases = [
      {
        id: 'phase-1-ok',
        requests: [
          {
            id: 'req-ok',
            requestOptions: { reqData: { path: '/ok' }, resReq: true }
          }
        ]
      },
      {
        id: 'phase-2-has-failure',
        requests: [
          {
            id: 'req-fail',
            requestOptions: { reqData: { path: '/fail' }, resReq: true, attempts: 1 }
          }
        ]
      },
      {
        id: 'phase-3-should-not-run',
        requests: [
          {
            id: 'req-never',
            requestOptions: { reqData: { path: '/never' }, resReq: true }
          }
        ]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-stop-on-phase-failure',
      stopOnFirstPhaseError: true,
      commonRequestData: { hostname: 'api.example.com' },
      commonAttempts: 1,
      commonWait: 1
    });

    expect(result.success).toBe(false);
    expect(result.totalPhases).toBe(3);
    expect(result.completedPhases).toBe(2);
    expect(result.totalRequests).toBe(2);
    expect(result.successfulRequests).toBe(1);
    expect(result.failedRequests).toBe(1);

    expect(result.phases[1]).toEqual(
      expect.objectContaining({
        phaseId: 'phase-2-has-failure',
        success: false,
        totalRequests: 1,
        successfulRequests: 0,
        failedRequests: 1
      })
    );
  });

  it('should respect per-phase execution mode (concurrent vs sequential) and stopOnFirstError in sequential phases', async () => {
    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        if (config.url === '/a') {
          return {
            status: 200,
            data: { id: 'a' },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }
        if (config.url === '/b') {
          return {
            status: 200,
            data: { id: 'b' },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }

        if (config.url === '/first') {
          throw { response: { status: 500 }, message: 'boom' };
        }
        if (config.url === '/second') {
          return {
            status: 200,
            data: { id: 'second' },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }

        throw new Error('Unexpected request');
      }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
    );

    const phases = [
      {
        id: 'phase-1-concurrent',
        concurrentExecution: true,
        requests: [
          { id: 'a', requestOptions: { reqData: { path: '/a' }, resReq: true } },
          { id: 'b', requestOptions: { reqData: { path: '/b' }, resReq: true } }
        ]
      },
      {
        id: 'phase-2-sequential-stop-on-first-error',
        concurrentExecution: false,
        stopOnFirstError: true,
        requests: [
          { id: 'first', requestOptions: { reqData: { path: '/first' }, resReq: true, attempts: 1 } },
          { id: 'second', requestOptions: { reqData: { path: '/second' }, resReq: true, attempts: 1 } }
        ]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-phase-modes',
      commonRequestData: { hostname: 'api.example.com' },
      commonAttempts: 1,
      commonWait: 1
    });

    expect(mockedAxios.request).toHaveBeenCalledTimes(3);
    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({ url: '/a' }));
    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({ url: '/b' }));
    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({ url: '/first' }));
    expect(mockedAxios.request).not.toHaveBeenCalledWith(expect.objectContaining({ url: '/second' }));

    expect(result.success).toBe(false);
    expect(result.phases[0].success).toBe(true);
    expect(result.phases[1].success).toBe(false);
    expect(result.failedRequests).toBe(1);
  });

  it('should allow phase.commonConfig to override workflow-level defaults (e.g., retries)', async () => {
    mockedAxios.request
      .mockRejectedValueOnce({
        response: { status: 503, data: 'Service Unavailable' },
        message: '503'
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true },
        statusText: 'OK',
        headers: {},
        config: {} as AxiosRequestConfig
      });

    const phases = [
      {
        id: 'phase-with-local-retry',
        commonConfig: {
          commonAttempts: 2,
          commonWait: 1,
          commonRetryStrategy: RETRY_STRATEGIES.FIXED
        },
        requests: [
          {
            id: 'retry-me',
            requestOptions: { reqData: { path: '/retry' }, resReq: true }
          }
        ]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    await stableWorkflow(phases, {
      workflowId: 'wf-phase-commonConfig',
      commonRequestData: { hostname: 'api.example.com' },
      commonAttempts: 1,
      commonWait: 1
    });

    expect(mockedAxios.request).toHaveBeenCalledTimes(2);
  });

  it('should call handlePhaseCompletion hook once per completed phase with the phase result', async () => {
    const handlePhaseCompletion = jest.fn();

    mockedAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true, phase: 1 },
        statusText: 'OK',
        headers: {},
        config: {} as AxiosRequestConfig
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true, phase: 2 },
        statusText: 'OK',
        headers: {},
        config: {} as AxiosRequestConfig
      });

    const phases = [
      {
        id: 'p1',
        requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }]
      },
      {
        id: 'p2',
        requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-hooks',
      commonRequestData: { hostname: 'api.example.com' },
      commonAttempts: 1,
      commonWait: 1,
      handlePhaseCompletion
    });

    expect(result.success).toBe(true);
    expect(handlePhaseCompletion).toHaveBeenCalledTimes(2);

    expect(handlePhaseCompletion).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        workflowId: 'wf-hooks',
        phaseResult: expect.objectContaining({
          phaseId: 'p1',
          phaseIndex: 0,
          totalRequests: 1,
          successfulRequests: 1,
          failedRequests: 0,
          responses: [expect.objectContaining({ requestId: 'r1', success: true })]
        })
      })
    );
  });

  it('should support requestGroups inside a workflow (group config overrides global config)', async () => {
    mockedAxios.request
      .mockRejectedValueOnce({
        response: { status: 500, data: 'Error' },
        message: '500'
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true },
        statusText: 'OK',
        headers: {},
        config: {} as AxiosRequestConfig
      });

    const phases = [
      {
        id: 'phase-grouped-retry',
        requests: [
          {
            id: 'critical-req',
            groupId: 'critical',
            requestOptions: { reqData: { path: '/critical' }, resReq: true }
          }
        ]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    await stableWorkflow(phases, {
      workflowId: 'wf-request-groups',
      commonRequestData: { hostname: 'api.example.com' },
      commonAttempts: 1,
      commonWait: 1,
      requestGroups: [
        {
          id: 'critical',
          commonConfig: {
            commonAttempts: 2,
            commonWait: 1,
            commonRetryStrategy: RETRY_STRATEGIES.FIXED
          }
        }
      ]
    });

    expect(mockedAxios.request).toHaveBeenCalledTimes(2);
  });
});