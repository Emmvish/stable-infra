import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosRequestConfig } from 'axios';
import { stableWorkflow } from '../src/core/index.js';
import { PHASE_DECISION_ACTIONS } from '../src/enums/index.js';
import { 
  STABLE_WORKFLOW_PHASE, 
  PhaseExecutionDecision,
  PhaseDecisionHookOptions 
} from '../src/types/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Non-Linear Workflow Execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Phase Decision Actions', () => {
    it('should continue to next sequential phase when decision is "continue"', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
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
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({ action: PHASE_DECISION_ACTIONS.CONTINUE })
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        },
        {
          id: 'phase-3',
          requests: [
            { id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-continue',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(3);
      expect(executionOrder).toEqual(['/p1', '/p2', '/p3']);
      expect(result.executionHistory).toHaveLength(3);
    });

    it('should jump to target phase when decision is "jump"', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
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
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({
            action: PHASE_DECISION_ACTIONS.JUMP,
            targetPhaseId: 'phase-3'
          })
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        },
        {
          id: 'phase-3',
          requests: [
            { id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-jump',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(2); // Only phase-1 and phase-3 executed
      expect(executionOrder).toEqual(['/p1', '/p3']); // phase-2 was skipped
      expect(result.executionHistory).toHaveLength(2);
    });

    it('should replay current phase when decision is "replay"', async () => {
      let executionCount = 0;
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
          return {
            status: 200,
            data: { count: ++executionCount },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const phases = [
        {
          id: 'phase-1',
          allowReplay: true,
          maxReplayCount: 2,
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ phaseResult }: PhaseDecisionHookOptions) => {
            const count = phaseResult.responses[0]?.data?.count || 0;
            if (count < 3) {
              return { action: PHASE_DECISION_ACTIONS.REPLAY };
            }
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-replay',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(4); // phase-1 executed 3 times, phase-2 once
      expect(executionOrder).toEqual(['/p1', '/p1', '/p1', '/p2']);
      expect(result.executionHistory).toHaveLength(4);
      
      // Verify execution numbers
      const phase1Executions = result.phases.filter(p => p.phaseId === 'phase-1');
      expect(phase1Executions).toHaveLength(3);
      expect(phase1Executions[0].executionNumber).toBe(1);
      expect(phase1Executions[1].executionNumber).toBe(2);
      expect(phase1Executions[2].executionNumber).toBe(3);
    });

    it('should skip phases when decision is "skip"', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
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
          allowSkip: true,
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({
            action: PHASE_DECISION_ACTIONS.SKIP,
            targetPhaseId: 'phase-4'
          })
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        },
        {
          id: 'phase-3',
          requests: [
            { id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }
          ]
        },
        {
          id: 'phase-4',
          requests: [
            { id: 'r4', requestOptions: { reqData: { path: '/p4' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-skip',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(2); // Only phase-1 and phase-4
      expect(executionOrder).toEqual(['/p1', '/p4']);
    });

    it('should terminate workflow when decision is "terminate"', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
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
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ]
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({
            action: PHASE_DECISION_ACTIONS.TERMINATE,
            metadata: { reason: 'Business logic condition met' }
          })
        },
        {
          id: 'phase-3',
          requests: [
            { id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-terminate',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(2); // Only phase-1 and phase-2
      expect(result.terminatedEarly).toBe(true);
      expect(result.terminationReason).toBe('Business logic condition met');
      expect(executionOrder).toEqual(['/p1', '/p2']);
    });
  });

  describe('Conditional Branching', () => {
    it('should execute different branches based on response data', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
          if (path === '/check-status') {
            return {
              status: 200,
              data: { userType: 'premium' },
              statusText: 'OK',
              headers: {},
              config: config as any
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
          id: 'check-user',
          requests: [
            { id: 'check', requestOptions: { reqData: { path: '/check-status' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ phaseResult, sharedBuffer }: PhaseDecisionHookOptions) => {
            const userType = phaseResult.responses[0]?.data?.userType;
            sharedBuffer!.userType = userType;
            
            if (userType === 'premium') {
              return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'premium-flow' };
            } else if (userType === 'trial') {
              return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'trial-flow' };
            } else {
              return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'free-flow' };
            }
          }
        },
        {
          id: 'premium-flow',
          requests: [
            { id: 'premium', requestOptions: { reqData: { path: '/premium-data' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({
            action: PHASE_DECISION_ACTIONS.JUMP,
            targetPhaseId: 'finalize'
          })
        },
        {
          id: 'trial-flow',
          requests: [
            { id: 'trial', requestOptions: { reqData: { path: '/trial-data' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({
            action: PHASE_DECISION_ACTIONS.JUMP,
            targetPhaseId: 'finalize'
          })
        },
        {
          id: 'free-flow',
          requests: [
            { id: 'free', requestOptions: { reqData: { path: '/free-data' }, resReq: true } }
          ]
        },
        {
          id: 'finalize',
          requests: [
            { id: 'final', requestOptions: { reqData: { path: '/finalize' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const sharedBuffer = {};
      const result = await stableWorkflow(phases, {
        workflowId: 'wf-branching',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true,
        sharedBuffer
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(3); // check-user, premium-flow, finalize
      expect(executionOrder).toEqual(['/check-status', '/premium-data', '/finalize']);
      expect(sharedBuffer).toEqual({ userType: 'premium' });
    });

    it('should handle complex decision logic with multiple conditions', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          requestCount++;
          
          if (path === '/validate') {
            return {
              status: 200,
              data: { valid: requestCount >= 3, attempt: requestCount },
              statusText: 'OK',
              headers: {},
              config: config as any
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
          id: 'validate',
          allowReplay: true,
          maxReplayCount: 5,
          requests: [
            { id: 'val', requestOptions: { reqData: { path: '/validate' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ phaseResult, executionHistory }: PhaseDecisionHookOptions) => {
            const isValid = phaseResult.responses[0]?.data?.valid;
            const attempts = executionHistory.filter(h => h.phaseId === 'validate').length;
            
            if (!isValid && attempts < 5) {
              return { action: PHASE_DECISION_ACTIONS.REPLAY };
            } else if (!isValid && attempts >= 5) {
              return {
                action: PHASE_DECISION_ACTIONS.JUMP,
                targetPhaseId: 'error-handling',
                metadata: { reason: 'Max validation attempts exceeded' }
              };
            }
            
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'process',
          requests: [
            { id: 'proc', requestOptions: { reqData: { path: '/process' }, resReq: true } }
          ]
        },
        {
          id: 'error-handling',
          requests: [
            { id: 'err', requestOptions: { reqData: { path: '/error' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-complex-decision',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(5); // validate (3x), process, error-handling
      expect(requestCount).toBe(5); // 3 validation attempts, 1 process, 1 error
    });
  });

  describe('Replay Behavior', () => {
    it('should respect maxReplayCount limit', async () => {
      let replayCount = 0;

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { ok: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      const phases = [
        {
          id: 'phase-1',
          allowReplay: true,
          maxReplayCount: 3,
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async () => {
            replayCount++;
            return { action: PHASE_DECISION_ACTIONS.REPLAY }; // Try to replay indefinitely
          }
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-max-replay',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(6); // 4 phase-1 executions (1 + 3 replays) + 1 skipped + phase-2
      
      // Find the skipped phase result
      const skippedPhase = result.phases.find(p => p.skipped);
      expect(skippedPhase).toBeDefined();
      expect(skippedPhase?.phaseId).toBe('phase-1');
      expect(skippedPhase?.error).toContain('Exceeded max replay count');
    });

    it('should not allow replay when allowReplay is false', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
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
          allowReplay: false,
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({
            action: PHASE_DECISION_ACTIONS.REPLAY
          })
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-no-replay',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(2);
      expect(executionOrder).toEqual(['/p1', '/p2']); // No replay, continued normally
    });

    it('should track execution numbers correctly across replays', async () => {
      let executions = 0;

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { ok: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      const phases = [
        {
          id: 'replay-phase',
          allowReplay: true,
          maxReplayCount: 2,
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async () => {
            executions++;
            if (executions < 3) {
              return { action: PHASE_DECISION_ACTIONS.REPLAY };
            }
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-track-executions',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(3);
      
      const replayPhaseResults = result.phases.filter(p => p.phaseId === 'replay-phase');
      expect(replayPhaseResults[0].executionNumber).toBe(1);
      expect(replayPhaseResults[1].executionNumber).toBe(2);
      expect(replayPhaseResults[2].executionNumber).toBe(3);
    });
  });

  describe('Skip Behavior', () => {
    it('should not allow skip when allowSkip is false', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
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
          allowSkip: false,
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({
            action: PHASE_DECISION_ACTIONS.SKIP
          })
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-no-skip',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(2);
      expect(executionOrder).toEqual(['/p1', '/p2']); // Did not skip, continued normally
    });

    it('should skip without targetPhaseId (skip next phase)', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
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
          allowSkip: true,
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({
            action: PHASE_DECISION_ACTIONS.SKIP // No targetPhaseId
          })
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        },
        {
          id: 'phase-3',
          requests: [
            { id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-skip-next',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(2);
      expect(executionOrder).toEqual(['/p1', '/p3']); // Skipped phase-2
    });
  });

  describe('Execution History', () => {
    it('should maintain complete execution history with decisions', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { ok: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      const phases = [
        {
          id: 'phase-1',
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({
            action: PHASE_DECISION_ACTIONS.JUMP,
            targetPhaseId: 'phase-3'
          })
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        },
        {
          id: 'phase-3',
          allowReplay: true,
          maxReplayCount: 1,
          requests: [
            { id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ executionHistory }: PhaseDecisionHookOptions) => {
            const phase3Executions = executionHistory.filter(h => h.phaseId === 'phase-3').length;
            if (phase3Executions < 2) {
              return { action: PHASE_DECISION_ACTIONS.REPLAY };
            }
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-history',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.executionHistory).toHaveLength(3);
      
      expect(result.executionHistory[0]).toMatchObject({
        phaseId: 'phase-1',
        phaseIndex: 0,
        executionNumber: 1,
        success: true,
        decision: { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'phase-3' }
      });
      
      expect(result.executionHistory[1]).toMatchObject({
        phaseId: 'phase-3',
        phaseIndex: 2,
        executionNumber: 1,
        success: true,
        decision: { action: PHASE_DECISION_ACTIONS.REPLAY }
      });
      
      expect(result.executionHistory[2]).toMatchObject({
        phaseId: 'phase-3',
        phaseIndex: 2,
        executionNumber: 2,
        success: true,
        decision: { action: PHASE_DECISION_ACTIONS.REPLAY }
      });
    });

    it('should provide execution history to phase decision hooks', async () => {
      const historySnapshots: any[] = [];

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { ok: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      const phases = [
        {
          id: 'phase-1',
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ executionHistory }: PhaseDecisionHookOptions) => {
            historySnapshots.push([...executionHistory]);
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ executionHistory }: PhaseDecisionHookOptions) => {
            historySnapshots.push([...executionHistory]);
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      await stableWorkflow(phases, {
        workflowId: 'wf-history-access',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(historySnapshots).toHaveLength(2);
      expect(historySnapshots[0]).toHaveLength(0); // First phase has no history yet
      expect(historySnapshots[1]).toHaveLength(1); // Second phase sees first phase's history
      expect(historySnapshots[1][0].phaseId).toBe('phase-1');
    });
  });

  describe('Shared Buffer Integration', () => {
    it('should pass shared buffer to phase decision hooks', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { value: 42 },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      const sharedBuffer: Record<string, any> = { counter: 0 };

      const phases = [
        {
          id: 'phase-1',
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ sharedBuffer: sb, phaseResult }: PhaseDecisionHookOptions) => {
            sb!.phase1Data = phaseResult.responses[0]?.data;
            sb!.counter++;
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ sharedBuffer: sb }: PhaseDecisionHookOptions) => {
            expect(sb!.phase1Data).toEqual({ value: 42 });
            expect(sb!.counter).toBe(1);
            sb!.counter++;
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-shared-buffer',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true,
        sharedBuffer
      });

      expect(result.success).toBe(true);
      expect(sharedBuffer).toMatchObject({
        counter: 2,
        phase1Data: { value: 42 }
      });
    });

    it('should maintain shared buffer across replays', async () => {
      let replayCount = 0;

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { ok: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      const sharedBuffer: Record<string, any> = { attempts: [] };

      const phases = [
        {
          id: 'phase-1',
          allowReplay: true,
          maxReplayCount: 2,
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ sharedBuffer: sb }: PhaseDecisionHookOptions) => {
            replayCount++;
            sb!.attempts.push(replayCount);
            
            if (replayCount < 3) {
              return { action: PHASE_DECISION_ACTIONS.REPLAY };
            }
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      await stableWorkflow(phases, {
        workflowId: 'wf-buffer-replay',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true,
        sharedBuffer
      });

      expect(sharedBuffer.attempts).toEqual([1, 2, 3]);
    });
  });

  describe('Error Handling', () => {
    it('should handle phase execution errors in non-linear flow', async () => {
      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          
          if (path === '/p2') {
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
          id: 'phase-1',
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({
            action: PHASE_DECISION_ACTIONS.CONTINUE
          })
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true, attempts: 1 } }
          ]
        },
        {
          id: 'phase-3',
          requests: [
            { id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-error-handling',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true,
        stopOnFirstPhaseError: false
      });

      expect(result.success).toBe(false);
      expect(result.completedPhases).toBe(3);
      expect(result.failedRequests).toBe(1);
      
      const phase2Result = result.phases.find(p => p.phaseId === 'phase-2');
      expect(phase2Result?.success).toBe(false);
    });

    it('should stop workflow on phase error when stopOnFirstPhaseError is true', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
          if (path === '/p2') {
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
          id: 'phase-1',
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ]
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true, attempts: 1 } }
          ]
        },
        {
          id: 'phase-3',
          requests: [
            { id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-stop-on-error',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true,
        stopOnFirstPhaseError: true
      });

      expect(result.success).toBe(false);
      expect(result.completedPhases).toBe(2);
      expect(result.terminatedEarly).toBe(true);
      expect(result.terminationReason).toContain("phase-2");
      expect(executionOrder).toEqual(['/p1', '/p2']);
    });

    it('should handle decision hook errors gracefully', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
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
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async () => {
            throw new Error('Decision hook error');
          }
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-hook-error',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      // Should continue with default 'continue' action when hook fails
      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(2);
      expect(executionOrder).toEqual(['/p1', '/p2']);
    });
  });

  describe('Loop Detection and Prevention', () => {
    it('should prevent infinite loops with maxWorkflowIterations', async () => {
      let executionCount = 0;

      mockedAxios.request.mockImplementation(
        (async () => {
          executionCount++;
          return {
            status: 200,
            data: { count: executionCount },
            statusText: 'OK',
            headers: {},
            config: {} as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const phases = [
        {
          id: 'infinite-loop',
          allowReplay: true,
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({
            action: PHASE_DECISION_ACTIONS.REPLAY // Always replay
          })
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-infinite-loop',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true,
        maxWorkflowIterations: 10
      });

      expect(result.terminatedEarly).toBe(true);
      expect(result.terminationReason).toContain('Exceeded maximum workflow iterations');
      expect(executionCount).toBeLessThanOrEqual(10);
    });

    it('should allow configurable maxWorkflowIterations', async () => {
      let executionCount = 0;

      mockedAxios.request.mockImplementation(
        (async () => {
          executionCount++;
          return {
            status: 200,
            data: { count: executionCount },
            statusText: 'OK',
            headers: {},
            config: {} as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const phases = [
        {
          id: 'counting-phase',
          allowReplay: true,
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ phaseResult }: PhaseDecisionHookOptions) => {
            const count = phaseResult.responses[0]?.data?.count;
            if (count < 25) {
              return { action: PHASE_DECISION_ACTIONS.REPLAY };
            }
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-custom-max',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true,
        maxWorkflowIterations: 50
      });

      expect(result.success).toBe(true);
      expect(result.terminatedEarly).toBe(false);
      expect(executionCount).toBe(25);
    });
  });

  describe('Phase Not Found', () => {
    it('should terminate workflow if target phase does not exist', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
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
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({
            action: PHASE_DECISION_ACTIONS.JUMP,
            targetPhaseId: 'non-existent-phase'
          })
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-phase-not-found',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.terminatedEarly).toBe(true);
      expect(result.terminationReason).toContain('non-existent-phase');
      expect(executionOrder).toEqual(['/p1']);
    });
  });

  describe('Observability Hooks', () => {
    it('should call handlePhaseDecision hook for each decision', async () => {
      const handlePhaseDecision = jest.fn();
      const decisions: PhaseExecutionDecision[] = [];

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { ok: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      handlePhaseDecision.mockImplementation((decision: any) => {
        decisions.push(decision);
      });

      const phases = [
        {
          id: 'phase-1',
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({
            action: PHASE_DECISION_ACTIONS.JUMP,
            targetPhaseId: 'phase-3'
          })
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        },
        {
          id: 'phase-3',
          requests: [
            { id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({
            action: PHASE_DECISION_ACTIONS.TERMINATE,
            metadata: { reason: 'Done' }
          })
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      await stableWorkflow(phases, {
        workflowId: 'wf-decision-hook',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true,
        handlePhaseDecision
      });

      expect(handlePhaseDecision).toHaveBeenCalledTimes(2);
      expect(decisions[0]).toMatchObject({
        action: PHASE_DECISION_ACTIONS.JUMP,
        targetPhaseId: 'phase-3'
      });
      expect(decisions[1]).toMatchObject({
        action: PHASE_DECISION_ACTIONS.TERMINATE,
        metadata: { reason: 'Done' }
      });
    });

    it('should call handlePhaseCompletion for all executed phases', async () => {
      const handlePhaseCompletion = jest.fn();
      const completedPhases: string[] = [];

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { ok: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      handlePhaseCompletion.mockImplementation((options: any) => {
        completedPhases.push(options.phaseResult.phaseId);
      });

      const phases = [
        {
          id: 'phase-1',
          allowReplay: true,
          maxReplayCount: 1,
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ executionHistory }: PhaseDecisionHookOptions) => {
            const p1Executions = executionHistory.filter(h => h.phaseId === 'phase-1').length;
            if (p1Executions < 2) {
              return { action: PHASE_DECISION_ACTIONS.REPLAY };
            }
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      await stableWorkflow(phases, {
        workflowId: 'wf-completion-hook',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true,
        handlePhaseCompletion
      });

      expect(handlePhaseCompletion).toHaveBeenCalledTimes(3);
      expect(completedPhases).toEqual(['phase-1', 'phase-1', 'phase-2']);
    });

    it('should call handlePhaseError when phase execution throws', async () => {
      const handlePhaseError = jest.fn();

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          
          if (path === '/p2') {
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
          id: 'phase-1',
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ]
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true, attempts: 1 } }
          ]
        },
        {
          id: 'phase-3',
          requests: [
            { id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      await stableWorkflow(phases, {
        workflowId: 'wf-error-hook',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true,
        stopOnFirstPhaseError: false,
        handlePhaseError
      });

      // In non-linear execution, phase errors are not propagated to handlePhaseError
      // unless the entire phase execution throws (not just request failures)
      expect(handlePhaseError).toHaveBeenCalledTimes(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle polling with conditional termination', async () => {
      let pollCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          pollCount++;
          
          if (path === '/check-status') {
            const status = pollCount < 3 ? 'pending' : pollCount === 3 ? 'completed' : 'unknown';
            return {
              status: 200,
              data: { status, pollCount },
              statusText: 'OK',
              headers: {},
              config: config as any
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
          id: 'poll-status',
          allowReplay: true,
          maxReplayCount: 10,
          requests: [
            { id: 'poll', requestOptions: { reqData: { path: '/check-status' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ phaseResult }: PhaseDecisionHookOptions) => {
            const status = phaseResult.responses[0]?.data?.status;
            
            if (status === 'completed') {
              return { action: PHASE_DECISION_ACTIONS.CONTINUE };
            } else if (status === 'failed') {
              return {
                action: PHASE_DECISION_ACTIONS.JUMP,
                targetPhaseId: 'error-handler'
              };
            } else {
              // Still pending
              await new Promise(resolve => setTimeout(resolve, 50));
              return { action: PHASE_DECISION_ACTIONS.REPLAY };
            }
          }
        },
        {
          id: 'process-results',
          requests: [
            { id: 'process', requestOptions: { reqData: { path: '/process' }, resReq: true } }
          ]
        },
        {
          id: 'error-handler',
          requests: [
            { id: 'error', requestOptions: { reqData: { path: '/error' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-polling',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(5); // 3 polls + process-results + error-handler
      expect(pollCount).toBe(5); // 3 status checks + process + error
      
      const pollPhases = result.phases.filter(p => p.phaseId === 'poll-status');
      expect(pollPhases).toHaveLength(3);
    });

    it('should support multi-level branching', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
          if (path === '/check-user') {
            return {
              status: 200,
              data: { type: 'premium', country: 'US' },
              statusText: 'OK',
              headers: {},
              config: config as any
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
          id: 'check-user',
          requests: [
            { id: 'check', requestOptions: { reqData: { path: '/check-user' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ phaseResult, sharedBuffer }: PhaseDecisionHookOptions) => {
            const data = phaseResult.responses[0]?.data;
            sharedBuffer!.userData = data;
            
            if (data.type === 'premium') {
              return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'check-region' };
            } else {
              return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'free-flow' };
            }
          }
        },
        {
          id: 'check-region',
          requests: [
            { id: 'region', requestOptions: { reqData: { path: '/check-region' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ sharedBuffer }: PhaseDecisionHookOptions) => {
            const country = sharedBuffer!.userData.country;
            
            if (country === 'US') {
              return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'premium-us' };
            } else {
              return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'premium-intl' };
            }
          }
        },
        {
          id: 'premium-us',
          requests: [
            { id: 'pus', requestOptions: { reqData: { path: '/premium-us' }, resReq: true } }
          ]
        },
        {
          id: 'premium-intl',
          requests: [
            { id: 'pintl', requestOptions: { reqData: { path: '/premium-intl' }, resReq: true } }
          ]
        },
        {
          id: 'free-flow',
          requests: [
            { id: 'free', requestOptions: { reqData: { path: '/free' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const sharedBuffer = {};
      const result = await stableWorkflow(phases, {
        workflowId: 'wf-multi-branch',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true,
        sharedBuffer
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(5); // All 5 phases execute
      // After jumping to premium-us, it continues sequentially to premium-intl and free-flow
      expect(executionOrder).toEqual(['/check-user', '/check-region', '/premium-us', '/premium-intl', '/free']);
    });
  });

  describe('Mixed Serial and Parallel Execution', () => {
    it('should execute parallel phases and make decisions based on combined results', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
          return {
            status: 200,
            data: { path, value: path === '/check1' ? 10 : path === '/check2' ? 20 : 0 },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const phases = [
        {
          id: 'initial',
          requests: [
            { id: 'init', requestOptions: { reqData: { path: '/init' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({ action: PHASE_DECISION_ACTIONS.CONTINUE })
        },
        {
          id: 'parallel-check-1',
          markConcurrentPhase: true,
          requests: [
            { id: 'check1', requestOptions: { reqData: { path: '/check1' }, resReq: true } }
          ]
        },
        {
          id: 'parallel-check-2',
          markConcurrentPhase: true,
          requests: [
            { id: 'check2', requestOptions: { reqData: { path: '/check2' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ concurrentPhaseResults }: PhaseDecisionHookOptions) => {
            // Decision based on combined parallel results
            const total = concurrentPhaseResults!.reduce(
              (sum, result) => sum + (result.responses[0]?.data?.value || 0),
              0
            );
            
            if (total > 25) {
              return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'high-value' };
            }
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'normal-flow',
          requests: [
            { id: 'normal', requestOptions: { reqData: { path: '/normal' }, resReq: true } }
          ]
        },
        {
          id: 'high-value',
          requests: [
            { id: 'high', requestOptions: { reqData: { path: '/high' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-parallel-decision',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(4); // initial + 2 parallel + high-value
      
      // Verify execution order - init first, then both checks in parallel, then high-value
      expect(executionOrder[0]).toBe('/init');
      expect(executionOrder.slice(1, 3).sort()).toEqual(['/check1', '/check2']);
      expect(executionOrder[3]).toBe('/high');
    });

    it('should handle multiple parallel groups with decision points', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
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
          id: 'start',
          requests: [
            { id: 's', requestOptions: { reqData: { path: '/start' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({ action: PHASE_DECISION_ACTIONS.CONTINUE })
        },
        // First parallel group
        {
          id: 'parallel-1a',
          markConcurrentPhase: true,
          requests: [
            { id: 'p1a', requestOptions: { reqData: { path: '/p1a' }, resReq: true } }
          ]
        },
        {
          id: 'parallel-1b',
          markConcurrentPhase: true,
          requests: [
            { id: 'p1b', requestOptions: { reqData: { path: '/p1b' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({ action: PHASE_DECISION_ACTIONS.CONTINUE })
        },
        // Serial phase
        {
          id: 'middle',
          requests: [
            { id: 'm', requestOptions: { reqData: { path: '/middle' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({ action: PHASE_DECISION_ACTIONS.CONTINUE })
        },
        // Second parallel group
        {
          id: 'parallel-2a',
          markConcurrentPhase: true,
          requests: [
            { id: 'p2a', requestOptions: { reqData: { path: '/p2a' }, resReq: true } }
          ]
        },
        {
          id: 'parallel-2b',
          markConcurrentPhase: true,
          requests: [
            { id: 'p2b', requestOptions: { reqData: { path: '/p2b' }, resReq: true } }
          ]
        },
        {
          id: 'parallel-2c',
          markConcurrentPhase: true,
          requests: [
            { id: 'p2c', requestOptions: { reqData: { path: '/p2c' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({ action: PHASE_DECISION_ACTIONS.CONTINUE })
        },
        {
          id: 'end',
          requests: [
            { id: 'e', requestOptions: { reqData: { path: '/end' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-multi-parallel',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(8);
      
      // Verify execution order
      expect(executionOrder[0]).toBe('/start');
      expect(executionOrder.slice(1, 3).sort()).toEqual(['/p1a', '/p1b']);
      expect(executionOrder[3]).toBe('/middle');
      expect(executionOrder.slice(4, 7).sort()).toEqual(['/p2a', '/p2b', '/p2c']);
      expect(executionOrder[7]).toBe('/end');
    });

    it('should skip to phase after parallel group execution', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
          return {
            status: 200,
            data: { path, skip: path === '/p2' },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const phases = [
        {
          id: 'parallel-1',
          markConcurrentPhase: true,
          requests: [
            { id: 'p1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ]
        },
        {
          id: 'parallel-2',
          markConcurrentPhase: true,
          allowSkip: true,
          requests: [
            { id: 'p2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ concurrentPhaseResults }: PhaseDecisionHookOptions) => {
            const shouldSkip = concurrentPhaseResults!.some(
              result => result.responses[0]?.data?.skip
            );
            
            if (shouldSkip) {
              return { action: PHASE_DECISION_ACTIONS.SKIP, targetPhaseId: 'final' };
            }
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'middle-1',
          requests: [
            { id: 'm1', requestOptions: { reqData: { path: '/m1' }, resReq: true } }
          ]
        },
        {
          id: 'middle-2',
          requests: [
            { id: 'm2', requestOptions: { reqData: { path: '/m2' }, resReq: true } }
          ]
        },
        {
          id: 'final',
          requests: [
            { id: 'f', requestOptions: { reqData: { path: '/final' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-parallel-skip',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(3); // parallel group (2) + final
      
      // Should skip middle phases
      expect(executionOrder.slice(0, 2).sort()).toEqual(['/p1', '/p2']);
      expect(executionOrder[2]).toBe('/final');
      expect(executionOrder).not.toContain('/m1');
      expect(executionOrder).not.toContain('/m2');
    });

    it('should terminate workflow from parallel phase decision', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
          return {
            status: 200,
            data: { path, critical: path === '/check2' },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const phases = [
        {
          id: 'check-1',
          markConcurrentPhase: true,
          requests: [
            { id: 'c1', requestOptions: { reqData: { path: '/check1' }, resReq: true } }
          ]
        },
        {
          id: 'check-2',
          markConcurrentPhase: true,
          requests: [
            { id: 'c2', requestOptions: { reqData: { path: '/check2' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ concurrentPhaseResults }: PhaseDecisionHookOptions) => {
            const hasCritical = concurrentPhaseResults!.some(
              result => result.responses[0]?.data?.critical
            );
            
            if (hasCritical) {
              return {
                action: PHASE_DECISION_ACTIONS.TERMINATE,
                metadata: { reason: 'Critical condition detected in parallel checks' }
              };
            }
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'should-not-execute',
          requests: [
            { id: 'sne', requestOptions: { reqData: { path: '/should-not' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-parallel-terminate',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.terminatedEarly).toBe(true);
      expect(result.terminationReason).toBe('Critical condition detected in parallel checks');
      expect(result.completedPhases).toBe(2);
      
      expect(executionOrder.sort()).toEqual(['/check1', '/check2']);
      expect(executionOrder).not.toContain('/should-not');
    });

    it('should handle errors in parallel phases with stopOnFirstPhaseError', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
          if (path === '/fail') {
            throw {
              response: { status: 500, data: 'Parallel phase failed' },
              message: 'Request failed'
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
          id: 'parallel-success',
          markConcurrentPhase: true,
          requests: [
            { id: 'ps', requestOptions: { reqData: { path: '/success' }, resReq: true } }
          ]
        },
        {
          id: 'parallel-fail',
          markConcurrentPhase: true,
          requests: [
            { id: 'pf', requestOptions: { reqData: { path: '/fail' }, resReq: true, attempts: 1 } }
          ]
        },
        {
          id: 'should-not-execute',
          requests: [
            { id: 'sne', requestOptions: { reqData: { path: '/after' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-parallel-error',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true,
        stopOnFirstPhaseError: true
      });

      expect(result.success).toBe(false);
      expect(result.terminatedEarly).toBe(true);
      expect(result.completedPhases).toBe(2);
      expect(executionOrder.sort()).toEqual(['/fail', '/success']);
      expect(executionOrder).not.toContain('/after');
    });

    it('should continue after parallel phase errors when stopOnFirstPhaseError is false', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
          if (path === '/fail') {
            throw {
              response: { status: 500, data: 'Parallel phase failed' },
              message: 'Request failed'
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
          id: 'parallel-success',
          markConcurrentPhase: true,
          requests: [
            { id: 'ps', requestOptions: { reqData: { path: '/success' }, resReq: true } }
          ]
        },
        {
          id: 'parallel-fail',
          markConcurrentPhase: true,
          requests: [
            { id: 'pf', requestOptions: { reqData: { path: '/fail' }, resReq: true, attempts: 1 } }
          ],
          phaseDecisionHook: async ({ concurrentPhaseResults }: PhaseDecisionHookOptions) => {
            const hasFailure = concurrentPhaseResults!.some(result => !result.success);
            
            if (hasFailure) {
              return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'recovery' };
            }
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'normal-flow',
          requests: [
            { id: 'nf', requestOptions: { reqData: { path: '/normal' }, resReq: true } }
          ]
        },
        {
          id: 'recovery',
          requests: [
            { id: 'r', requestOptions: { reqData: { path: '/recovery' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-parallel-recovery',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true,
        stopOnFirstPhaseError: false
      });

      expect(result.success).toBe(false); // Overall failure due to parallel-fail
      expect(result.completedPhases).toBe(3); // parallel group (2) + recovery
      
      expect(executionOrder.slice(0, 2).sort()).toEqual(['/fail', '/success']);
      expect(executionOrder[2]).toBe('/recovery');
      expect(executionOrder).not.toContain('/normal');
    });

    it('should store parallel results in shared buffer', async () => {
      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          
          return {
            status: 200,
            data: { 
              path, 
              metric: path === '/metric1' ? 100 : path === '/metric2' ? 200 : 0 
            },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const sharedBuffer: Record<string, any> = {};

      const phases = [
        {
          id: 'metric-1',
          markConcurrentPhase: true,
          requests: [
            { id: 'm1', requestOptions: { reqData: { path: '/metric1' }, resReq: true } }
          ]
        },
        {
          id: 'metric-2',
          markConcurrentPhase: true,
          requests: [
            { id: 'm2', requestOptions: { reqData: { path: '/metric2' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ concurrentPhaseResults, sharedBuffer: sb }: PhaseDecisionHookOptions) => {
            sb!.parallelMetrics = concurrentPhaseResults!.map(
              result => ({
                phaseId: result.phaseId,
                metric: result.responses[0]?.data?.metric
              })
            );
            
            const total = concurrentPhaseResults!.reduce(
              (sum, result) => sum + (result.responses[0]?.data?.metric || 0),
              0
            );
            sb!.totalMetric = total;
            
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'analyze',
          requests: [
            { id: 'a', requestOptions: { reqData: { path: '/analyze' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ sharedBuffer: sb }: PhaseDecisionHookOptions) => {
            // Can access parallel results from previous phase
            expect(sb!.parallelMetrics).toHaveLength(2);
            expect(sb!.totalMetric).toBe(300);
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-parallel-buffer',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true,
        sharedBuffer
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(3);
      expect(sharedBuffer.totalMetric).toBe(300);
      expect(sharedBuffer.parallelMetrics).toHaveLength(2);
    });

    it('should jump from serial to parallel and back to serial', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
          return {
            status: 200,
            data: { path, jumpToParallel: path === '/init' },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const phases = [
        {
          id: 'init',
          requests: [
            { id: 'i', requestOptions: { reqData: { path: '/init' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ phaseResult }: PhaseDecisionHookOptions) => {
            if (phaseResult.responses[0]?.data?.jumpToParallel) {
              return { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'parallel-a' };
            }
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'should-skip',
          requests: [
            { id: 'ss', requestOptions: { reqData: { path: '/skip' }, resReq: true } }
          ]
        },
        {
          id: 'parallel-a',
          markConcurrentPhase: true,
          requests: [
            { id: 'pa', requestOptions: { reqData: { path: '/parallel-a' }, resReq: true } }
          ]
        },
        {
          id: 'parallel-b',
          markConcurrentPhase: true,
          requests: [
            { id: 'pb', requestOptions: { reqData: { path: '/parallel-b' }, resReq: true } }
          ],
          phaseDecisionHook: async () => ({
            action: PHASE_DECISION_ACTIONS.JUMP,
            targetPhaseId: 'finalize'
          })
        },
        {
          id: 'also-skip',
          requests: [
            { id: 'as', requestOptions: { reqData: { path: '/also-skip' }, resReq: true } }
          ]
        },
        {
          id: 'finalize',
          requests: [
            { id: 'f', requestOptions: { reqData: { path: '/finalize' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-jump-mixed',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(4); // init + parallel (2) + finalize
      
      expect(executionOrder[0]).toBe('/init');
      expect(executionOrder.slice(1, 3).sort()).toEqual(['/parallel-a', '/parallel-b']);
      expect(executionOrder[3]).toBe('/finalize');
      expect(executionOrder).not.toContain('/skip');
      expect(executionOrder).not.toContain('/also-skip');
    });
  });

  describe('Edge Cases', () => {
    it('should handle workflow with no phases', async () => {
      const phases: STABLE_WORKFLOW_PHASE[] = [];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-empty',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(0);
      expect(result.executionHistory).toHaveLength(0);
    });

    it('should handle phase with no decision hook (default to continue)', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
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
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ]
          // No phaseDecisionHook
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-no-hook',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(2);
      expect(executionOrder).toEqual(['/p1', '/p2']);
    });
  });

  describe('Backward Jumping with Conditional Logic', () => {
    it('should jump backward to a previous phase conditionally and continue forward on second pass', async () => {
      const executionOrder: string[] = [];
      const sharedBuffer: Record<string, any> = {};

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(path);
          
          return {
            status: 200,
            data: { path, timestamp: Date.now() },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const phases = [
        {
          id: 'phase-1-init',
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/init' }, resReq: true } }
          ]
        },
        {
          id: 'phase-2-process',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/process' }, resReq: true } }
          ]
        },
        {
          id: 'phase-3-validate',
          requests: [
            { id: 'r3', requestOptions: { reqData: { path: '/validate' }, resReq: true } }
          ],
          phaseDecisionHook: async ({ sharedBuffer, executionHistory }: PhaseDecisionHookOptions) => {
            // Count how many times this phase has been executed
            // Note: executionHistory includes records up to but NOT including the current execution
            const validationExecutions = executionHistory.filter(
              record => record.phaseId === 'phase-3-validate'
            ).length;
            
            // First time (validationExecutions === 0): jump back to phase-2-process
            if (validationExecutions === 0) {
              if (sharedBuffer) {
                sharedBuffer.jumpedBack = true;
              }
              return { 
                action: PHASE_DECISION_ACTIONS.JUMP, 
                targetPhaseId: 'phase-2-process' 
              };
            }
            
            // Second time (validationExecutions === 1): continue forward
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'phase-4-finalize',
          requests: [
            { id: 'r4', requestOptions: { reqData: { path: '/finalize' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-backward-jump',
        commonRequestData: { hostname: 'api.example.com' },
        enableNonLinearExecution: true,
        sharedBuffer
      });

      expect(result.success).toBe(true);
      expect(sharedBuffer.jumpedBack).toBe(true);
      
      // Expected order:
      // 1. /init (phase-1-init)
      // 2. /process (phase-2-process, first time)
      // 3. /validate (phase-3-validate, first time - decides to jump back)
      // 4. /process (phase-2-process, second time - after backward jump)
      // 5. /validate (phase-3-validate, second time - decides to continue)
      // 6. /finalize (phase-4-finalize)
      expect(executionOrder).toEqual([
        '/init',
        '/process',
        '/validate',
        '/process',    // backward jump executed
        '/validate',   // validation phase executed again
        '/finalize'
      ]);

      // Verify execution history shows the backward jump
      expect(result.executionHistory).toHaveLength(6);
      expect(result.executionHistory[0].phaseId).toBe('phase-1-init');
      expect(result.executionHistory[1].phaseId).toBe('phase-2-process');
      expect(result.executionHistory[2].phaseId).toBe('phase-3-validate');
      expect(result.executionHistory[3].phaseId).toBe('phase-2-process'); // jumped back
      expect(result.executionHistory[4].phaseId).toBe('phase-3-validate'); // executed again
      expect(result.executionHistory[5].phaseId).toBe('phase-4-finalize');
      
      // Verify execution numbers
      expect(result.executionHistory[1].executionNumber).toBe(1); // phase-2 first execution
      expect(result.executionHistory[3].executionNumber).toBe(2); // phase-2 second execution
      expect(result.executionHistory[2].executionNumber).toBe(1); // phase-3 first execution
      expect(result.executionHistory[4].executionNumber).toBe(2); // phase-3 second execution
    });
  });
});
