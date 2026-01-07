import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import axios from 'axios';
import { stableWorkflow } from '../src/core/index.js';
import { PHASE_DECISION_ACTIONS, RETRY_STRATEGIES } from '../src/enums/index.js';
import type {
  STABLE_WORKFLOW_BRANCH
} from '../src/types/index.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Branched Workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Parallel Branch Execution', () => {
    it('should execute multiple branches in parallel', async () => {
      const executionOrder: string[] = [];
      const startTime = Date.now();

      // Mock responses with delays to track parallel execution
      mockedAxios.request.mockImplementation(async (config) => {
        const path = config.url || '';
        executionOrder.push(path);
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
          status: 200,
          data: { path, timestamp: Date.now() - startTime },
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'branch-1',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-1-1',
              requests: [
                {
                  id: 'req-1-1',
                  requestOptions: {
                    reqData: { path: '/branch1/phase1' },
                    resReq: true
                  }
                }
              ]
            }
          ]
        },
        {
          id: 'branch-2',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-2-1',
              requests: [
                {
                  id: 'req-2-1',
                  requestOptions: {
                    reqData: { path: '/branch2/phase1' },
                    resReq: true
                  }
                }
              ]
            }
          ]
        },
        {
          id: 'branch-3',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-3-1',
              requests: [
                {
                  id: 'req-3-1',
                  requestOptions: {
                    reqData: { path: '/branch3/phase1' },
                    resReq: true
                  }
                }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'parallel-branches-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches,
        logPhaseResults: false
      });

      const endTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.branches).toHaveLength(3);
      expect(result.completedPhases).toBe(3);
      
      // Verify all branches executed
      expect(result.branches?.map(b => b.branchId).sort()).toEqual(['branch-1', 'branch-2', 'branch-3']);
      
      // All branches should succeed
      result.branches?.forEach(branch => {
        expect(branch.success).toBe(true);
        expect(branch.completedPhases).toBe(1);
      });

      // Execution should be faster than sequential (< 250ms vs 300ms)
      expect(endTime).toBeLessThan(250);
      
      // All requests should have been made
      expect(executionOrder).toHaveLength(3);
    });

    it('should execute parallel branches with multiple phases each', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'branch-1',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-1-1',
              requests: [{ id: 'req-1-1', requestOptions: { reqData: { path: '/b1/p1' }, resReq: true } }]
            },
            {
              id: 'phase-1-2',
              requests: [{ id: 'req-1-2', requestOptions: { reqData: { path: '/b1/p2' }, resReq: true } }]
            }
          ]
        },
        {
          id: 'branch-2',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-2-1',
              requests: [{ id: 'req-2-1', requestOptions: { reqData: { path: '/b2/p1' }, resReq: true } }]
            },
            {
              id: 'phase-2-2',
              requests: [{ id: 'req-2-2', requestOptions: { reqData: { path: '/b2/p2' }, resReq: true } }]
            },
            {
              id: 'phase-2-3',
              requests: [{ id: 'req-2-3', requestOptions: { reqData: { path: '/b2/p3' }, resReq: true } }]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'parallel-multi-phase-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches
      });

      expect(result.success).toBe(true);
      expect(result.branches).toHaveLength(2);
      expect(result.completedPhases).toBe(5); // 2 phases + 3 phases
      expect(mockedAxios.request).toHaveBeenCalledTimes(5);

      const branch1 = result.branches?.find(b => b.branchId === 'branch-1');
      const branch2 = result.branches?.find(b => b.branchId === 'branch-2');

      expect(branch1?.completedPhases).toBe(2);
      expect(branch2?.completedPhases).toBe(3);
    });
  });

  describe('Serial Branch Execution', () => {
    it('should execute serial branches sequentially', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(async (config) => {
        const path = config.url || '';
        executionOrder.push(path);
        
        return {
          status: 200,
          data: { path },
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'branch-1',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-1',
              requests: [{ id: 'req-1', requestOptions: { reqData: { path: '/branch1' }, resReq: true } }]
            }
          ]
        },
        {
          id: 'branch-2',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-2',
              requests: [{ id: 'req-2', requestOptions: { reqData: { path: '/branch2' }, resReq: true } }]
            }
          ]
        },
        {
          id: 'branch-3',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-3',
              requests: [{ id: 'req-3', requestOptions: { reqData: { path: '/branch3' }, resReq: true } }]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'serial-branches-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches
      });

      expect(result.success).toBe(true);
      expect(result.branches).toHaveLength(3);
      
      // Verify sequential execution order
      expect(executionOrder).toEqual(['/branch1', '/branch2', '/branch3']);
    });
  });

  describe('Mixed Parallel and Serial Branch Execution', () => {
    it('should execute parallel branches first, then serial branches', async () => {
      const executionOrder: string[] = [];
      const executionTimestamps: Record<string, number> = {};

      mockedAxios.request.mockImplementation(async (config) => {
        const path = config.url || '';
        executionTimestamps[path] = Date.now();
        executionOrder.push(path);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return {
          status: 200,
          data: { path },
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'parallel-1',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'p1-phase',
              requests: [{ id: 'p1-req', requestOptions: { reqData: { path: '/parallel1' }, resReq: true } }]
            }
          ]
        },
        {
          id: 'parallel-2',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'p2-phase',
              requests: [{ id: 'p2-req', requestOptions: { reqData: { path: '/parallel2' }, resReq: true } }]
            }
          ]
        },
        {
          id: 'serial-1',
          markConcurrentBranch: false,
          phases: [
            {
              id: 's1-phase',
              requests: [{ id: 's1-req', requestOptions: { reqData: { path: '/serial1' }, resReq: true } }]
            }
          ]
        },
        {
          id: 'serial-2',
          markConcurrentBranch: false,
          phases: [
            {
              id: 's2-phase',
              requests: [{ id: 's2-req', requestOptions: { reqData: { path: '/serial2' }, resReq: true } }]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'mixed-execution-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches
      });

      expect(result.success).toBe(true);
      expect(result.branches).toHaveLength(4);

      // Parallel branches should complete before serial branches start
      const parallel1Time = executionTimestamps['/parallel1'];
      const parallel2Time = executionTimestamps['/parallel2'];
      const serial1Time = executionTimestamps['/serial1'];
      const serial2Time = executionTimestamps['/serial2'];

      // Both parallel branches should start around the same time
      expect(Math.abs(parallel1Time - parallel2Time)).toBeLessThan(50);

      // Serial branches should start after parallel branches
      expect(serial1Time).toBeGreaterThan(parallel1Time);
      expect(serial1Time).toBeGreaterThan(parallel2Time);

      // Serial branches should execute sequentially
      expect(serial2Time).toBeGreaterThan(serial1Time);
    });
  });

  describe('Branch Decision Hooks', () => {
    it('should execute branch decision hooks and access results', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { result: 'success' },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      const branchDecisionResults: string[] = [];

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'branch-1',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-1',
              requests: [{ id: 'req-1', requestOptions: { reqData: { path: '/data' }, resReq: true } }]
            }
          ],
          branchDecisionHook: async ({ branchId, branchResults }) => {
            branchDecisionResults.push(`${branchId}: ${branchResults.length} phases`);
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'branch-2',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-2',
              requests: [{ id: 'req-2', requestOptions: { reqData: { path: '/data' }, resReq: true } }]
            }
          ],
          branchDecisionHook: async ({ branchId, branchResults }) => {
            branchDecisionResults.push(`${branchId}: ${branchResults.length} phases`);
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'branch-decision-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches
      });

      expect(result.success).toBe(true);
      expect(branchDecisionResults).toHaveLength(2);
      expect(branchDecisionResults).toContain('branch-1: 1 phases');
      expect(branchDecisionResults).toContain('branch-2: 1 phases');
    });

    it('should terminate workflow when branch decision hook returns TERMINATE', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { shouldTerminate: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'branch-1',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-1',
              requests: [{ id: 'req-1', requestOptions: { reqData: { path: '/check' }, resReq: true } }]
            }
          ],
          branchDecisionHook: async ({ branchResults }) => {
            const shouldTerminate = branchResults[0]?.responses[0]?.data?.shouldTerminate;
            if (shouldTerminate) {
              return {
                action: PHASE_DECISION_ACTIONS.TERMINATE,
                metadata: { reason: 'Termination requested by branch-1' }
              };
            }
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'branch-2',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-2',
              requests: [{ id: 'req-2', requestOptions: { reqData: { path: '/data' }, resReq: true } }]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'terminate-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches
      });

      expect(result.terminatedEarly).toBe(true);
      expect(result.terminationReason).toContain('branch-1');
      expect(result.branches).toHaveLength(1); // Only branch-1 executed
      expect(mockedAxios.request).toHaveBeenCalledTimes(1);
    });

    it('should support branch jumping with JUMP action', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { shouldJump: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'branch-1',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-1',
              requests: [{ id: 'req-1', requestOptions: { reqData: { path: '/check' }, resReq: true } }]
            }
          ],
          branchDecisionHook: async () => {
            return {
              action: PHASE_DECISION_ACTIONS.JUMP,
              targetBranchId: 'branch-3'
            };
          }
        },
        {
          id: 'branch-2',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-2',
              requests: [{ id: 'req-2', requestOptions: { reqData: { path: '/skip-me' }, resReq: true } }]
            }
          ]
        },
        {
          id: 'branch-3',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-3',
              requests: [{ id: 'req-3', requestOptions: { reqData: { path: '/target' }, resReq: true } }]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'jump-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches
      });

      expect(result.success).toBe(true);
      expect(result.branches).toHaveLength(2); // branch-1 and branch-3 only
      
      const executedBranchIds = result.branches?.map(b => b.branchId);
      expect(executedBranchIds).toContain('branch-1');
      expect(executedBranchIds).toContain('branch-3');
      expect(executedBranchIds).not.toContain('branch-2');
      
      // Verify JUMP decision was recorded
      const branch1Result = result.branches?.find(b => b.branchId === 'branch-1');
      expect(branch1Result?.decision?.action).toBe(PHASE_DECISION_ACTIONS.JUMP);
      expect(branch1Result?.decision?.targetBranchId).toBe('branch-3');
      
      expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    });
  });

  describe('Shared Buffer Across Branches', () => {
    it('should share state across parallel and serial branches', async () => {
      mockedAxios.request.mockImplementation(async (config) => {
        const path = config.url || '';
        
        if (path === '/set-data') {
          return {
            status: 200,
            data: { value: 'test-value', count: 42 },
            statusText: 'OK',
            headers: {},
            config: config as any
          } as any;
        }
        
        return {
          status: 200,
          data: { success: true },
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const sharedBuffer: Record<string, any> = {};

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'data-setter',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'set-phase',
              requests: [{ id: 'set-req', requestOptions: { reqData: { path: '/set-data' }, resReq: true } }]
            }
          ],
          branchDecisionHook: async ({ branchResults, sharedBuffer }) => {
            const data = branchResults[0]?.responses[0]?.data;
            sharedBuffer!.collectedData = data;
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'data-consumer',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'consume-phase',
              requests: [{ id: 'consume-req', requestOptions: { reqData: { path: '/use-data' }, resReq: true } }]
            }
          ],
          branchDecisionHook: async ({ sharedBuffer }) => {
            // Access data from parallel branch
            expect(sharedBuffer!.collectedData).toBeDefined();
            expect(sharedBuffer!.collectedData.value).toBe('test-value');
            expect(sharedBuffer!.collectedData.count).toBe(42);
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'shared-buffer-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches,
        sharedBuffer
      });

      expect(result.success).toBe(true);
      expect(sharedBuffer.collectedData).toBeDefined();
      expect(sharedBuffer.collectedData.value).toBe('test-value');
      expect(sharedBuffer.collectedData.count).toBe(42);
    });

    it('should allow branches to modify shared buffer', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: {},
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      const sharedBuffer: Record<string, any> = {
        counters: {},
        results: []
      };

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'branch-1',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-1',
              requests: [{ id: 'req-1', requestOptions: { reqData: { path: '/b1' }, resReq: true } }]
            }
          ],
          branchDecisionHook: async ({ sharedBuffer }) => {
            sharedBuffer!.counters['branch-1'] = 1;
            sharedBuffer!.results.push('branch-1-complete');
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'branch-2',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-2',
              requests: [{ id: 'req-2', requestOptions: { reqData: { path: '/b2' }, resReq: true } }]
            }
          ],
          branchDecisionHook: async ({ sharedBuffer }) => {
            sharedBuffer!.counters['branch-2'] = 2;
            sharedBuffer!.results.push('branch-2-complete');
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'branch-3',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-3',
              requests: [{ id: 'req-3', requestOptions: { reqData: { path: '/b3' }, resReq: true } }]
            }
          ],
          branchDecisionHook: async ({ sharedBuffer }) => {
            // Sum counters from parallel branches
            const total = Object.values(sharedBuffer!.counters).reduce((sum: number, val: any) => sum + val, 0);
            sharedBuffer!.totalCount = total;
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'buffer-modification-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches,
        sharedBuffer
      });

      expect(result.success).toBe(true);
      expect(sharedBuffer.counters['branch-1']).toBe(1);
      expect(sharedBuffer.counters['branch-2']).toBe(2);
      expect(sharedBuffer.totalCount).toBe(3);
      expect(sharedBuffer.results).toHaveLength(2);
    });
  });

  describe('Branch Completion Hooks', () => {
    it('should invoke handleBranchCompletion hook for each completed branch', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: {},
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      const completedBranches: string[] = [];
      const branchStatuses: Record<string, boolean> = {};

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'branch-1',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-1',
              requests: [{ id: 'req-1', requestOptions: { reqData: { path: '/b1' }, resReq: true } }]
            }
          ]
        },
        {
          id: 'branch-2',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-2',
              requests: [{ id: 'req-2', requestOptions: { reqData: { path: '/b2' }, resReq: true } }]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'completion-hook-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches,
        handleBranchCompletion: async ({ branchId, success }) => {
          completedBranches.push(branchId);
          branchStatuses[branchId] = success;
        }
      });

      expect(result.success).toBe(true);
      expect(completedBranches).toHaveLength(2);
      expect(completedBranches).toContain('branch-1');
      expect(completedBranches).toContain('branch-2');
      expect(branchStatuses['branch-1']).toBe(true);
      expect(branchStatuses['branch-2']).toBe(true);
    });
  });

  describe('Error Handling in Branches', () => {
    it('should continue workflow when stopOnFirstPhaseError is false', async () => {
      let callCount = 0;
      mockedAxios.request.mockImplementation(async (config) => {
        callCount++;
        
        if (callCount === 1) {
          throw new Error('Branch 1 failed');
        }
        
        return {
          status: 200,
          data: {},
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'failing-branch',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-1',
              requests: [{ id: 'req-1', requestOptions: { reqData: { path: '/fail' }, resReq: true } }]
            }
          ]
        },
        {
          id: 'success-branch',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-2',
              requests: [{ id: 'req-2', requestOptions: { reqData: { path: '/success' }, resReq: true } }]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'error-handling-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches,
        stopOnFirstPhaseError: false
      });

      expect(result.branches).toHaveLength(2);
      
      const failingBranch = result.branches?.find(b => b.branchId === 'failing-branch');
      const successBranch = result.branches?.find(b => b.branchId === 'success-branch');

      expect(failingBranch?.success).toBe(false);
      expect(successBranch?.success).toBe(true);
    });

    it('should stop workflow when stopOnFirstPhaseError is true', async () => {
      mockedAxios.request.mockRejectedValue(new Error('Request failed'));

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'branch-1',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-1',
              requests: [{ id: 'req-1', requestOptions: { reqData: { path: '/fail' }, resReq: true } }]
            }
          ]
        },
        {
          id: 'branch-2',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-2',
              requests: [{ id: 'req-2', requestOptions: { reqData: { path: '/never-reached' }, resReq: true } }]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'stop-on-error-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches,
        stopOnFirstPhaseError: true
      });

      expect(result.terminatedEarly).toBe(true);
      expect(result.branches).toHaveLength(1); // Only first branch executed
    });
  });

  describe('Complex Branch Workflows', () => {
    it('should handle complex multi-branch workflow with conditional logic', async () => {
      mockedAxios.request.mockImplementation(async (config) => {
        const path = config.url || '';
        
        if (path === '/check-user') {
          return {
            status: 200,
            data: { userType: 'premium', valid: true },
            statusText: 'OK',
            headers: {},
            config: config as any
          } as any;
        }
        
        if (path === '/check-inventory') {
          return {
            status: 200,
            data: { available: true, quantity: 100 },
            statusText: 'OK',
            headers: {},
            config: config as any
          } as any;
        }
        
        return {
          status: 200,
          data: { success: true },
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const sharedBuffer: Record<string, any> = {};

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'validation',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'user-check',
              requests: [{ id: 'user', requestOptions: { reqData: { path: '/check-user' }, resReq: true } }]
            }
          ],
          branchDecisionHook: async ({ branchResults, sharedBuffer }) => {
            sharedBuffer!.userType = branchResults[0]?.responses[0]?.data?.userType;
            sharedBuffer!.userValid = branchResults[0]?.responses[0]?.data?.valid;
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'inventory-check',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'inventory',
              requests: [{ id: 'inv', requestOptions: { reqData: { path: '/check-inventory' }, resReq: true } }]
            }
          ],
          branchDecisionHook: async ({ branchResults, sharedBuffer }) => {
            sharedBuffer!.inventoryAvailable = branchResults[0]?.responses[0]?.data?.available;
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'decision',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'decide',
              requests: [{ id: 'dec', requestOptions: { reqData: { path: '/decide' }, resReq: true } }]
            }
          ],
          branchDecisionHook: async ({ sharedBuffer }) => {
            if (!sharedBuffer!.userValid || !sharedBuffer!.inventoryAvailable) {
              return {
                action: PHASE_DECISION_ACTIONS.JUMP,
                targetBranchId: 'error-handling'
              };
            }
            return {
              action: PHASE_DECISION_ACTIONS.JUMP,
              targetBranchId: 'process-order'
            };
          }
        },
        {
          id: 'process-order',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'validate',
              requests: [{ id: 'val', requestOptions: { reqData: { path: '/validate' }, resReq: true } }]
            },
            {
              id: 'payment',
              requests: [{ id: 'pay', requestOptions: { reqData: { path: '/payment' }, resReq: true } }]
            }
          ],
          branchDecisionHook: async () => {
            // Terminate workflow after successful order processing
            return {
              action: PHASE_DECISION_ACTIONS.TERMINATE,
              metadata: { reason: 'Order processed successfully' }
            };
          }
        },
        {
          id: 'error-handling',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'error',
              requests: [{ id: 'err', requestOptions: { reqData: { path: '/error' }, resReq: true } }]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'complex-workflow-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches,
        sharedBuffer
      });

      expect(result.success).toBe(true);
      expect(sharedBuffer.userType).toBe('premium');
      expect(sharedBuffer.userValid).toBe(true);
      expect(sharedBuffer.inventoryAvailable).toBe(true);
      
      // Verify branches executed (decision should jump to process-order, skipping error-handling)
      const executedBranchIds = result.branches?.map(b => b.branchId);
      expect(executedBranchIds).toContain('validation');
      expect(executedBranchIds).toContain('inventory-check');
      expect(executedBranchIds).toContain('decision');
      expect(executedBranchIds).toContain('process-order');
      
      // Verify decision branch jumped to process-order
      const decisionBranch = result.branches?.find(b => b.branchId === 'decision');
      expect(decisionBranch?.decision?.action).toBe(PHASE_DECISION_ACTIONS.JUMP);
      expect(decisionBranch?.decision?.targetBranchId).toBe('process-order');
      
      // Error-handling branch should NOT be executed since validation passed
      expect(executedBranchIds).not.toContain('error-handling');
    });
  });

  describe('Branch Execution with Retry Logic', () => {
    it('should retry failed requests within branches', async () => {
      let attemptCount = 0;
      
      mockedAxios.request.mockImplementation(async () => {
        attemptCount++;
        
        if (attemptCount < 3) {
          const error: any = new Error('Temporary failure');
          error.response = { status: 503, data: {}, statusText: 'Service Unavailable' };
          error.isAxiosError = true;
          throw error;
        }
        
        return {
          status: 200,
          data: { success: true },
          statusText: 'OK',
          headers: {},
          config: {} as any
        } as any;
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'retry-branch',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'retry-phase',
              commonConfig: {
                commonAttempts: 5,
                commonWait: 100,
                commonRetryStrategy: RETRY_STRATEGIES.FIXED
              },
              requests: [
                {
                  id: 'retry-req',
                  requestOptions: {
                    reqData: { path: '/retry' },
                    resReq: true
                  }
                }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'retry-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches,
        stopOnFirstPhaseError: false
      });

      // Verify retry logic worked correctly
      expect(attemptCount).toBe(3);
      expect(result.branches).toHaveLength(1);
      expect(result.branches?.[0]?.branchId).toBe('retry-branch');
      expect(result.branches?.[0]?.success).toBe(true);
      expect(result.success).toBe(true);
    });
  });

  describe('Branch Execution Performance', () => {
    it('should demonstrate performance benefit of parallel branches', async () => {
      const delayMs = 100;
      
      mockedAxios.request.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return {
          status: 200,
          data: {},
          statusText: 'OK',
          headers: {},
          config: {} as any
        } as any;
      });

      // Parallel execution
      const parallelStartTime = Date.now();
      
      const parallelBranches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'p1',
          markConcurrentBranch: true,
          phases: [{ id: 'ph1', requests: [{ id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }] }]
        },
        {
          id: 'p2',
          markConcurrentBranch: true,
          phases: [{ id: 'ph2', requests: [{ id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }] }]
        },
        {
          id: 'p3',
          markConcurrentBranch: true,
          phases: [{ id: 'ph3', requests: [{ id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }] }]
        }
      ];

      await stableWorkflow([], {
        workflowId: 'parallel-perf',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches: parallelBranches
      });

      const parallelExecutionTime = Date.now() - parallelStartTime;

      // Serial execution
      jest.clearAllMocks();
      const serialStartTime = Date.now();

      const serialBranches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 's1',
          markConcurrentBranch: false,
          phases: [{ id: 'sh1', requests: [{ id: 'sr1', requestOptions: { reqData: { path: '/s1' }, resReq: true } }] }]
        },
        {
          id: 's2',
          markConcurrentBranch: false,
          phases: [{ id: 'sh2', requests: [{ id: 'sr2', requestOptions: { reqData: { path: '/s2' }, resReq: true } }] }]
        },
        {
          id: 's3',
          markConcurrentBranch: false,
          phases: [{ id: 'sh3', requests: [{ id: 'sr3', requestOptions: { reqData: { path: '/s3' }, resReq: true } }] }]
        }
      ];

      await stableWorkflow([], {
        workflowId: 'serial-perf',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches: serialBranches
      });

      const serialExecutionTime = Date.now() - serialStartTime;

      // Parallel should be significantly faster
      expect(parallelExecutionTime).toBeLessThan(serialExecutionTime * 0.5);
      expect(serialExecutionTime).toBeGreaterThanOrEqual(delayMs * 3);
    });
  });
});
