import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import axios from 'axios';
import {
  stableRequest,
  stableFunction,
  stableApiGateway,
  stableWorkflow,
  stableWorkflowGraph
} from '../src/core/index.js';
import { WorkflowGraphBuilder } from '../src/utilities/index.js';
import type { 
  StableBufferTransactionLog,
  STABLE_WORKFLOW_PHASE,
  API_GATEWAY_REQUEST
} from '../src/types/index.js';
import { PHASE_DECISION_ACTIONS, REQUEST_METHODS } from '../src/enums/index.js';

// Mock Axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Transaction Logs Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.request.mockResolvedValue({
      status: 200,
      data: { success: true },
      statusText: 'OK',
      headers: {},
      config: {} as any
    });
  });

  // Sample transaction logs to be returned by loadTransactionLogs hook
  const sampleTransactionLogs: StableBufferTransactionLog[] = [
    {
      transactionId: 'tx-001',
      queuedAt: '2024-01-01T00:00:00Z',
      startedAt: '2024-01-01T00:00:01Z',
      finishedAt: '2024-01-01T00:00:02Z',
      durationMs: 1000,
      queueWaitMs: 1000,
      success: true,
      stateBefore: { key1: 'value1' },
      stateAfter: { key1: 'value1', key2: 'value2' }
    },
    {
      transactionId: 'tx-002',
      queuedAt: '2024-01-01T00:00:03Z',
      startedAt: '2024-01-01T00:00:04Z',
      finishedAt: '2024-01-01T00:00:05Z',
      durationMs: 1000,
      queueWaitMs: 1000,
      success: true,
      stateBefore: { key2: 'value2' },
      stateAfter: { key2: 'updated' }
    }
  ];

  describe('stableRequest', () => {
    it('should load transaction logs and pass them to preExecution hook', async () => {
      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue(sampleTransactionLogs);
      const preExecutionHook = jest.fn().mockReturnValue(undefined);

      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/test'
        },
        resReq: true,
        loadTransactionLogs,
        preExecution: {
          preExecutionHook
        }
      });

      expect(loadTransactionLogs).toHaveBeenCalled();
      expect(preExecutionHook).toHaveBeenCalled();
      
      const preExecutionCallArgs = preExecutionHook.mock.calls[0][0] as any;
      expect(preExecutionCallArgs).toHaveProperty('transactionLogs');
      expect(preExecutionCallArgs.transactionLogs).toEqual(sampleTransactionLogs);
    });

    it('should load transaction logs and pass them to responseAnalyzer hook', async () => {
      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue(sampleTransactionLogs);
      let capturedOptionsFromResponseAnalyzer: any;
      const responseAnalyzer = (options: any) => {
        capturedOptionsFromResponseAnalyzer = options;
        return true;
      };

      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/test'
        },
        resReq: true,
        loadTransactionLogs,
        responseAnalyzer
      });

      expect(capturedOptionsFromResponseAnalyzer).toHaveProperty('transactionLogs');
      expect(capturedOptionsFromResponseAnalyzer.transactionLogs).toEqual(sampleTransactionLogs);
    });

    it('should load transaction logs and pass them to handleSuccessfulAttemptData hook', async () => {
      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue(sampleTransactionLogs);
      const handleSuccessfulAttemptData = jest.fn();

      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/test'
        },
        resReq: true,
        logAllSuccessfulAttempts: true,
        loadTransactionLogs,
        handleSuccessfulAttemptData
      });

      expect(handleSuccessfulAttemptData).toHaveBeenCalled();
      const hookCallArgs = handleSuccessfulAttemptData.mock.calls[0][0] as any;
      expect(hookCallArgs).toHaveProperty('transactionLogs');
      expect(hookCallArgs.transactionLogs).toEqual(sampleTransactionLogs);
    });

    it('should use pre-loaded transactionLogs when provided directly', async () => {
      const preExecutionHook = jest.fn().mockReturnValue(undefined);

      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/test'
        },
        resReq: true,
        transactionLogs: sampleTransactionLogs,
        preExecution: {
          preExecutionHook
        }
      });

      expect(preExecutionHook).toHaveBeenCalled();
      const preExecutionCallArgs = preExecutionHook.mock.calls[0][0] as any;
      expect(preExecutionCallArgs.transactionLogs).toEqual(sampleTransactionLogs);
    });

    it('should prefer loadTransactionLogs hook over pre-loaded transactionLogs', async () => {
      const differentLogs: StableBufferTransactionLog[] = [
        {
          transactionId: 'tx-different',
          queuedAt: '2024-02-01T00:00:00Z',
          startedAt: '2024-02-01T00:00:01Z',
          finishedAt: '2024-02-01T00:00:02Z',
          durationMs: 500,
          queueWaitMs: 500,
          success: true,
          stateBefore: {},
          stateAfter: { different: true }
        }
      ];
      
      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue(differentLogs);
      const preExecutionHook = jest.fn().mockReturnValue(undefined);

      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/test'
        },
        resReq: true,
        transactionLogs: sampleTransactionLogs,
        loadTransactionLogs,
        preExecution: {
          preExecutionHook
        }
      });

      expect(loadTransactionLogs).toHaveBeenCalled();
      const preExecutionCallArgs = preExecutionHook.mock.calls[0][0] as any;
      expect(preExecutionCallArgs.transactionLogs).toEqual(differentLogs);
    });

    it('should load transaction logs and pass them to handleErrors hook on failure', async () => {
      mockedAxios.request.mockRejectedValue({
        response: { status: 500, data: 'Server Error' }
      });

      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue(sampleTransactionLogs);
      const handleErrors = jest.fn();

      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/test'
        },
        resReq: true,
        attempts: 1,
        logAllErrors: true,
        loadTransactionLogs,
        handleErrors
      });

      expect(handleErrors).toHaveBeenCalled();
      const hookCallArgs = handleErrors.mock.calls[0][0] as any;
      expect(hookCallArgs).toHaveProperty('transactionLogs');
      expect(hookCallArgs.transactionLogs).toEqual(sampleTransactionLogs);
    });

    it('should load transaction logs and pass them to finalErrorAnalyzer hook', async () => {
      mockedAxios.request.mockRejectedValue({
        response: { status: 500, data: 'Server Error' }
      });

      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue(sampleTransactionLogs);
      let capturedOptionsFromFinalAnalyzer: any;
      const finalErrorAnalyzer = (options: any) => {
        capturedOptionsFromFinalAnalyzer = options;
        return false;
      };

      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/test'
        },
        resReq: true,
        attempts: 1,
        loadTransactionLogs,
        finalErrorAnalyzer
      });

      expect(capturedOptionsFromFinalAnalyzer).toHaveProperty('transactionLogs');
      expect(capturedOptionsFromFinalAnalyzer.transactionLogs).toEqual(sampleTransactionLogs);
    });
  });

  describe('stableFunction', () => {
    it('should load transaction logs and pass them to preExecution hook', async () => {
      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue(sampleTransactionLogs);
      const preExecutionHook = jest.fn().mockReturnValue(undefined);

      await stableFunction({
        fn: (name: string) => `Hello, ${name}!`,
        args: ['World'],
        returnResult: true,
        loadTransactionLogs,
        preExecution: {
          preExecutionHook
        }
      });

      expect(loadTransactionLogs).toHaveBeenCalled();
      expect(preExecutionHook).toHaveBeenCalled();
      
      const preExecutionCallArgs = preExecutionHook.mock.calls[0][0] as any;
      expect(preExecutionCallArgs).toHaveProperty('transactionLogs');
      expect(preExecutionCallArgs.transactionLogs).toEqual(sampleTransactionLogs);
    });

    it('should load transaction logs and pass them to handleSuccessfulAttemptData hook', async () => {
      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue(sampleTransactionLogs);
      const handleSuccessfulAttemptData = jest.fn();

      await stableFunction({
        fn: (name: string) => `Hello, ${name}!`,
        args: ['World'],
        returnResult: true,
        logAllSuccessfulAttempts: true,
        loadTransactionLogs,
        handleSuccessfulAttemptData
      });

      expect(handleSuccessfulAttemptData).toHaveBeenCalled();
      const hookCallArgs = handleSuccessfulAttemptData.mock.calls[0][0] as any;
      expect(hookCallArgs).toHaveProperty('transactionLogs');
      expect(hookCallArgs.transactionLogs).toEqual(sampleTransactionLogs);
    });

    it('should use pre-loaded transactionLogs when provided directly', async () => {
      const preExecutionHook = jest.fn().mockReturnValue(undefined);

      await stableFunction({
        fn: (name: string) => `Hello, ${name}!`,
        args: ['World'],
        returnResult: true,
        transactionLogs: sampleTransactionLogs,
        preExecution: {
          preExecutionHook
        }
      });

      expect(preExecutionHook).toHaveBeenCalled();
      const preExecutionCallArgs = preExecutionHook.mock.calls[0][0] as any;
      expect(preExecutionCallArgs.transactionLogs).toEqual(sampleTransactionLogs);
    });

    it('should load transaction logs and pass them to handleErrors hook on failure', async () => {
      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue(sampleTransactionLogs);
      const handleErrors = jest.fn();

      await stableFunction({
        fn: () => { throw new Error('Function failed'); },
        args: [],
        returnResult: true,
        attempts: 1,
        logAllErrors: true,
        loadTransactionLogs,
        handleErrors
      });

      expect(handleErrors).toHaveBeenCalled();
      const hookCallArgs = handleErrors.mock.calls[0][0] as any;
      expect(hookCallArgs).toHaveProperty('transactionLogs');
      expect(hookCallArgs.transactionLogs).toEqual(sampleTransactionLogs);
    });
  });

  describe('stableApiGateway', () => {
    it('should load transaction logs and pass them to requests', async () => {
      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue(sampleTransactionLogs);
      const preExecutionHook = jest.fn().mockReturnValue(undefined);

      const requests: API_GATEWAY_REQUEST[] = [
        {
          id: 'req1',
          requestOptions: {
            reqData: { hostname: 'api.example.com', path: '/test1' },
            resReq: true,
            preExecution: { preExecutionHook }
          }
        },
        {
          id: 'req2',
          requestOptions: {
            reqData: { hostname: 'api.example.com', path: '/test2' },
            resReq: true,
            preExecution: { preExecutionHook }
          }
        }
      ];

      await stableApiGateway(requests, {
        loadTransactionLogs
      });

      expect(loadTransactionLogs).toHaveBeenCalled();
      expect(preExecutionHook).toHaveBeenCalledTimes(2);
      
      // Both requests should receive the transaction logs
      preExecutionHook.mock.calls.forEach((call: any) => {
        expect(call[0]).toHaveProperty('transactionLogs');
        expect(call[0].transactionLogs).toEqual(sampleTransactionLogs);
      });
    });

    it('should load transaction logs and pass them to functions', async () => {
      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue(sampleTransactionLogs);
      const preExecutionHook = jest.fn().mockReturnValue(undefined);

      const requests: API_GATEWAY_REQUEST[] = [];

      await stableApiGateway(requests, [
        {
          id: 'fn1',
          functionOptions: {
            fn: () => 'result1',
            args: [],
            returnResult: true,
            preExecution: { preExecutionHook }
          }
        },
        {
          id: 'fn2',
          functionOptions: {
            fn: () => 'result2',
            args: [],
            returnResult: true,
            preExecution: { preExecutionHook }
          }
        }
      ], {
        loadTransactionLogs
      });

      expect(loadTransactionLogs).toHaveBeenCalled();
      expect(preExecutionHook).toHaveBeenCalledTimes(2);
      
      preExecutionHook.mock.calls.forEach((call: any) => {
        expect(call[0]).toHaveProperty('transactionLogs');
        expect(call[0].transactionLogs).toEqual(sampleTransactionLogs);
      });
    });

    it('should use pre-loaded transactionLogs when provided', async () => {
      const preExecutionHook = jest.fn().mockReturnValue(undefined);

      const requests: API_GATEWAY_REQUEST[] = [
        {
          id: 'req1',
          requestOptions: {
            reqData: { hostname: 'api.example.com', path: '/test' },
            resReq: true,
            preExecution: { preExecutionHook }
          }
        }
      ];

      await stableApiGateway(requests, {
        transactionLogs: sampleTransactionLogs
      });

      expect(preExecutionHook).toHaveBeenCalled();
      const preExecutionCallArgs = preExecutionHook.mock.calls[0][0] as any;
      expect(preExecutionCallArgs.transactionLogs).toEqual(sampleTransactionLogs);
    });
  });

  describe('stableWorkflow', () => {
    it('should load transaction logs and pass them to handlePhaseCompletion hook', async () => {
      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue(sampleTransactionLogs);
      const handlePhaseCompletion = jest.fn();

      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'phase-1',
          requests: [
            {
              id: 'req1',
              requestOptions: {
                reqData: { hostname: 'api.example.com', path: '/test' },
                resReq: true
              }
            }
          ]
        }
      ];

      await stableWorkflow(phases, {
        workflowId: 'test-workflow',
        loadTransactionLogs,
        handlePhaseCompletion
      });

      expect(loadTransactionLogs).toHaveBeenCalled();
      expect(handlePhaseCompletion).toHaveBeenCalled();
      
      const hookCallArgs = handlePhaseCompletion.mock.calls[0][0] as any;
      expect(hookCallArgs).toHaveProperty('transactionLogs');
      expect(hookCallArgs.transactionLogs).toEqual(sampleTransactionLogs);
    });

    it('should load transaction logs and pass them to prePhaseExecutionHook', async () => {
      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue(sampleTransactionLogs);
      let capturedTransactionLogsFromPhaseHook: StableBufferTransactionLog[] | undefined;
      const prePhaseExecutionHook = (options: any) => {
        capturedTransactionLogsFromPhaseHook = options.transactionLogs;
        return options.phase;
      };

      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'phase-1',
          requests: [
            {
              id: 'req1',
              requestOptions: {
                reqData: { hostname: 'api.example.com', path: '/test' },
                resReq: true
              }
            }
          ]
        }
      ];

      await stableWorkflow(phases, {
        workflowId: 'test-workflow',
        loadTransactionLogs,
        prePhaseExecutionHook
      });

      expect(loadTransactionLogs).toHaveBeenCalled();
      expect(capturedTransactionLogsFromPhaseHook).toEqual(sampleTransactionLogs);
    });

    it('should use pre-loaded transactionLogs when provided', async () => {
      const handlePhaseCompletion = jest.fn();

      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'phase-1',
          requests: [
            {
              id: 'req1',
              requestOptions: {
                reqData: { hostname: 'api.example.com', path: '/test' },
                resReq: true
              }
            }
          ]
        }
      ];

      await stableWorkflow(phases, {
        workflowId: 'test-workflow',
        transactionLogs: sampleTransactionLogs,
        handlePhaseCompletion
      });

      expect(handlePhaseCompletion).toHaveBeenCalled();
      const hookCallArgs = handlePhaseCompletion.mock.calls[0][0] as any;
      expect(hookCallArgs.transactionLogs).toEqual(sampleTransactionLogs);
    });

    it('should load transaction logs and pass them to phaseDecisionHook in non-linear workflow', async () => {
      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue(sampleTransactionLogs);
      let capturedTransactionLogs: StableBufferTransactionLog[] | undefined;

      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'phase-1',
          requests: [
            {
              id: 'req1',
              requestOptions: {
                reqData: { hostname: 'api.example.com', path: '/test' },
                resReq: true
              }
            }
          ],
          phaseDecisionHook: (options: any) => {
            capturedTransactionLogs = options.transactionLogs;
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        }
      ];

      await stableWorkflow(phases, {
        workflowId: 'test-workflow',
        enableNonLinearExecution: true,
        loadTransactionLogs
      });

      expect(loadTransactionLogs).toHaveBeenCalled();
      expect(capturedTransactionLogs).toEqual(sampleTransactionLogs);
    });
  });

  describe('stableWorkflowGraph', () => {
    it('should load transaction logs and pass them to phase handlers', async () => {
      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue(sampleTransactionLogs);
      let capturedTransactionLogsFromGraph: StableBufferTransactionLog[] | undefined;

      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'api.example.com',
                path: '/test',
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              preExecution: {
                preExecutionHook: (options: any) => {
                  capturedTransactionLogsFromGraph = options.transactionLogs;
                  return undefined;
                }
              }
            }
          }]
        })
        .setEntryPoint('phase-1')
        .build();

      await stableWorkflowGraph(graph, {
        workflowId: 'test-graph',
        loadTransactionLogs
      });

      expect(loadTransactionLogs).toHaveBeenCalled();
      expect(capturedTransactionLogsFromGraph).toEqual(sampleTransactionLogs);
    });

    it('should use pre-loaded transactionLogs when provided', async () => {
      let capturedTransactionLogsFromGraph2: StableBufferTransactionLog[] | undefined;

      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'api.example.com',
                path: '/test',
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              preExecution: {
                preExecutionHook: (options: any) => {
                  capturedTransactionLogsFromGraph2 = options.transactionLogs;
                  return undefined;
                }
              }
            }
          }]
        })
        .setEntryPoint('phase-1')
        .build();

      await stableWorkflowGraph(graph, {
        workflowId: 'test-graph',
        transactionLogs: sampleTransactionLogs
      });

      expect(capturedTransactionLogsFromGraph2).toEqual(sampleTransactionLogs);
    });
  });

  describe('Transaction Logs Loading Edge Cases', () => {
    it('should handle empty transaction logs array', async () => {
      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockResolvedValue([]);
      const preExecutionHook = jest.fn().mockReturnValue(undefined);

      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/test'
        },
        resReq: true,
        loadTransactionLogs,
        preExecution: {
          preExecutionHook
        }
      });

      const preExecutionCallArgs = preExecutionHook.mock.calls[0][0] as any;
      expect(preExecutionCallArgs.transactionLogs).toEqual([]);
    });

    it('should handle synchronous loadTransactionLogs function', async () => {
      const loadTransactionLogs = jest.fn<() => StableBufferTransactionLog[]>()
        .mockReturnValue(sampleTransactionLogs);
      const preExecutionHook = jest.fn().mockReturnValue(undefined);

      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/test'
        },
        resReq: true,
        loadTransactionLogs,
        preExecution: {
          preExecutionHook
        }
      });

      expect(preExecutionHook).toHaveBeenCalled();
      const preExecutionCallArgs = preExecutionHook.mock.calls[0][0] as any;
      expect(preExecutionCallArgs.transactionLogs).toEqual(sampleTransactionLogs);
    });

    it('should not fail when no loadTransactionLogs or transactionLogs is provided', async () => {
      const preExecutionHook = jest.fn().mockReturnValue(undefined);

      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/test'
        },
        resReq: true,
        preExecution: {
          preExecutionHook
        }
      });

      expect(preExecutionHook).toHaveBeenCalled();
      // transactionLogs should be undefined when not provided
      const preExecutionCallArgs = preExecutionHook.mock.calls[0][0] as any;
      expect(preExecutionCallArgs.transactionLogs).toBeUndefined();
    });

    it('should handle loadTransactionLogs errors gracefully', async () => {
      const loadTransactionLogs = jest.fn<() => Promise<StableBufferTransactionLog[]>>()
        .mockRejectedValue(new Error('Failed to load logs'));
      const preExecutionHook = jest.fn().mockReturnValue(undefined);

      // Should not throw, should handle gracefully
      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/test'
        },
        resReq: true,
        loadTransactionLogs,
        preExecution: {
          preExecutionHook
        }
      });

      // Hook should still be called even if log loading fails
      expect(preExecutionHook).toHaveBeenCalled();
      // Transaction logs should be empty or undefined on failure
      const preExecutionCallArgs = preExecutionHook.mock.calls[0][0] as any;
      expect(preExecutionCallArgs.transactionLogs ?? []).toEqual([]);
    });
  });

  describe('StableScheduler', () => {
    it('should pass job context to loadTransactionLogs hook', async () => {
      const { StableScheduler, ScheduleTypes } = await import('../src/index.js');
      type TestJob = { id: string; name: string; schedule?: any };

      const sampleLogs: StableBufferTransactionLog[] = [
        {
          transactionId: 'tx-scheduler-001',
          queuedAt: '2024-01-01T00:00:00Z',
          startedAt: '2024-01-01T00:00:01Z',
          finishedAt: '2024-01-01T00:00:02Z',
          durationMs: 1000,
          queueWaitMs: 1000,
          success: true,
          stateBefore: {},
          stateAfter: { processed: true }
        }
      ];

      let capturedContext: any;
      let loadTransactionLogsCalled = false;
      const scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 1,
          tickIntervalMs: 50,
          loadTransactionLogs: async (context) => {
            loadTransactionLogsCalled = true;
            capturedContext = context;
            return sampleLogs;
          }
        },
        async (job, context) => {
          // Job handler receives transaction logs
          expect(context.transactionLogs).toBeDefined();
          expect(context.transactionLogs).toHaveLength(1);
        }
      );

      const testSchedule = { type: ScheduleTypes.TIMESTAMP, at: Date.now() };
      scheduler.addJob({ id: 'job-1', name: 'Test Job', schedule: testSchedule });
      scheduler.start();

      await new Promise(resolve => setTimeout(resolve, 200));
      scheduler.stop();

      expect(loadTransactionLogsCalled).toBe(true);
      expect(capturedContext).toBeDefined();
      expect(capturedContext.jobId).toBe('job-1');
      expect(capturedContext.scheduledAt).toBeDefined();
      expect(capturedContext.schedule).toBeDefined();
      expect(capturedContext.schedule.type).toBe(ScheduleTypes.TIMESTAMP);
    });

    it('should pass correct job-specific context when multiple jobs are scheduled', async () => {
      const { StableScheduler, ScheduleTypes } = await import('../src/index.js');
      type TestJob = { id: string; name: string; schedule?: any };

      const capturedContexts: any[] = [];
      const scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 2,
          tickIntervalMs: 50,
          loadTransactionLogs: async (context) => {
            capturedContexts.push({ ...context });
            return [];
          }
        },
        async () => {}
      );

      scheduler.addJob({ 
        id: 'job-alpha', 
        name: 'Alpha Job', 
        schedule: { type: ScheduleTypes.TIMESTAMP, at: Date.now() } 
      });
      scheduler.addJob({ 
        id: 'job-beta', 
        name: 'Beta Job', 
        schedule: { type: ScheduleTypes.TIMESTAMP, at: Date.now() } 
      });
      scheduler.start();

      await new Promise(resolve => setTimeout(resolve, 300));
      scheduler.stop();

      expect(capturedContexts.length).toBeGreaterThanOrEqual(2);
      const jobIds = capturedContexts.map(c => c.jobId);
      expect(jobIds).toContain('job-alpha');
      expect(jobIds).toContain('job-beta');
    });

    it('should handle loadTransactionLogs errors gracefully in scheduler', async () => {
      const { StableScheduler, ScheduleTypes } = await import('../src/index.js');
      type TestJob = { id: string; name: string; schedule?: any };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      let handlerCalled = false;
      const scheduler = new StableScheduler<TestJob>(
        {
          maxParallel: 1,
          tickIntervalMs: 50,
          loadTransactionLogs: async () => {
            throw new Error('Failed to load');
          }
        },
        async (job, context) => {
          handlerCalled = true;
          // Handler should still execute even if logs loading fails
          expect(context.transactionLogs).toBeUndefined();
        }
      );

      scheduler.addJob({ 
        id: 'job-error', 
        name: 'Error Test Job', 
        schedule: { type: ScheduleTypes.TIMESTAMP, at: Date.now() } 
      });
      scheduler.start();

      await new Promise(resolve => setTimeout(resolve, 200));
      scheduler.stop();

      expect(handlerCalled).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load transaction logs'));
      consoleSpy.mockRestore();
    });
  });
});
