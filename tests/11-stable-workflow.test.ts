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

  it('should execute all phases concurrently when concurrentPhaseExecution is true', async () => {
    const executionOrder: string[] = [];
    const phaseStartTimes: Record<string, number> = {};

    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        const path = config.url || '';
        const phaseId = path.includes('p1') ? 'p1' : path.includes('p2') ? 'p2' : 'p3';
        
        if (!phaseStartTimes[phaseId]) {
          phaseStartTimes[phaseId] = Date.now();
        }
        
        executionOrder.push(path);
        
        // Simulate different execution times for different phases
        if (path.includes('p1')) {
          await new Promise(resolve => setTimeout(resolve, 50));
        } else if (path.includes('p2')) {
          await new Promise(resolve => setTimeout(resolve, 30));
        } else if (path.includes('p3')) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        return {
          status: 200,
          data: { phase: phaseId, path },
          statusText: 'OK',
          headers: {},
          config: config as any
        };
      }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
    );

    const phases = [
      {
        id: 'phase-1',
        requests: [
          { id: 'r1', requestOptions: { reqData: { path: '/p1/r1' }, resReq: true } }
        ]
      },
      {
        id: 'phase-2',
        requests: [
          { id: 'r2', requestOptions: { reqData: { path: '/p2/r1' }, resReq: true } }
        ]
      },
      {
        id: 'phase-3',
        requests: [
          { id: 'r3', requestOptions: { reqData: { path: '/p3/r1' }, resReq: true } }
        ]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const startTime = Date.now();
    const result = await stableWorkflow(phases, {
      workflowId: 'wf-concurrent-phases',
      commonRequestData: { hostname: 'api.example.com' },
      commonAttempts: 1,
      commonWait: 1,
      concurrentPhaseExecution: true
    });
    const totalTime = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(result.completedPhases).toBe(3);
    expect(mockedAxios.request).toHaveBeenCalledTimes(3);

    // All phases should start within a short time window (indicating concurrent execution)
    const startTimeValues = Object.values(phaseStartTimes);
    const maxTimeDiff = Math.max(...startTimeValues) - Math.min(...startTimeValues);
    expect(maxTimeDiff).toBeLessThan(30); // Should start nearly simultaneously

    // Total time should be closer to the longest phase (50ms) rather than sum (90ms)
    expect(totalTime).toBeLessThan(120); // Much less than sequential would take
  });

  it('should handle phase failures gracefully in concurrent execution', async () => {
    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        const path = config.url || '';
        
        if (path.includes('p2')) {
          throw {
            response: { status: 500, data: 'Phase 2 error' },
            message: 'Phase 2 failed'
          };
        }

        return {
          status: 200,
          data: { success: true, path },
          statusText: 'OK',
          headers: {},
          config: config as any
        };
      }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
    );

    const phases = [
      {
        id: 'phase-1-success',
        requests: [
          { id: 'r1', requestOptions: { reqData: { path: '/p1/r1' }, resReq: true, attempts: 1 } }
        ]
      },
      {
        id: 'phase-2-fail',
        requests: [
          { id: 'r2', requestOptions: { reqData: { path: '/p2/r1' }, resReq: true, attempts: 1 } }
        ]
      },
      {
        id: 'phase-3-success',
        requests: [
          { id: 'r3', requestOptions: { reqData: { path: '/p3/r1' }, resReq: true, attempts: 1 } }
        ]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-concurrent-with-failure',
      commonRequestData: { hostname: 'api.example.com' },
      commonAttempts: 1,
      commonWait: 1,
      concurrentPhaseExecution: true
    });

    expect(result.success).toBe(false);
    expect(result.completedPhases).toBe(3); // All phases should complete
    expect(result.successfulRequests).toBe(2);
    expect(result.failedRequests).toBe(1);
    
    // Verify all three phases were executed
    expect(mockedAxios.request).toHaveBeenCalledTimes(3);
    
    // Check individual phase results
    expect(result.phases[0].success).toBe(true);
    expect(result.phases[1].success).toBe(false);
    expect(result.phases[2].success).toBe(true);
  });

  it('should execute phases with different concurrentExecution settings within concurrent workflow', async () => {
    const executionLog: string[] = [];

    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        const path = config.url || '';
        executionLog.push(`start-${path}`);
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        executionLog.push(`end-${path}`);

        return {
          status: 200,
          data: { path },
          statusText: 'OK',
          headers: {},
          config: config as any
        };
      }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
    );

    const phases = [
      {
        id: 'phase-1-concurrent-requests',
        concurrentExecution: true,
        requests: [
          { id: 'r1a', requestOptions: { reqData: { path: '/p1/r1' }, resReq: true } },
          { id: 'r1b', requestOptions: { reqData: { path: '/p1/r2' }, resReq: true } }
        ]
      },
      {
        id: 'phase-2-sequential-requests',
        concurrentExecution: false,
        requests: [
          { id: 'r2a', requestOptions: { reqData: { path: '/p2/r1' }, resReq: true } },
          { id: 'r2b', requestOptions: { reqData: { path: '/p2/r2' }, resReq: true } }
        ]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-mixed-execution-modes',
      commonRequestData: { hostname: 'api.example.com' },
      commonAttempts: 1,
      commonWait: 1,
      concurrentPhaseExecution: true
    });

    expect(result.success).toBe(true);
    expect(result.completedPhases).toBe(2);
    expect(mockedAxios.request).toHaveBeenCalledTimes(4);

    // Phase 1 requests should start concurrently (both start before either ends)
    const p1r1Start = executionLog.indexOf('start-/p1/r1');
    const p1r2Start = executionLog.indexOf('start-/p1/r2');
    const p1r1End = executionLog.indexOf('end-/p1/r1');
    
    expect(p1r2Start).toBeLessThan(p1r1End); // r2 starts before r1 ends

    // Phase 2 requests should be sequential (one completes before next starts)
    const p2r1End = executionLog.indexOf('end-/p2/r1');
    const p2r2Start = executionLog.indexOf('start-/p2/r2');
    
    expect(p2r2Start).toBeGreaterThan(p2r1End); // r2 starts after r1 ends
  });

  it('should call handlePhaseCompletion for all phases in concurrent execution', async () => {
    const handlePhaseCompletion = jest.fn();
    const completedPhases: string[] = [];

    handlePhaseCompletion.mockImplementation(async ({ phaseResult }: any) => {
      completedPhases.push(phaseResult.phaseId);
    });

    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        // Simulate variable execution times
        const path = config.url || '';
        const delay = path.includes('p1') ? 50 : path.includes('p2') ? 30 : 10;
        await new Promise(resolve => setTimeout(resolve, delay));

        return {
          status: 200,
          data: { path },
          statusText: 'OK',
          headers: {},
          config: config as any
        };
      }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
    );

    const phases = [
      {
        id: 'phase-1-slow',
        requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1/r1' }, resReq: true } }]
      },
      {
        id: 'phase-2-medium',
        requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2/r1' }, resReq: true } }]
      },
      {
        id: 'phase-3-fast',
        requests: [{ id: 'r3', requestOptions: { reqData: { path: '/p3/r1' }, resReq: true } }]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-concurrent-hooks',
      commonRequestData: { hostname: 'api.example.com' },
      commonAttempts: 1,
      commonWait: 1,
      concurrentPhaseExecution: true,
      handlePhaseCompletion
    });

    expect(result.success).toBe(true);
    expect(handlePhaseCompletion).toHaveBeenCalledTimes(3);
    
    // All phases should have completion hooks called
    expect(completedPhases).toHaveLength(3);
    expect(completedPhases).toContain('phase-1-slow');
    expect(completedPhases).toContain('phase-2-medium');
    expect(completedPhases).toContain('phase-3-fast');

    // Fastest phase should complete first (phase-3-fast)
    expect(completedPhases[0]).toBe('phase-3-fast');
  });

  it('should respect stopOnFirstPhaseError=false in concurrent execution and complete all phases', async () => {
    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        const path = config.url || '';
        
        if (path.includes('p2')) {
          await new Promise(resolve => setTimeout(resolve, 20));
          throw {
            response: { status: 500, data: 'Phase 2 error' },
            message: 'Phase 2 failed'
          };
        }

        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          status: 200,
          data: { success: true, path },
          statusText: 'OK',
          headers: {},
          config: config as any
        };
      }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
    );

    const phases = [
      {
        id: 'phase-1',
        requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true, attempts: 1 } }]
      },
      {
        id: 'phase-2-fail',
        requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true, attempts: 1 } }]
      },
      {
        id: 'phase-3',
        requests: [{ id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true, attempts: 1 } }]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-concurrent-continue-on-error',
      commonRequestData: { hostname: 'api.example.com' },
      concurrentPhaseExecution: true,
      stopOnFirstPhaseError: false // Should not stop even though a phase fails
    });

    expect(result.success).toBe(false);
    expect(result.completedPhases).toBe(3); // All 3 phases should complete
    expect(result.successfulRequests).toBe(2);
    expect(result.failedRequests).toBe(1);
    expect(mockedAxios.request).toHaveBeenCalledTimes(3);
  });

  it('should handle sharedBuffer correctly in concurrent phase execution', async () => {
    const sharedBuffer: Record<string, any> = { counter: 0 };

    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          status: 200,
          data: { path: config.url },
          statusText: 'OK',
          headers: {},
          config: config as any
        };
      }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
    );

    const phases = [
      {
        id: 'phase-1',
        requests: [
          {
            id: 'r1',
            requestOptions: {
              reqData: { path: '/p1' },
              resReq: true,
              preExecution: {
                preExecutionHook: ({ commonBuffer }: any) => {
                  commonBuffer.phase1 = true;
                  commonBuffer.counter += 1;
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
        id: 'phase-2',
        requests: [
          {
            id: 'r2',
            requestOptions: {
              reqData: { path: '/p2' },
              resReq: true,
              preExecution: {
                preExecutionHook: ({ commonBuffer }: any) => {
                  commonBuffer.phase2 = true;
                  commonBuffer.counter += 1;
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
        id: 'phase-3',
        requests: [
          {
            id: 'r3',
            requestOptions: {
              reqData: { path: '/p3' },
              resReq: true,
              preExecution: {
                preExecutionHook: ({ commonBuffer }: any) => {
                  commonBuffer.phase3 = true;
                  commonBuffer.counter += 1;
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
      workflowId: 'wf-concurrent-shared-buffer',
      commonRequestData: { hostname: 'api.example.com' },
      concurrentPhaseExecution: true,
      sharedBuffer
    });

    expect(result.success).toBe(true);
    expect(result.completedPhases).toBe(3);
    
    // All phases should have written to shared buffer
    expect(sharedBuffer.phase1).toBe(true);
    expect(sharedBuffer.phase2).toBe(true);
    expect(sharedBuffer.phase3).toBe(true);
    expect(sharedBuffer.counter).toBe(3);
  });
});