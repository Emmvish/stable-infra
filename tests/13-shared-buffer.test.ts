import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { stableApiGateway, stableRequest, stableWorkflow } from '../src/core/index.js';
import type { API_GATEWAY_REQUEST, HandlePhaseCompletionHookOptions, STABLE_WORKFLOW_PHASE } from '../src/types/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Buffer options: commonBuffer (stableRequest) and sharedBuffer (stableApiGateway, stableWorkflow)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stableRequest: commonBuffer is writable in preExecution and readable in responseAnalyzer', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { state: 'ready' },
      statusText: 'OK',
      headers: {},
      config: { url: '/job' } as any
    });

    const commonBuffer: Record<string, any> = {};

    const responseAnalyzer = jest.fn(async ({ data, commonBuffer: cb }: any) => {
      expect(cb).toBe(commonBuffer);
      expect(cb.traceId).toBe('trace-123');
      return data?.state === 'ready';
    });

    const result = await stableRequest({
      reqData: { hostname: 'api.example.com', path: '/job' },
      resReq: true,
      commonBuffer,
      preExecution: {
        preExecutionHook: ({ commonBuffer: cb }: any) => {
          cb.traceId = 'trace-123';
          cb.setAt = 'preExecution';
          return {};
        },
        preExecutionHookParams: { any: 'value' },
        applyPreExecutionConfigOverride: false,
        continueOnPreExecutionHookFailure: false
      },
      responseAnalyzer
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ state: 'ready' });
    expect(responseAnalyzer).toHaveBeenCalledTimes(1);
    expect(commonBuffer).toEqual(
      expect.objectContaining({ traceId: 'trace-123', setAt: 'preExecution' })
    );
  });

  it('stableApiGateway: sharedBuffer is the same object used as commonBuffer for every request', async () => {
    mockedAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true, id: 'a' },
        statusText: 'OK',
        headers: {},
        config: {} as any
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true, id: 'b' },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    const sharedBuffer: Record<string, any> = {};

    const requests = [
      {
        id: 'a',
        requestOptions: {
          reqData: { path: '/a' },
          resReq: true,
          preExecution: {
            preExecutionHook: ({ commonBuffer }: any) => {
              expect(commonBuffer).toBe(sharedBuffer);
              commonBuffer.fromA = true;
              return {};
            },
            preExecutionHookParams: {},
            applyPreExecutionConfigOverride: false,
            continueOnPreExecutionHookFailure: false
          }
        }
      },
      {
        id: 'b',
        requestOptions: {
          reqData: { path: '/b' },
          resReq: true,
          preExecution: {
            preExecutionHook: ({ commonBuffer }: any) => {
              expect(commonBuffer).toBe(sharedBuffer);
              commonBuffer.fromB = true;
              return {};
            },
            preExecutionHookParams: {},
            applyPreExecutionConfigOverride: false,
            continueOnPreExecutionHookFailure: false
          }
        }
      }
    ] satisfies API_GATEWAY_REQUEST[];

    const results = await stableApiGateway(requests, {
      concurrentExecution: true,
      commonRequestData: { hostname: 'api.example.com' },
      sharedBuffer
    });

    expect(results).toHaveLength(2);
    expect(results.every(r => r.success)).toBe(true);

    expect(sharedBuffer).toEqual(expect.objectContaining({ fromA: true, fromB: true }));
  });

  it('stableApiGateway: without sharedBuffer, each request can have its own commonBuffer and they do NOT leak into each other', async () => {
    mockedAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true, id: 'first' },
        statusText: 'OK',
        headers: {},
        config: {} as any
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true, id: 'second' },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    const buffer1: Record<string, any> = {};
    const buffer2: Record<string, any> = {};

    const results = await stableApiGateway(
      [
        {
          id: 'first',
          requestOptions: {
            reqData: { path: '/first' },
            resReq: true,
            commonBuffer: buffer1,
            preExecution: {
              preExecutionHook: ({ commonBuffer }: any) => {
                commonBuffer.onlyIn1 = 'yes';
                return {};
              },
              preExecutionHookParams: {},
              applyPreExecutionConfigOverride: false,
              continueOnPreExecutionHookFailure: false
            }
          }
        },
        {
          id: 'second',
          requestOptions: {
            reqData: { path: '/second' },
            resReq: true,
            commonBuffer: buffer2,
            preExecution: {
              preExecutionHook: ({ commonBuffer }: any) => {
                expect(commonBuffer.onlyIn1).toBeUndefined();
                commonBuffer.onlyIn2 = 'yes';
                return {};
              },
              preExecutionHookParams: {},
              applyPreExecutionConfigOverride: false,
              continueOnPreExecutionHookFailure: false
            }
          }
        }
      ],
      {
        concurrentExecution: false,
        commonRequestData: { hostname: 'api.example.com' }
      }
    );

    expect(results).toHaveLength(2);
    expect(results.every(r => r.success)).toBe(true);

    expect(buffer1).toEqual(expect.objectContaining({ onlyIn1: 'yes' }));
    expect(buffer2).toEqual(expect.objectContaining({ onlyIn2: 'yes' }));
    expect(buffer2.onlyIn1).toBeUndefined();
  });

  it("stableWorkflow: Workflow's sharedBuffer is passed as phase's sharedBuffer into each phase gateway, and is shared across phases", async () => {
    mockedAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true, phase: 1 },
        statusText: 'OK',
        headers: {},
        config: {} as any
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true, phase: 2 },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    const workflowBuffer: Record<string, any> = {};

    const phases = [
      {
        id: 'p1',
        concurrentExecution: false,
        requests: [
          {
            id: 'r1',
            requestOptions: {
              reqData: { path: '/p1' },
              resReq: true,
              preExecution: {
                preExecutionHook: ({ commonBuffer }: any) => {
                  expect(commonBuffer).toBe(workflowBuffer);
                  commonBuffer.token = 'wf-token';
                  commonBuffer.setIn = 'p1';
                  return {};
                },
                preExecutionHookParams: {},
                applyPreExecutionConfigOverride: false,
                continueOnPreExecutionHookFailure: false
              }
            }
          }
        ]
      },
      {
        id: 'p2',
        concurrentExecution: false,
        requests: [
          {
            id: 'r2',
            requestOptions: {
              reqData: { path: '/p2' },
              resReq: true,
              preExecution: {
                preExecutionHook: ({ commonBuffer }: any) => {
                  expect(commonBuffer).toBe(workflowBuffer);
                  expect(commonBuffer.token).toBe('wf-token');
                  expect(commonBuffer.setIn).toBe('p1');

                  commonBuffer.usedIn = 'p2';
                  return {};
                },
                preExecutionHookParams: {},
                applyPreExecutionConfigOverride: false,
                continueOnPreExecutionHookFailure: false
              }
            }
          }
        ]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-buffer-demo',
      commonRequestData: { hostname: 'api.example.com' },
      sharedBuffer: workflowBuffer
    });

    expect(result.success).toBe(true);
    expect(result.totalPhases).toBe(2);
    expect(workflowBuffer).toEqual(
      expect.objectContaining({
        token: 'wf-token',
        setIn: 'p1',
        usedIn: 'p2'
      })
    );
  });

  it("stableWorkflow: Workflow's sharedBuffer is accessible in workflow hooks (handlePhaseCompletion) and mutations are visible to later phases", async () => {
    mockedAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true, phase: 1 },
        statusText: 'OK',
        headers: {},
        config: {} as any
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true, phase: 2 },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    const workflowBuffer: Record<string, any> = {};

    const handlePhaseCompletion = jest.fn(async ({ phaseResult, sharedBuffer: wb }: HandlePhaseCompletionHookOptions) => {
      expect(wb).toBe(workflowBuffer);
      wb!.completedPhases = (wb!.completedPhases || 0) + 1;
      if (phaseResult.phaseId === 'p1') {
        wb!.tokenFromHook = 'hook-token';
      }
    });

    const phases = [
      {
        id: 'p1',
        concurrentExecution: false,
        requests: [
          {
            id: 'r1',
            requestOptions: {
              reqData: { path: '/p1' },
              resReq: true
            }
          }
        ]
      },
      {
        id: 'p2',
        concurrentExecution: false,
        requests: [
          {
            id: 'r2',
            requestOptions: {
              reqData: { path: '/p2' },
              resReq: true,
              preExecution: {
                preExecutionHook: ({ commonBuffer }: any) => {
                  expect(commonBuffer).toBe(workflowBuffer);
                  expect(commonBuffer.tokenFromHook).toBe('hook-token');
                  return {};
                },
                preExecutionHookParams: {},
                applyPreExecutionConfigOverride: false,
                continueOnPreExecutionHookFailure: false
              }
            }
          }
        ]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-buffer-hooks-demo',
      commonRequestData: { hostname: 'api.example.com' },
      sharedBuffer: workflowBuffer,
      handlePhaseCompletion
    });

    expect(result.success).toBe(true);
    expect(handlePhaseCompletion).toHaveBeenCalledTimes(2);
    expect(workflowBuffer).toEqual(
      expect.objectContaining({ tokenFromHook: 'hook-token', completedPhases: 2 })
    );
  });
});