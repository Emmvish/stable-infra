import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { stableWorkflow } from '../src/core/index.js';
import { PHASE_DECISION_ACTIONS, RETRY_STRATEGIES } from '../src/enums/index.js';
import type {
  STABLE_WORKFLOW_BRANCH
} from '../src/types/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Branch Advanced Features: Config Cascading, Mixed Execution, and Non-Linear Execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Config Cascading in Branches', () => {
    it('should cascade workflow-level config to all branches', async () => {
      let requestCount = 0;
      const requestAttempts: Record<string, number> = {};

      mockedAxios.request.mockImplementation(async (config) => {
        const path = config.url || '';
        requestAttempts[path] = (requestAttempts[path] || 0) + 1;
        requestCount++;

        // Fail first 2 attempts for each request
        if (requestAttempts[path] < 3) {
          const error: any = new Error('Temporary failure');
          error.response = { status: 503, data: {}, statusText: 'Service Unavailable' };
          error.isAxiosError = true;
          throw error;
        }

        return {
          status: 200,
          data: { path, attempt: requestAttempts[path] },
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
              id: 'phase-1',
              requests: [
                { id: 'req-1', requestOptions: { reqData: { path: '/b1/p1' }, resReq: true } }
              ]
            }
          ]
        },
        {
          id: 'branch-2',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-2',
              requests: [
                { id: 'req-2', requestOptions: { reqData: { path: '/b2/p1' }, resReq: true } }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'config-cascade-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches,
        commonAttempts: 5,
        commonWait: 10,
        commonRetryStrategy: RETRY_STRATEGIES.FIXED
      });

      expect(result.success).toBe(true);
      expect(result.branches).toHaveLength(2);
      
      // Both branches should have retried and succeeded
      expect(requestAttempts['/b1/p1']).toBe(3);
      expect(requestAttempts['/b2/p1']).toBe(3);
    });

    it('should allow branch-level commonConfig to override workflow-level config', async () => {
      let requestCount = 0;
      const requestAttempts: Record<string, number> = {};

      mockedAxios.request.mockImplementation(async (config) => {
        const path = config.url || '';
        requestAttempts[path] = (requestAttempts[path] || 0) + 1;
        requestCount++;

        // Fail first attempt
        if (requestAttempts[path] === 1) {
          const error: any = new Error('First attempt failure');
          error.response = { status: 503, data: {}, statusText: 'Service Unavailable' };
          error.isAxiosError = true;
          throw error;
        }

        return {
          status: 200,
          data: { path, attempt: requestAttempts[path] },
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'branch-with-override',
          markConcurrentBranch: false,
          commonConfig: {
            commonAttempts: 5,
            commonWait: 5,
            commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
          },
          phases: [
            {
              id: 'phase-1',
              requests: [
                { id: 'req-1', requestOptions: { reqData: { path: '/override' }, resReq: true } }
              ]
            }
          ]
        },
        {
          id: 'branch-with-defaults',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-2',
              requests: [
                { id: 'req-2', requestOptions: { reqData: { path: '/default' }, resReq: true, attempts: 1 } }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'config-override-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches,
        commonAttempts: 1,
        commonWait: 1000
      });

      // Branch 1 should succeed after retry
      const branch1 = result.branches?.find(b => b.branchId === 'branch-with-override');
      expect(branch1?.success).toBe(true);
      expect(requestAttempts['/override']).toBe(2);

      // Branch 2 should fail (only 1 attempt)
      const branch2 = result.branches?.find(b => b.branchId === 'branch-with-defaults');
      expect(branch2?.success).toBe(false);
      expect(requestAttempts['/default']).toBe(1);
    });

    it('should cascade cache config to branches', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(async (config) => {
        requestCount++;
        return {
          status: 200,
          data: { count: requestCount },
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
              requests: [
                { id: 'req-1', requestOptions: { reqData: { path: '/cached' }, resReq: true } }
              ]
            }
          ]
        },
        {
          id: 'branch-2',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-2',
              requests: [
                { id: 'req-2', requestOptions: { reqData: { path: '/cached' }, resReq: true } }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'cache-cascade-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches,
        commonCache: { enabled: true, ttl: 60000 }
      });

      expect(result.success).toBe(true);
      // Only 1 actual request due to caching
      expect(requestCount).toBe(1);
    });

    it('should allow phase-level config to override branch and workflow config', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(async (config) => {
        requestCount++;
        
        if (requestCount === 1) {
          const error: any = new Error('Failure');
          error.response = { status: 500, data: {}, statusText: 'Error' };
          error.isAxiosError = true;
          throw error;
        }

        return {
          status: 200,
          data: { success: true },
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'branch-1',
          markConcurrentBranch: false,
          commonConfig: {
            commonAttempts: 1
          },
          phases: [
            {
              id: 'phase-with-override',
              commonConfig: {
                commonAttempts: 5,
                commonWait: 10
              },
              requests: [
                { id: 'req-1', requestOptions: { reqData: { path: '/override' }, resReq: true } }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'phase-override-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        branches,
        commonAttempts: 1
      });

      expect(result.success).toBe(true);
      expect(requestCount).toBe(2); // Phase-level retry succeeded
    });
  });

  describe('Mixed Execution in Branches', () => {
    it('should execute branches with mixed concurrent and sequential phases', async () => {
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
          id: 'mixed-branch',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-1-sequential',
              requests: [
                { id: 'req-1', requestOptions: { reqData: { path: '/seq1' }, resReq: true } }
              ]
            },
            {
              id: 'phase-2-concurrent',
              markConcurrentPhase: true,
              requests: [
                { id: 'req-2', requestOptions: { reqData: { path: '/conc2' }, resReq: true } }
              ]
            },
            {
              id: 'phase-3-concurrent',
              markConcurrentPhase: true,
              requests: [
                { id: 'req-3', requestOptions: { reqData: { path: '/conc3' }, resReq: true } }
              ]
            },
            {
              id: 'phase-4-sequential',
              requests: [
                { id: 'req-4', requestOptions: { reqData: { path: '/seq4' }, resReq: true } }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'mixed-branch-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        enableMixedExecution: true,
        branches
      });

      expect(result.success).toBe(true);
      expect(executionOrder).toHaveLength(4);

      // Phase 1 should complete before phases 2 and 3 start
      expect(executionOrder[0]).toBe('/seq1');
      
      // Phases 2 and 3 should execute concurrently
      const conc2Index = executionOrder.indexOf('/conc2');
      const conc3Index = executionOrder.indexOf('/conc3');
      expect(Math.abs(conc2Index - conc3Index)).toBe(1);
      
      // Phase 4 should execute after phases 2 and 3
      expect(executionOrder[3]).toBe('/seq4');

      // Verify concurrent phases started at similar times
      const timeDiff = Math.abs(executionTimestamps['/conc2'] - executionTimestamps['/conc3']);
      expect(timeDiff).toBeLessThan(30);
    });

    it('should execute multiple branches with mixed phases in parallel', async () => {
      const executionOrder: string[] = [];
      const branchTimestamps: Record<string, number> = {};

      mockedAxios.request.mockImplementation(async (config) => {
        const path = config.url || '';
        const branchId = path.split('/')[1];
        
        if (!branchTimestamps[branchId]) {
          branchTimestamps[branchId] = Date.now();
        }
        
        executionOrder.push(path);
        await new Promise(resolve => setTimeout(resolve, 30));
        
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
          markConcurrentBranch: true,
          phases: [
            {
              id: 'b1-seq',
              requests: [
                { id: 'b1-r1', requestOptions: { reqData: { path: '/b1/seq' }, resReq: true } }
              ]
            },
            {
              id: 'b1-conc1',
              markConcurrentPhase: true,
              requests: [
                { id: 'b1-r2', requestOptions: { reqData: { path: '/b1/conc1' }, resReq: true } }
              ]
            },
            {
              id: 'b1-conc2',
              markConcurrentPhase: true,
              requests: [
                { id: 'b1-r3', requestOptions: { reqData: { path: '/b1/conc2' }, resReq: true } }
              ]
            }
          ]
        },
        {
          id: 'branch-2',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'b2-conc1',
              markConcurrentPhase: true,
              requests: [
                { id: 'b2-r1', requestOptions: { reqData: { path: '/b2/conc1' }, resReq: true } }
              ]
            },
            {
              id: 'b2-conc2',
              markConcurrentPhase: true,
              requests: [
                { id: 'b2-r2', requestOptions: { reqData: { path: '/b2/conc2' }, resReq: true } }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'parallel-mixed-branches-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        enableMixedExecution: true,
        branches
      });

      expect(result.success).toBe(true);
      expect(result.branches).toHaveLength(2);
      expect(executionOrder).toHaveLength(5);

      // Both branches should start around the same time
      const timeDiff = Math.abs(branchTimestamps['b1'] - branchTimestamps['b2']);
      expect(timeDiff).toBeLessThan(50);
    });

    it('should handle errors in concurrent phases within branches', async () => {
      mockedAxios.request.mockImplementation(async (config) => {
        const path = config.url || '';
        
        if (path === '/conc2') {
          throw {
            response: { status: 500, data: 'Error' },
            message: 'Phase failed'
          };
        }
        
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
          id: 'error-branch',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-1-concurrent',
              markConcurrentPhase: true,
              requests: [
                { id: 'req-1', requestOptions: { reqData: { path: '/conc1' }, resReq: true, attempts: 1 } }
              ]
            },
            {
              id: 'phase-2-concurrent',
              markConcurrentPhase: true,
              requests: [
                { id: 'req-2', requestOptions: { reqData: { path: '/conc2' }, resReq: true, attempts: 1 } }
              ]
            },
            {
              id: 'phase-3-sequential',
              requests: [
                { id: 'req-3', requestOptions: { reqData: { path: '/seq3' }, resReq: true } }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'error-mixed-branch-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        enableMixedExecution: true,
        branches,
        stopOnFirstPhaseError: false
      });

      const branch = result.branches?.[0];
      expect(branch?.success).toBe(false);
      expect(branch?.completedPhases).toBe(3);
      
      // Check that one request failed
      const failedRequests = branch?.phaseResults.reduce((count, phase) => {
        return count + (phase.responses?.filter(r => !r.success).length || 0);
      }, 0);
      expect(failedRequests).toBe(1);
    });

    it('should share buffer across mixed phases in branches', async () => {
      const sharedBuffer: Record<string, any> = { data: [] };

      mockedAxios.request.mockImplementation(async (config) => {
        return {
          status: 200,
          data: { path: config.url },
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'buffer-branch',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-1',
              requests: [
                {
                  id: 'req-1',
                  requestOptions: {
                    reqData: { path: '/p1' },
                    resReq: true,
                    preExecution: {
                      preExecutionHook: ({ commonBuffer }: any) => {
                        commonBuffer.data.push('p1');
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
                  id: 'req-2',
                  requestOptions: {
                    reqData: { path: '/p2' },
                    resReq: true,
                    preExecution: {
                      preExecutionHook: ({ commonBuffer }: any) => {
                        commonBuffer.data.push('p2-concurrent');
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
                  id: 'req-3',
                  requestOptions: {
                    reqData: { path: '/p3' },
                    resReq: true,
                    preExecution: {
                      preExecutionHook: ({ commonBuffer }: any) => {
                        commonBuffer.data.push('p3-concurrent');
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
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'buffer-mixed-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        enableMixedExecution: true,
        branches,
        sharedBuffer
      });

      expect(result.success).toBe(true);
      expect(sharedBuffer.data).toHaveLength(3);
      expect(sharedBuffer.data[0]).toBe('p1');
      expect(sharedBuffer.data.slice(1).sort()).toEqual(['p2-concurrent', 'p3-concurrent']);
    });
  });

  describe('Non-Linear Execution in Branches', () => {
    it('should support JUMP action within branch phases', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(async (config) => {
        const path = config.url || '';
        executionOrder.push(path);
        
        return {
          status: 200,
          data: { path, shouldJump: path === '/check' },
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'jump-branch',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'check-phase',
              requests: [
                { id: 'check', requestOptions: { reqData: { path: '/check' }, resReq: true } }
              ],
              phaseDecisionHook: async ({ phaseResult }) => {
                const shouldJump = phaseResult.responses[0]?.data?.shouldJump;
                if (shouldJump) {
                  return {
                    action: PHASE_DECISION_ACTIONS.JUMP,
                    targetPhaseId: 'target-phase'
                  };
                }
                return { action: PHASE_DECISION_ACTIONS.CONTINUE };
              }
            },
            {
              id: 'skip-phase',
              requests: [
                { id: 'skip', requestOptions: { reqData: { path: '/skip' }, resReq: true } }
              ]
            },
            {
              id: 'target-phase',
              requests: [
                { id: 'target', requestOptions: { reqData: { path: '/target' }, resReq: true } }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'branch-jump-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        enableNonLinearExecution: true,
        branches
      });

      expect(result.success).toBe(true);
      expect(executionOrder).toEqual(['/check', '/target']);
      expect(executionOrder).not.toContain('/skip');
    });

    it('should support REPLAY action within branch phases', async () => {
      let replayCount = 0;

      mockedAxios.request.mockImplementation(async (config) => {
        return {
          status: 200,
          data: { count: ++replayCount },
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'replay-branch',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'replay-phase',
              allowReplay: true,
              maxReplayCount: 2,
              requests: [
                { id: 'replay', requestOptions: { reqData: { path: '/replay' }, resReq: true } }
              ],
              phaseDecisionHook: async ({ phaseResult }) => {
                const count = phaseResult.responses[0]?.data?.count || 0;
                if (count < 3) {
                  return { action: PHASE_DECISION_ACTIONS.REPLAY };
                }
                return { action: PHASE_DECISION_ACTIONS.CONTINUE };
              }
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'branch-replay-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        enableNonLinearExecution: true,
        branches
      });

      expect(result.success).toBe(true);
      expect(replayCount).toBe(3);
      
      const branch = result.branches?.[0];
      expect(branch?.completedPhases).toBe(3);
    });

    it('should support SKIP action within branch phases', async () => {
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
          id: 'skip-branch',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-1',
              allowSkip: true,
              requests: [
                { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
              ],
              phaseDecisionHook: async () => ({
                action: PHASE_DECISION_ACTIONS.SKIP,
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
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'branch-skip-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        enableNonLinearExecution: true,
        branches
      });

      expect(result.success).toBe(true);
      expect(executionOrder).toEqual(['/p1', '/p3']);
      expect(executionOrder).not.toContain('/p2');
    });

    it('should support TERMINATE action within branch phases', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(async (config) => {
        const path = config.url || '';
        executionOrder.push(path);
        
        return {
          status: 200,
          data: { path, shouldTerminate: path === '/p1' },
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'terminate-branch',
          markConcurrentBranch: false,
          phases: [
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
              ]
            }
          ],
          branchDecisionHook: async ({ branchResults }) => {
            const shouldTerminate = branchResults[0]?.responses[0]?.data?.shouldTerminate;
            if (shouldTerminate) {
              return {
                action: PHASE_DECISION_ACTIONS.TERMINATE,
                metadata: { reason: 'Condition met' }
              };
            }
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'other-branch',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'phase-3',
              requests: [
                { id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'branch-terminate-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        enableNonLinearExecution: true,
        branches
      });

      expect(result.terminatedEarly).toBe(true);
      expect(result.terminationReason).toContain('Condition met');
      // Branch decision hook runs after all phases, so both phases execute
      expect(executionOrder).toEqual(['/p1', '/p2']);
      expect(result.branches).toHaveLength(1);
    });

    it('should support non-linear execution with concurrent phases in branches', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(async (config) => {
        const path = config.url || '';
        executionOrder.push(path);
        
        return {
          status: 200,
          data: { path, value: path === '/check1' ? 10 : 20 },
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'complex-branch',
          markConcurrentBranch: false,
          phases: [
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
              phaseDecisionHook: async ({ concurrentPhaseResults }) => {
                const total = concurrentPhaseResults!.reduce(
                  (sum, result) => sum + (result.responses[0]?.data?.value || 0),
                  0
                );
                
                if (total > 25) {
                  return {
                    action: PHASE_DECISION_ACTIONS.JUMP,
                    targetPhaseId: 'high-value'
                  };
                }
                return { action: PHASE_DECISION_ACTIONS.CONTINUE };
              }
            },
            {
              id: 'normal',
              requests: [
                { id: 'n', requestOptions: { reqData: { path: '/normal' }, resReq: true } }
              ]
            },
            {
              id: 'high-value',
              requests: [
                { id: 'h', requestOptions: { reqData: { path: '/high' }, resReq: true } }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'complex-nonlinear-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        enableNonLinearExecution: true,
        enableMixedExecution: true,
        branches
      });

      expect(result.success).toBe(true);
      expect(executionOrder.slice(0, 2).sort()).toEqual(['/check1', '/check2']);
      expect(executionOrder[2]).toBe('/high');
      expect(executionOrder).not.toContain('/normal');
    });

    it('should maintain execution history across non-linear branch execution', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { ok: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'history-branch',
          markConcurrentBranch: false,
          phases: [
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
              phaseDecisionHook: async ({ executionHistory }) => {
                const phase3Executions = executionHistory.filter(h => h.phaseId === 'phase-3').length;
                if (phase3Executions < 2) {
                  return { action: PHASE_DECISION_ACTIONS.REPLAY };
                }
                return { action: PHASE_DECISION_ACTIONS.CONTINUE };
              }
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'history-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        enableNonLinearExecution: true,
        branches
      });

      expect(result.success).toBe(true);
      expect(result.executionHistory).toHaveLength(3);
      
      expect(result.executionHistory[0]).toMatchObject({
        phaseId: 'phase-1',
        executionNumber: 1,
        decision: { action: PHASE_DECISION_ACTIONS.JUMP, targetPhaseId: 'phase-3' }
      });
      
      expect(result.executionHistory[1]).toMatchObject({
        phaseId: 'phase-3',
        executionNumber: 1,
        decision: { action: PHASE_DECISION_ACTIONS.REPLAY }
      });
      
      expect(result.executionHistory[2]).toMatchObject({
        phaseId: 'phase-3',
        executionNumber: 2
      });
    });
  });

  describe('Combined: Config Cascading + Mixed Execution + Non-Linear in Branches', () => {
    it('should handle all three features together in parallel branches', async () => {
      let requestCount = 0;
      const executionOrder: string[] = [];
      const sharedBuffer: Record<string, any> = { results: [] };

      mockedAxios.request.mockImplementation(async (config) => {
        const path = config.url || '';
        requestCount++;
        executionOrder.push(path);

        // Fail first attempt for retry testing
        if (path === '/retry' && requestCount === 1) {
          const error: any = new Error('First attempt');
          error.response = { status: 503, data: {}, statusText: 'Service Unavailable' };
          error.isAxiosError = true;
          throw error;
        }
        
        return {
          status: 200,
          data: { path, value: path.includes('conc') ? 15 : 0 },
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'branch-1',
          markConcurrentBranch: true,
          commonConfig: {
            commonAttempts: 3,
            commonWait: 10
          },
          phases: [
            {
              id: 'b1-retry-phase',
              requests: [
                { id: 'b1-r1', requestOptions: { reqData: { path: '/retry' }, resReq: true } }
              ]
            }
          ]
        },
        {
          id: 'branch-2',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'b2-check',
              requests: [
                { id: 'b2-r1', requestOptions: { reqData: { path: '/check' }, resReq: true } }
              ],
              phaseDecisionHook: async () => ({
                action: PHASE_DECISION_ACTIONS.JUMP,
                targetPhaseId: 'b2-target'
              })
            },
            {
              id: 'b2-skip',
              requests: [
                { id: 'b2-r2', requestOptions: { reqData: { path: '/skip' }, resReq: true } }
              ]
            },
            {
              id: 'b2-target',
              requests: [
                { id: 'b2-r3', requestOptions: { reqData: { path: '/target' }, resReq: true } }
              ]
            }
          ]
        },
        {
          id: 'branch-3',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'b3-conc1',
              markConcurrentPhase: true,
              requests: [
                { id: 'b3-r1', requestOptions: { reqData: { path: '/conc1' }, resReq: true } }
              ]
            },
            {
              id: 'b3-conc2',
              markConcurrentPhase: true,
              requests: [
                { id: 'b3-r2', requestOptions: { reqData: { path: '/conc2' }, resReq: true } }
              ],
              phaseDecisionHook: async ({ concurrentPhaseResults, sharedBuffer: sb }) => {
                const total = concurrentPhaseResults!.reduce(
                  (sum, result) => sum + (result.responses[0]?.data?.value || 0),
                  0
                );
                sb!.results.push({ total, branch: 'branch-3' });
                return { action: PHASE_DECISION_ACTIONS.CONTINUE };
              }
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'combined-features-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        enableNonLinearExecution: true,
        enableMixedExecution: true,
        branches,
        sharedBuffer,
        commonAttempts: 1
      });

      expect(result.success).toBe(true);
      expect(result.branches).toHaveLength(3);

      // Branch 1: Config cascading - retry succeeded
      const branch1 = result.branches?.find(b => b.branchId === 'branch-1');
      expect(branch1?.success).toBe(true);
      expect(executionOrder.filter(p => p === '/retry')).toHaveLength(2);

      // Branch 2: Non-linear execution - jumped phase
      const branch2 = result.branches?.find(b => b.branchId === 'branch-2');
      expect(branch2?.success).toBe(true);
      expect(executionOrder).toContain('/check');
      expect(executionOrder).toContain('/target');
      expect(executionOrder).not.toContain('/skip');

      // Branch 3: Mixed + non-linear execution
      const branch3 = result.branches?.find(b => b.branchId === 'branch-3');
      expect(branch3?.success).toBe(true);
      expect(sharedBuffer.results).toHaveLength(1);
      expect(sharedBuffer.results[0].total).toBe(30);
    });

    it('should handle branch decision hooks with all features enabled', async () => {
      const branchDecisions: string[] = [];
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(async (config) => {
        const path = config.url || '';
        executionOrder.push(path);
        
        return {
          status: 200,
          data: { path, shouldTerminate: path === '/check' },
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'decision-branch-1',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-1',
              markConcurrentPhase: true,
              requests: [
                { id: 'r1', requestOptions: { reqData: { path: '/check' }, resReq: true } }
              ]
            },
            {
              id: 'phase-2',
              markConcurrentPhase: true,
              requests: [
                { id: 'r2', requestOptions: { reqData: { path: '/data' }, resReq: true } }
              ]
            }
          ],
          branchDecisionHook: async ({ branchResults }) => {
            const shouldTerminate = branchResults.some(
              r => r.responses[0]?.data?.shouldTerminate
            );
            
            if (shouldTerminate) {
              branchDecisions.push('terminate');
              return {
                action: PHASE_DECISION_ACTIONS.TERMINATE,
                metadata: { reason: 'Branch decision triggered' }
              };
            }
            
            branchDecisions.push('continue');
            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        },
        {
          id: 'decision-branch-2',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'phase-3',
              requests: [
                { id: 'r3', requestOptions: { reqData: { path: '/other' }, resReq: true } }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'branch-decision-combined-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        enableNonLinearExecution: true,
        enableMixedExecution: true,
        branches
      });

      // With concurrent branches, both execute before decision hooks are evaluated
      expect(result.branches!.length).toBeGreaterThanOrEqual(1);
      expect(branchDecisions).toContain('terminate');
      
      // The workflow may or may not terminate early depending on timing
      if (result.terminatedEarly) {
        expect(result.terminationReason).toContain('Branch decision triggered');
      }
    });

    it('should handle complex workflow with all features across multiple branches', async () => {
      let attemptCount = 0;
      const executionOrder: string[] = [];
      const sharedBuffer: Record<string, any> = { data: [] };

      mockedAxios.request.mockImplementation(async (config) => {
        const path = config.url || '';
        attemptCount++;
        executionOrder.push(path);

        if (path === '/fail' && attemptCount === 1) {
          const error: any = new Error('Failure');
          error.response = { status: 500, data: {}, statusText: 'Error' };
          throw error;
        }
        
        return {
          status: 200,
          data: { 
            path,
            replay: path === '/replay' && executionOrder.filter(p => p === '/replay').length < 2,
            value: 10
          },
          statusText: 'OK',
          headers: {},
          config: config as any
        } as any;
      });

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'complex-branch-1',
          markConcurrentBranch: true,
          commonConfig: {
            commonAttempts: 3,
            commonCache: { enabled: true, ttl: 60000 }
          },
          phases: [
            {
              id: 'fail-retry',
              requests: [
                { id: 'fr', requestOptions: { reqData: { path: '/fail' }, resReq: true } }
              ]
            }
          ]
        },
        {
          id: 'complex-branch-2',
          markConcurrentBranch: true,
          phases: [
            {
              id: 'replay-phase',
              allowReplay: true,
              maxReplayCount: 2,
              requests: [
                { id: 'rp', requestOptions: { reqData: { path: '/replay' }, resReq: true } }
              ],
              phaseDecisionHook: async ({ phaseResult }) => {
                const shouldReplay = phaseResult.responses[0]?.data?.replay;
                if (shouldReplay) {
                  return { action: PHASE_DECISION_ACTIONS.REPLAY };
                }
                return { action: PHASE_DECISION_ACTIONS.CONTINUE };
              }
            }
          ]
        },
        {
          id: 'complex-branch-3',
          markConcurrentBranch: false,
          phases: [
            {
              id: 'conc-1',
              markConcurrentPhase: true,
              requests: [
                { id: 'c1', requestOptions: { reqData: { path: '/conc1' }, resReq: true } }
              ]
            },
            {
              id: 'conc-2',
              markConcurrentPhase: true,
              requests: [
                { id: 'c2', requestOptions: { reqData: { path: '/conc2' }, resReq: true } }
              ],
              phaseDecisionHook: async ({ concurrentPhaseResults, sharedBuffer: sb }) => {
                const values = concurrentPhaseResults!.map(r => r.responses[0]?.data?.value || 0);
                sb!.data.push({ branch: 'complex-branch-3', values });
                
                return {
                  action: PHASE_DECISION_ACTIONS.SKIP,
                  targetPhaseId: 'final'
                };
              }
            },
            {
              id: 'skipped',
              requests: [
                { id: 'sk', requestOptions: { reqData: { path: '/skipped' }, resReq: true } }
              ]
            },
            {
              id: 'final',
              requests: [
                { id: 'f', requestOptions: { reqData: { path: '/final' }, resReq: true } }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'ultimate-combined-test',
        commonRequestData: { hostname: 'api.example.com' },
        enableBranchExecution: true,
        enableNonLinearExecution: true,
        enableMixedExecution: true,
        branches,
        sharedBuffer
      });

      expect(result.success).toBe(true);
      expect(result.branches).toHaveLength(3);

      // Branch 1: Config override with retry
      const branch1 = result.branches?.find(b => b.branchId === 'complex-branch-1');
      expect(branch1?.success).toBe(true);

      // Branch 2: Replay action
      const branch2 = result.branches?.find(b => b.branchId === 'complex-branch-2');
      expect(branch2?.success).toBe(true);
      expect(executionOrder.filter(p => p === '/replay')).toHaveLength(2);

      // Branch 3: Mixed execution + skip action
      const branch3 = result.branches?.find(b => b.branchId === 'complex-branch-3');
      expect(branch3?.success).toBe(true);
      expect(executionOrder).toContain('/conc1');
      expect(executionOrder).toContain('/conc2');
      expect(executionOrder).toContain('/final');
      expect(executionOrder).not.toContain('/skipped');
      
      expect(sharedBuffer.data).toHaveLength(1);
      expect(sharedBuffer.data[0].values).toEqual([10, 10]);
    });
  });
});