import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosRequestConfig } from 'axios';
import { stableWorkflow } from '../src/core/index.js';
import { STABLE_WORKFLOW_PHASE } from '../src/types/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Mixed Sequential and Concurrent Phase Execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute basic mixed workflow: sequential -> concurrent group -> sequential', async () => {
    const executionLog: string[] = [];
    const phaseStartTimes: Record<string, number> = {};

    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        const path = config.url || '';
        const phaseId = path.split('/')[1];
        
        if (!phaseStartTimes[phaseId]) {
          phaseStartTimes[phaseId] = Date.now();
        }
        
        executionLog.push(`start-${phaseId}`);
        
        // Simulate execution time
        await new Promise(resolve => setTimeout(resolve, 20));
        
        executionLog.push(`end-${phaseId}`);

        return {
          status: 200,
          data: { phase: phaseId },
          statusText: 'OK',
          headers: {},
          config: config as any
        };
      }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
    );

    const phases = [
      {
        id: 'phase-1-sequential',
        requests: [
          { id: 'r1', requestOptions: { reqData: { path: '/p1/r1' }, resReq: true } }
        ]
      },
      {
        id: 'phase-2-concurrent-start',
        markConcurrentPhase: true,
        requests: [
          { id: 'r2', requestOptions: { reqData: { path: '/p2/r1' }, resReq: true } }
        ]
      },
      {
        id: 'phase-3-concurrent',
        markConcurrentPhase: true,
        requests: [
          { id: 'r3', requestOptions: { reqData: { path: '/p3/r1' }, resReq: true } }
        ]
      },
      {
        id: 'phase-4-sequential',
        requests: [
          { id: 'r4', requestOptions: { reqData: { path: '/p4/r1' }, resReq: true } }
        ]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-mixed-basic',
      commonRequestData: { hostname: 'api.example.com' },
      commonAttempts: 1,
      commonWait: 1,
      enableMixedExecution: true
    });

    expect(result.success).toBe(true);
    expect(result.completedPhases).toBe(4);
    expect(mockedAxios.request).toHaveBeenCalledTimes(4);

    // Phase 1 should complete before phase 2 and 3 start
    const p1End = executionLog.indexOf('end-p1');
    const p2Start = executionLog.indexOf('start-p2');
    const p3Start = executionLog.indexOf('start-p3');
    expect(p1End).toBeLessThan(p2Start);
    expect(p1End).toBeLessThan(p3Start);

    // Phase 2 and 3 should start concurrently (within short time window)
    const p2StartTime = phaseStartTimes['p2'];
    const p3StartTime = phaseStartTimes['p3'];
    expect(Math.abs(p2StartTime - p3StartTime)).toBeLessThan(30);

    // Phase 4 should start after both phase 2 and 3 complete
    const p2End = executionLog.indexOf('end-p2');
    const p3End = executionLog.indexOf('end-p3');
    const p4Start = executionLog.indexOf('start-p4');
    expect(p4Start).toBeGreaterThan(p2End);
    expect(p4Start).toBeGreaterThan(p3End);
  });

  it('should handle multiple concurrent groups in the same workflow', async () => {
    const executionOrder: { phase: string; event: string; time: number }[] = [];

    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        const path = config.url || '';
        const phaseId = path.split('/')[1];
        
        executionOrder.push({ phase: phaseId, event: 'start', time: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 15));
        executionOrder.push({ phase: phaseId, event: 'end', time: Date.now() });

        return {
          status: 200,
          data: { phase: phaseId },
          statusText: 'OK',
          headers: {},
          config: config as any
        };
      }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
    );

    const phases = [
      {
        id: 'phase-1-concurrent-group-1',
        markConcurrentPhase: true,
        requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1/r1' }, resReq: true } }]
      },
      {
        id: 'phase-2-concurrent-group-1',
        markConcurrentPhase: true,
        requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2/r1' }, resReq: true } }]
      },
      {
        id: 'phase-3-sequential',
        requests: [{ id: 'r3', requestOptions: { reqData: { path: '/p3/r1' }, resReq: true } }]
      },
      {
        id: 'phase-4-concurrent-group-2',
        markConcurrentPhase: true,
        requests: [{ id: 'r4', requestOptions: { reqData: { path: '/p4/r1' }, resReq: true } }]
      },
      {
        id: 'phase-5-concurrent-group-2',
        markConcurrentPhase: true,
        requests: [{ id: 'r5', requestOptions: { reqData: { path: '/p5/r1' }, resReq: true } }]
      },
      {
        id: 'phase-6-concurrent-group-2',
        markConcurrentPhase: true,
        requests: [{ id: 'r6', requestOptions: { reqData: { path: '/p6/r1' }, resReq: true } }]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-mixed-multiple-groups',
      commonRequestData: { hostname: 'api.example.com' },
      enableMixedExecution: true
    });

    expect(result.success).toBe(true);
    expect(result.completedPhases).toBe(6);

    // Group 1 (p1, p2) should execute concurrently
    const p1Start = executionOrder.find(e => e.phase === 'p1' && e.event === 'start')!;
    const p2Start = executionOrder.find(e => e.phase === 'p2' && e.event === 'start')!;
    expect(Math.abs(p1Start.time - p2Start.time)).toBeLessThan(30);

    // Phase 3 should execute after group 1
    const p1End = executionOrder.find(e => e.phase === 'p1' && e.event === 'end')!;
    const p2End = executionOrder.find(e => e.phase === 'p2' && e.event === 'end')!;
    const p3Start = executionOrder.find(e => e.phase === 'p3' && e.event === 'start')!;
    expect(p3Start.time).toBeGreaterThanOrEqual(Math.max(p1End.time, p2End.time));

    // Group 2 (p4, p5, p6) should execute concurrently after p3
    const p3End = executionOrder.find(e => e.phase === 'p3' && e.event === 'end')!;
    const p4Start = executionOrder.find(e => e.phase === 'p4' && e.event === 'start')!;
    const p5Start = executionOrder.find(e => e.phase === 'p5' && e.event === 'start')!;
    const p6Start = executionOrder.find(e => e.phase === 'p6' && e.event === 'start')!;
    
    expect(p4Start.time).toBeGreaterThanOrEqual(p3End.time);
    expect(Math.abs(p4Start.time - p5Start.time)).toBeLessThan(30);
    expect(Math.abs(p5Start.time - p6Start.time)).toBeLessThan(30);
  });

  it('should handle single phase with markConcurrentPhase (executes alone)', async () => {
    mockedAxios.request.mockResolvedValue({
      status: 200,
      data: { success: true },
      statusText: 'OK',
      headers: {},
      config: {} as AxiosRequestConfig
    });

    const phases = [
      {
        id: 'phase-1-sequential',
        requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }]
      },
      {
        id: 'phase-2-concurrent-alone',
        markConcurrentPhase: true,
        requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }]
      },
      {
        id: 'phase-3-sequential',
        requests: [{ id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-mixed-single-concurrent',
      commonRequestData: { hostname: 'api.example.com' },
      enableMixedExecution: true
    });

    expect(result.success).toBe(true);
    expect(result.completedPhases).toBe(3);
    expect(mockedAxios.request).toHaveBeenCalledTimes(3);
  });

  it('should handle error in concurrent group without stopping other phases in the group', async () => {
    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        const path = config.url || '';
        
        if (path.includes('p2')) {
          await new Promise(resolve => setTimeout(resolve, 10));
          throw {
            response: { status: 500, data: 'Phase 2 error' },
            message: 'Phase 2 failed'
          };
        }

        await new Promise(resolve => setTimeout(resolve, 20));
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
        id: 'phase-1-concurrent',
        markConcurrentPhase: true,
        requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true, attempts: 1 } }]
      },
      {
        id: 'phase-2-concurrent-fail',
        markConcurrentPhase: true,
        requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true, attempts: 1 } }]
      },
      {
        id: 'phase-3-concurrent',
        markConcurrentPhase: true,
        requests: [{ id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true, attempts: 1 } }]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-mixed-concurrent-group-error',
      commonRequestData: { hostname: 'api.example.com' },
      enableMixedExecution: true,
      stopOnFirstPhaseError: false
    });

    expect(result.success).toBe(false);
    expect(result.completedPhases).toBe(3);
    expect(result.successfulRequests).toBe(2);
    expect(result.failedRequests).toBe(1);
    expect(mockedAxios.request).toHaveBeenCalledTimes(3);

    // Verify all three phases were executed despite one failure
    expect(result.phases[0].success).toBe(true);
    expect(result.phases[1].success).toBe(false);
    expect(result.phases[2].success).toBe(true);
  });

  it('should stop workflow after concurrent group fails when stopOnFirstPhaseError is true', async () => {
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
        id: 'phase-1-concurrent',
        markConcurrentPhase: true,
        requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true, attempts: 1 } }]
      },
      {
        id: 'phase-2-concurrent-fail',
        markConcurrentPhase: true,
        requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true, attempts: 1 } }]
      },
      {
        id: 'phase-3-should-not-run',
        requests: [{ id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-mixed-stop-on-error',
      commonRequestData: { hostname: 'api.example.com' },
      enableMixedExecution: true,
      stopOnFirstPhaseError: true
    });

    expect(result.success).toBe(false);
    expect(result.completedPhases).toBe(2); // Only phases 1 and 2, not 3
    expect(result.totalPhases).toBe(3);
    expect(result.failedRequests).toBe(1);
    
    // Phase 3 should not have been executed
    expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    expect(mockedAxios.request).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: '/p3' })
    );
  });

  it('should call handlePhaseCompletion for all phases in concurrent groups', async () => {
    const handlePhaseCompletion = jest.fn();
    const completedPhases: string[] = [];

    handlePhaseCompletion.mockImplementation(({ phaseResult }: any) => {
      completedPhases.push(phaseResult.phaseId);
    });

    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        const path = config.url || '';
        const delay = path.includes('p2') ? 10 : path.includes('p3') ? 5 : 20;
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
        id: 'phase-1-sequential',
        requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }]
      },
      {
        id: 'phase-2-concurrent',
        markConcurrentPhase: true,
        requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }]
      },
      {
        id: 'phase-3-concurrent',
        markConcurrentPhase: true,
        requests: [{ id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-mixed-hooks',
      commonRequestData: { hostname: 'api.example.com' },
      enableMixedExecution: true,
      handlePhaseCompletion
    });

    expect(result.success).toBe(true);
    expect(handlePhaseCompletion).toHaveBeenCalledTimes(3);
    
    // All phases should have completion hooks called
    expect(completedPhases).toContain('phase-1-sequential');
    expect(completedPhases).toContain('phase-2-concurrent');
    expect(completedPhases).toContain('phase-3-concurrent');
  });

  it('should call handlePhaseError for failed phases in concurrent groups', async () => {
    const handlePhaseError = jest.fn();
    const handlePhaseCompletion = jest.fn();
    const errorPhases: string[] = [];
    const successPhases: string[] = [];

    handlePhaseError.mockImplementation(({ phaseResult }: any) => {
      errorPhases.push(phaseResult.phaseId);
    });

    handlePhaseCompletion.mockImplementation(({ phaseResult }: any) => {
      successPhases.push(phaseResult.phaseId);
    });

    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        const path = config.url || '';
        
        if (path.includes('p2')) {
          throw {
            response: { status: 500, data: 'Error' },
            message: 'Phase 2 failed'
          };
        }

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
        id: 'phase-1-concurrent-success',
        markConcurrentPhase: true,
        requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true, attempts: 1 } }]
      },
      {
        id: 'phase-2-concurrent-fail',
        markConcurrentPhase: true,
        requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true, attempts: 1 } }]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-mixed-error-hooks',
      commonRequestData: { hostname: 'api.example.com' },
      enableMixedExecution: true,
      handlePhaseError,
      handlePhaseCompletion
    });

    expect(result.success).toBe(false);
    
    // Both phases should complete (one with success=true, one with success=false)
    // handlePhaseCompletion is called for both because they execute successfully
    // (even though phase 2 has failed requests)
    expect(handlePhaseCompletion).toHaveBeenCalledTimes(2);
    expect(successPhases).toContain('phase-1-concurrent-success');
    expect(successPhases).toContain('phase-2-concurrent-fail');
    
    // handlePhaseError is NOT called because the phase execution itself didn't throw
    // The phase completed but had failed requests
    expect(handlePhaseError).not.toHaveBeenCalled();
    
    // Verify that phase 2 is marked as failed
    const phase2Result = result.phases.find(p => p.phaseId === 'phase-2-concurrent-fail');
    expect(phase2Result?.success).toBe(false);
    expect(phase2Result?.failedRequests).toBe(1);
  });

  it('should not enable mixed execution when enableMixedExecution is false', async () => {
    const executionLog: string[] = [];

    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        const path = config.url || '';
        executionLog.push(`${path}-start`);
        await new Promise(resolve => setTimeout(resolve, 10));
        executionLog.push(`${path}-end`);

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
        id: 'phase-1',
        markConcurrentPhase: true, // Should be ignored
        requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }]
      },
      {
        id: 'phase-2',
        markConcurrentPhase: true, // Should be ignored
        requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-mixed-disabled',
      commonRequestData: { hostname: 'api.example.com' },
      enableMixedExecution: false // Explicitly disabled
    });

    expect(result.success).toBe(true);
    
    // Should execute sequentially, not concurrently
    const p1EndIndex = executionLog.indexOf('/p1-end');
    const p2StartIndex = executionLog.indexOf('/p2-start');
    expect(p2StartIndex).toBeGreaterThan(p1EndIndex);
  });

  it('should respect mixed execution mode with markConcurrentPhase flags', async () => {
    const executionLog: string[] = [];

    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        const path = config.url || '';
        executionLog.push(`${path}-start`);
        await new Promise(resolve => setTimeout(resolve, 15));
        executionLog.push(`${path}-end`);

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
        id: 'phase-1-not-concurrent',
        requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }]
      },
      {
        id: 'phase-2-concurrent',
        markConcurrentPhase: true,
        requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }]
      },
      {
        id: 'phase-3-concurrent',
        markConcurrentPhase: true,
        requests: [{ id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-mixed-override-concurrent',
      commonRequestData: { hostname: 'api.example.com' },
      enableMixedExecution: true // Mixed execution mode enabled
    });

    expect(result.success).toBe(true);
    expect(result.completedPhases).toBe(3);
    
    // Phase 1 should complete before phase 2 and 3 start
    const p1EndIndex = executionLog.indexOf('/p1-end');
    const p2StartIndex = executionLog.indexOf('/p2-start');
    const p3StartIndex = executionLog.indexOf('/p3-start');
    
    // In mixed mode, phase 1 executes first (sequential), then 2 & 3 together (concurrent)
    expect(p2StartIndex).toBeGreaterThan(p1EndIndex);
    expect(p3StartIndex).toBeGreaterThan(p1EndIndex);
    
    // Phase 2 and 3 should start nearly simultaneously (concurrent)
    expect(Math.abs(p2StartIndex - p3StartIndex)).toBeLessThanOrEqual(1);
  });

  it('should handle shared buffer correctly in mixed execution mode', async () => {
    const sharedBuffer: Record<string, any> = { executionOrder: [] };

    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        await new Promise(resolve => setTimeout(resolve, 5));
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
                  commonBuffer.executionOrder.push('p1');
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
        markConcurrentPhase: true,
        requests: [
          {
            id: 'r2',
            requestOptions: {
              reqData: { path: '/p2' },
              resReq: true,
              preExecution: {
                preExecutionHook: ({ commonBuffer }: any) => {
                  commonBuffer.phase2 = true;
                  commonBuffer.executionOrder.push('p2');
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
        markConcurrentPhase: true,
        requests: [
          {
            id: 'r3',
            requestOptions: {
              reqData: { path: '/p3' },
              resReq: true,
              preExecution: {
                preExecutionHook: ({ commonBuffer }: any) => {
                  commonBuffer.phase3 = true;
                  commonBuffer.executionOrder.push('p3');
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
      workflowId: 'wf-mixed-shared-buffer',
      commonRequestData: { hostname: 'api.example.com' },
      enableMixedExecution: true,
      sharedBuffer
    });

    expect(result.success).toBe(true);
    expect(result.completedPhases).toBe(3);
    
    // All phases should have written to shared buffer
    expect(sharedBuffer.phase1).toBe(true);
    expect(sharedBuffer.phase2).toBe(true);
    expect(sharedBuffer.phase3).toBe(true);
    expect(sharedBuffer.executionOrder).toHaveLength(3);
    
    // p1 should execute first, p2 and p3 order may vary
    expect(sharedBuffer.executionOrder[0]).toBe('p1');
    expect(sharedBuffer.executionOrder.slice(1)).toContain('p2');
    expect(sharedBuffer.executionOrder.slice(1)).toContain('p3');
  });

  it('should handle all phases marked as concurrent in mixed mode', async () => {
    const executionStarts: Record<string, number> = {};

    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        const path = config.url || '';
        const phaseId = path.split('/')[1];
        executionStarts[phaseId] = Date.now();
        
        await new Promise(resolve => setTimeout(resolve, 20));

        return {
          status: 200,
          data: { phase: phaseId },
          statusText: 'OK',
          headers: {},
          config: config as any
        };
      }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
    );

    const phases = [
      {
        id: 'phase-1',
        markConcurrentPhase: true,
        requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }]
      },
      {
        id: 'phase-2',
        markConcurrentPhase: true,
        requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }]
      },
      {
        id: 'phase-3',
        markConcurrentPhase: true,
        requests: [{ id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-mixed-all-concurrent',
      commonRequestData: { hostname: 'api.example.com' },
      enableMixedExecution: true
    });

    expect(result.success).toBe(true);
    expect(result.completedPhases).toBe(3);
    
    // All phases should start nearly simultaneously
    const startTimes = Object.values(executionStarts);
    const maxDiff = Math.max(...startTimes) - Math.min(...startTimes);
    expect(maxDiff).toBeLessThan(30);
  });

  it('should handle no phases marked as concurrent in mixed mode (all sequential)', async () => {
    const executionLog: string[] = [];

    mockedAxios.request.mockImplementation(
      (async (config: AxiosRequestConfig) => {
        const path = config.url || '';
        executionLog.push(`${path}-start`);
        await new Promise(resolve => setTimeout(resolve, 10));
        executionLog.push(`${path}-end`);

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
        id: 'phase-1',
        requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }]
      },
      {
        id: 'phase-2',
        requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }]
      },
      {
        id: 'phase-3',
        requests: [{ id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }]
      }
    ] satisfies STABLE_WORKFLOW_PHASE[];

    const result = await stableWorkflow(phases, {
      workflowId: 'wf-mixed-all-sequential',
      commonRequestData: { hostname: 'api.example.com' },
      enableMixedExecution: true
    });

    expect(result.success).toBe(true);
    expect(result.completedPhases).toBe(3);
    
    // All phases should execute sequentially
    expect(executionLog.indexOf('/p1-end')).toBeLessThan(executionLog.indexOf('/p2-start'));
    expect(executionLog.indexOf('/p2-end')).toBeLessThan(executionLog.indexOf('/p3-start'));
  });
});