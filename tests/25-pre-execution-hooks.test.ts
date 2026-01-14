/**
 * Test Suite: Pre-Execution Hooks (Phase and Branch)
 * 
 * Tests the prePhaseExecutionHook and preBranchExecutionHook functionality
 * for dynamically modifying phase and branch configurations at runtime.
 */

import { describe, it, expect } from '@jest/globals';
import {
  stableWorkflow,
  REQUEST_METHODS,
  type STABLE_WORKFLOW_PHASE,
  type STABLE_WORKFLOW_BRANCH,
  type PrePhaseExecutionHookOptions,
  type PreBranchExecutionHookOptions,
} from '../src/index.js';

describe('Pre-Execution Hooks', () => {
  
  // ===========================================================================
  // prePhaseExecutionHook Tests
  // ===========================================================================
  
  describe('prePhaseExecutionHook', () => {
    
    it('should modify phase configuration before execution', async () => {
      interface State {
        phaseConfigModified: boolean;
      }

      const state: State = {
        phaseConfigModified: false
      };

      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'test-phase',
          requests: [
            {
              id: 'test-req',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  path: '/users/1',
                  method: REQUEST_METHODS.GET
                },
                resReq: true
              }
            }
          ]
        }
      ];

      const result = await stableWorkflow(phases, {
        workflowId: 'test-pre-phase-hook',
        enableNonLinearExecution: true,
        sharedBuffer: state,
        prePhaseExecutionHook: async (options: PrePhaseExecutionHookOptions) => {
          const { phase, sharedBuffer } = options;
          const buffer = sharedBuffer as State;
          
          buffer.phaseConfigModified = true;
          
          // Return modified phase with rate limiting
          return {
            ...phase,
            rateLimit: {
              maxRequests: 10,
              windowMs: 5000
            }
          };
        }
      });

      expect(result.success).toBe(true);
      expect(state.phaseConfigModified).toBe(true);
    });

    it('should add circuit breaker configuration dynamically', async () => {
      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'phase-1',
          requests: [
            {
              id: 'req-1',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  path: '/users/1',
                  method: REQUEST_METHODS.GET
                },
                resReq: true
              }
            }
          ]
        }
      ];

      const result = await stableWorkflow(phases, {
        workflowId: 'test-circuit-breaker',
        enableNonLinearExecution: true,
        prePhaseExecutionHook: async ({ phase, phaseId }) => {
          if (phaseId === 'phase-1') {
            return {
              ...phase,
              circuitBreaker: {
                failureThresholdPercentage: 50,
                minimumRequests: 3,
                recoveryTimeoutMs: 10000
              }
            };
          }
          return phase;
        }
      });

      expect(result.success).toBe(true);
    });

    it('should modify maxConcurrentRequests based on phase index', async () => {
      interface State {
        phase1Concurrency: number;
        phase2Concurrency: number;
      }

      const state: State = {
        phase1Concurrency: 0,
        phase2Concurrency: 0
      };

      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'phase-1',
          requests: [
            {
              id: 'req-1',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  path: '/users/1',
                  method: REQUEST_METHODS.GET
                },
                resReq: true
              }
            }
          ]
        },
        {
          id: 'phase-2',
          requests: [
            {
              id: 'req-2',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  path: '/users/2',
                  method: REQUEST_METHODS.GET
                },
                resReq: true
              }
            }
          ]
        }
      ];

      const result = await stableWorkflow(phases, {
        workflowId: 'test-concurrency',
        enableNonLinearExecution: true,
        sharedBuffer: state,
        prePhaseExecutionHook: async ({ phase, phaseIndex, sharedBuffer }) => {
          const buffer = sharedBuffer as State;
          
          // Set different concurrency levels based on phase index
          const modifiedPhase = { ...phase };
          
          if (phaseIndex === 0) {
            modifiedPhase.maxConcurrentRequests = 5;
            buffer.phase1Concurrency = 5;
          } else if (phaseIndex === 1) {
            modifiedPhase.maxConcurrentRequests = 10;
            buffer.phase2Concurrency = 10;
          }
          
          return modifiedPhase;
        }
      });

      expect(result.success).toBe(true);
      expect(state.phase1Concurrency).toBe(5);
      expect(state.phase2Concurrency).toBe(10);
    });

    it('should modify phase based on workflow state', async () => {
      interface State {
        isHighPriority: boolean;
        rateLimitApplied: boolean;
      }

      const state: State = {
        isHighPriority: true,
        rateLimitApplied: false
      };

      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'adaptive-phase',
          requests: [
            {
              id: 'req',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  path: '/users/1',
                  method: REQUEST_METHODS.GET
                },
                resReq: true
              }
            }
          ]
        }
      ];

      const result = await stableWorkflow(phases, {
        workflowId: 'test-adaptive',
        enableNonLinearExecution: true,
        sharedBuffer: state,
        prePhaseExecutionHook: async ({ phase, sharedBuffer }) => {
          const buffer = sharedBuffer as State;
          
          if (!buffer.isHighPriority) {
            buffer.rateLimitApplied = true;
            return {
              ...phase,
              rateLimit: {
                maxRequests: 2,
                windowMs: 10000
              }
            };
          }
          
          return phase;
        }
      });

      expect(result.success).toBe(true);
      expect(state.rateLimitApplied).toBe(false); // High priority, no rate limit
    });

    it('should pass custom params to prePhaseExecutionHook', async () => {
      interface State {
        receivedParams: any;
      }

      const state: State = {
        receivedParams: null
      };

      const customParams = {
        environment: 'production',
        tier: 'premium'
      };

      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'param-test-phase',
          requests: [
            {
              id: 'req',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  path: '/users/1',
                  method: REQUEST_METHODS.GET
                },
                resReq: true
              }
            }
          ]
        }
      ];

      const result = await stableWorkflow(phases, {
        workflowId: 'test-params',
        enableNonLinearExecution: true,
        sharedBuffer: state,
        workflowHookParams: {
          prePhaseExecutionHookParams: customParams
        },
        prePhaseExecutionHook: async ({ phase, params, sharedBuffer }) => {
          const buffer = sharedBuffer as State;
          buffer.receivedParams = params;
          return phase;
        }
      });

      expect(result.success).toBe(true);
      expect(state.receivedParams).toEqual(customParams);
    });

    it('should handle prePhaseExecutionHook errors gracefully', async () => {
      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'error-test-phase',
          requests: [
            {
              id: 'req',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  path: '/users/1',
                  method: REQUEST_METHODS.GET
                },
                resReq: true
              }
            }
          ]
        }
      ];

      const result = await stableWorkflow(phases, {
        workflowId: 'test-error-handling',
        enableNonLinearExecution: true,
        prePhaseExecutionHook: async ({ phase }) => {
          throw new Error('Hook error');
        }
      });

      // Should continue execution even if hook fails
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // preBranchExecutionHook Tests
  // ===========================================================================
  
  describe('preBranchExecutionHook', () => {
    
    it('should modify branch configuration before execution', async () => {
      interface State {
        branchConfigModified: boolean;
      }

      const state: State = {
        branchConfigModified: false
      };

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'test-branch',
          phases: [
            {
              id: 'phase',
              requests: [
                {
                  id: 'req',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: '/users/1',
                      method: REQUEST_METHODS.GET
                    },
                    resReq: true
                  }
                }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'test-pre-branch-hook',
        enableBranchExecution: true,
        branches,
        sharedBuffer: state,
        preBranchExecutionHook: async (options: PreBranchExecutionHookOptions) => {
          const { branch, sharedBuffer } = options;
          const buffer = sharedBuffer as State;
          
          buffer.branchConfigModified = true;
          
          // Return modified branch
          return branch;
        }
      });

      expect(result.success).toBe(true);
      expect(state.branchConfigModified).toBe(true);
    });

    it('should modify branch phases dynamically', async () => {
      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'modifiable-branch',
          phases: [
            {
              id: 'original-phase',
              requests: [
                {
                  id: 'req',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: '/users/1',
                      method: REQUEST_METHODS.GET
                    },
                    resReq: true
                  }
                }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'test-branch-phase-mod',
        enableBranchExecution: true,
        branches,
        preBranchExecutionHook: async ({ branch }) => {
          // Modify phases with rate limiting
          const modifiedBranch = {
            ...branch,
            phases: branch.phases.map(phase => ({
              ...phase,
              rateLimit: {
                maxRequests: 5,
                windowMs: 10000
              }
            }))
          };
          
          return modifiedBranch;
        }
      });

      expect(result.success).toBe(true);
    });

    it('should apply different configurations based on branch index', async () => {
      interface State {
        branch0Config: string;
        branch1Config: string;
      }

      const state: State = {
        branch0Config: '',
        branch1Config: ''
      };

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'branch-0',
          phases: [
            {
              id: 'phase',
              requests: [
                {
                  id: 'req',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: '/users/1',
                      method: REQUEST_METHODS.GET
                    },
                    resReq: true
                  }
                }
              ]
            }
          ]
        },
        {
          id: 'branch-1',
          phases: [
            {
              id: 'phase',
              requests: [
                {
                  id: 'req',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: '/users/2',
                      method: REQUEST_METHODS.GET
                    },
                    resReq: true
                  }
                }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'test-branch-index',
        enableBranchExecution: true,
        branches,
        sharedBuffer: state,
        preBranchExecutionHook: async ({ branch, branchIndex, sharedBuffer }) => {
          const buffer = sharedBuffer as State;
          
          if (branchIndex === 0) {
            buffer.branch0Config = 'high-priority';
            return {
              ...branch,
              commonConfig: {
                commonAttempts: 5
              }
            };
          } else {
            buffer.branch1Config = 'low-priority';
            return {
              ...branch,
              commonConfig: {
                commonAttempts: 2
              }
            };
          }
        }
      });

      expect(result.success).toBe(true);
      expect(state.branch0Config).toBe('high-priority');
      expect(state.branch1Config).toBe('low-priority');
    });

    it('should apply environment-based configurations', async () => {
      interface State {
        environment: 'development' | 'production';
        productionConfigApplied: boolean;
      }

      const state: State = {
        environment: 'production',
        productionConfigApplied: false
      };

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'api-branch',
          phases: [
            {
              id: 'api-call',
              requests: [
                {
                  id: 'req',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: '/users/1',
                      method: REQUEST_METHODS.GET
                    },
                    resReq: true
                  }
                }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'test-environment',
        enableBranchExecution: true,
        branches,
        sharedBuffer: state,
        preBranchExecutionHook: async ({ branch, sharedBuffer }) => {
          const buffer = sharedBuffer as State;
          
          if (buffer.environment === 'production') {
            buffer.productionConfigApplied = true;
            
            return {
              ...branch,
              phases: branch.phases.map(phase => ({
                ...phase,
                rateLimit: {
                  maxRequests: 5,
                  windowMs: 10000
                },
                circuitBreaker: {
                  failureThresholdPercentage: 50,
                  minimumRequests: 3,
                  recoveryTimeoutMs: 30000
                }
              }))
            };
          }
          
          return branch;
        }
      });

      expect(result.success).toBe(true);
      expect(state.productionConfigApplied).toBe(true);
    });

    it('should pass custom params to preBranchExecutionHook', async () => {
      interface State {
        receivedParams: any;
      }

      const state: State = {
        receivedParams: null
      };

      const customParams = {
        serviceTier: 'premium',
        region: 'us-east-1'
      };

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'param-test-branch',
          phases: [
            {
              id: 'phase',
              requests: [
                {
                  id: 'req',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: '/users/1',
                      method: REQUEST_METHODS.GET
                    },
                    resReq: true
                  }
                }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'test-branch-params',
        enableBranchExecution: true,
        branches,
        sharedBuffer: state,
        workflowHookParams: {
          preBranchExecutionHookParams: customParams
        },
        preBranchExecutionHook: async ({ branch, params, sharedBuffer }) => {
          const buffer = sharedBuffer as State;
          buffer.receivedParams = params;
          return branch;
        }
      });

      expect(result.success).toBe(true);
      expect(state.receivedParams).toEqual(customParams);
    });
  });

  // ===========================================================================
  // Combined Hook Tests
  // ===========================================================================
  
  describe('Combined prePhaseExecutionHook and preBranchExecutionHook', () => {
    
    it('should apply both branch and phase hooks in workflow', async () => {
      interface State {
        branchHookCalled: boolean;
        phaseHookCalled: boolean;
      }

      const state: State = {
        branchHookCalled: false,
        phaseHookCalled: false
      };

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'combined-branch',
          phases: [
            {
              id: 'combined-phase',
              requests: [
                {
                  id: 'req',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: '/users/1',
                      method: REQUEST_METHODS.GET
                    },
                    resReq: true
                  }
                }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'test-combined-hooks',
        enableBranchExecution: true,
        branches,
        sharedBuffer: state,
        preBranchExecutionHook: async ({ branch, sharedBuffer }) => {
          const buffer = sharedBuffer as State;
          buffer.branchHookCalled = true;
          return branch;
        },
        prePhaseExecutionHook: async ({ phase, sharedBuffer }) => {
          const buffer = sharedBuffer as State;
          buffer.phaseHookCalled = true;
          return phase;
        }
      });

      expect(result.success).toBe(true);
      expect(state.branchHookCalled).toBe(true);
      expect(state.phaseHookCalled).toBe(true);
    });

    it('should apply cascading configurations from branch to phase', async () => {
      interface State {
        branchRetries: number;
        phaseRetries: number;
        phaseConcurrency: number;
      }

      const state: State = {
        branchRetries: 0,
        phaseRetries: 0,
        phaseConcurrency: 0
      };

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'cascade-branch',
          phases: [
            {
              id: 'cascade-phase',
              requests: [
                {
                  id: 'req',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: '/users/1',
                      method: REQUEST_METHODS.GET
                    },
                    resReq: true
                  }
                }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'test-cascade',
        enableBranchExecution: true,
        branches,
        sharedBuffer: state,
        preBranchExecutionHook: async ({ branch, sharedBuffer }) => {
          const buffer = sharedBuffer as State;
          buffer.branchRetries = 3;
          
          return {
            ...branch,
            commonConfig: {
              commonAttempts: 3
            }
          };
        },
        prePhaseExecutionHook: async ({ phase, sharedBuffer }) => {
          const buffer = sharedBuffer as State;
          buffer.phaseRetries = 5;
          buffer.phaseConcurrency = 10;
          
          return {
            ...phase,
            maxConcurrentRequests: 10,
            commonConfig: {
              ...(phase.commonConfig || {}),
              commonAttempts: 5 // Override branch-level retries
            }
          };
        }
      });

      expect(result.success).toBe(true);
      expect(state.branchRetries).toBe(3);
      expect(state.phaseRetries).toBe(5);
      expect(state.phaseConcurrency).toBe(10);
    });

    it('should handle time-based and tier-based configurations together', async () => {
      interface State {
        timeOfDay: 'peak' | 'off-peak';
        serviceTier: 'premium' | 'standard';
        branchRateLimit: number;
        phaseRateLimit: number;
      }

      const state: State = {
        timeOfDay: 'peak',
        serviceTier: 'premium',
        branchRateLimit: 0,
        phaseRateLimit: 0
      };

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'adaptive-branch',
          phases: [
            {
              id: 'adaptive-phase',
              requests: [
                {
                  id: 'req',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: '/users/1',
                      method: REQUEST_METHODS.GET
                    },
                    resReq: true
                  }
                }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'test-adaptive-config',
        enableBranchExecution: true,
        branches,
        sharedBuffer: state,
        preBranchExecutionHook: async ({ branch, sharedBuffer }) => {
          const buffer = sharedBuffer as State;
          
          // Apply tier-based config at branch level
          const branchRateLimit = buffer.serviceTier === 'premium' ? 100 : 50;
          buffer.branchRateLimit = branchRateLimit;
          
          return branch;
        },
        prePhaseExecutionHook: async ({ phase, sharedBuffer }) => {
          const buffer = sharedBuffer as State;
          
          // Apply time-based config at phase level
          const phaseRateLimit = buffer.timeOfDay === 'peak' ? 10 : 50;
          buffer.phaseRateLimit = phaseRateLimit;
          
          return {
            ...phase,
            rateLimit: {
              maxRequests: phaseRateLimit,
              windowMs: 10000
            }
          };
        }
      });

      expect(result.success).toBe(true);
      expect(state.branchRateLimit).toBe(100); // premium tier
      expect(state.phaseRateLimit).toBe(10); // peak hours
    });
  });

  // ===========================================================================
  // State Persistence Tests for Pre-Execution Hooks
  // ===========================================================================

  describe('State Persistence in Pre-Execution Hooks', () => {
    
    it('should persist state for prePhaseExecutionHook', async () => {
      let persistCallCount = 0;

      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'persist-phase',
          statePersistence: {
            persistenceFunction: async (options) => {
              persistCallCount++;
              // Return the buffer as expected
              return options.buffer;
            },
            loadBeforeHooks: true,
            storeAfterHooks: true
          },
          requests: [
            {
              id: 'req',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  path: '/users/1',
                  method: REQUEST_METHODS.GET
                },
                resReq: true
              }
            }
          ]
        }
      ];

      const result = await stableWorkflow(phases, {
        workflowId: 'test-phase-persistence',
        prePhaseExecutionHook: async (options: PrePhaseExecutionHookOptions) => {
          const { phase } = options;
          return {
            ...phase,
            rateLimit: {
              maxRequests: 20,
              windowMs: 5000
            }
          };
        }
      });

      expect(result.success).toBe(true);
      // Should be called at least twice (once for load, once for store)
      expect(persistCallCount).toBeGreaterThanOrEqual(2);
    });

    it('should persist state for preBranchExecutionHook', async () => {
      let persistCallCount = 0;

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'persist-branch',
          statePersistence: {
            persistenceFunction: async (options) => {
              persistCallCount++;
              return options.buffer;
            },
            loadBeforeHooks: true,
            storeAfterHooks: true
          },
          phases: [
            {
              id: 'phase-in-branch',
              requests: [
                {
                  id: 'req',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: '/users/1',
                      method: REQUEST_METHODS.GET
                    },
                    resReq: true
                  }
                }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'test-branch-persistence',
        enableBranchExecution: true,
        branches,
        preBranchExecutionHook: async (options: PreBranchExecutionHookOptions) => {
          const { branch } = options;
          return {
            ...branch,
            rateLimit: {
              maxRequests: 15,
              windowMs: 3000
            }
          };
        }
      });

      expect(result.success).toBe(true);
      // Should be called at least twice (once for load, once for store)
      expect(persistCallCount).toBeGreaterThanOrEqual(2);
    });

    it('should pass correct context to persistence function in prePhaseExecutionHook', async () => {
      let capturedContext: any = null;

      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'context-phase',
          statePersistence: {
            persistenceFunction: async (options) => {
              if (!capturedContext) {
                capturedContext = options.executionContext;
              }
              return {};
            },
            loadBeforeHooks: true
          },
          requests: [
            {
              id: 'req',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  path: '/users/1',
                  method: REQUEST_METHODS.GET
                },
                resReq: true
              }
            }
          ]
        }
      ];

      await stableWorkflow(phases, {
        workflowId: 'test-context-phase',
        prePhaseExecutionHook: async (options: PrePhaseExecutionHookOptions) => {
          return options.phase;
        }
      });

      expect(capturedContext).not.toBeNull();
      expect(capturedContext).toMatchObject({
        workflowId: 'test-context-phase',
        phaseId: 'context-phase'
      });
    });

    it('should pass correct context to persistence function in preBranchExecutionHook', async () => {
      let capturedContext: any = null;

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'context-branch',
          statePersistence: {
            persistenceFunction: async (options) => {
              if (!capturedContext) {
                capturedContext = options.executionContext;
              }
              return {};
            },
            loadBeforeHooks: true
          },
          phases: [
            {
              id: 'phase',
              requests: [
                {
                  id: 'req',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: '/users/1',
                      method: REQUEST_METHODS.GET
                    },
                    resReq: true
                  }
                }
              ]
            }
          ]
        }
      ];

      await stableWorkflow([], {
        workflowId: 'test-context-branch',
        enableBranchExecution: true,
        branches,
        preBranchExecutionHook: async (options: PreBranchExecutionHookOptions) => {
          return options.branch;
        }
      });

      expect(capturedContext).not.toBeNull();
      expect(capturedContext).toMatchObject({
        workflowId: 'test-context-branch',
        branchId: 'context-branch'
      });
    });

    it('should restore persisted state in prePhaseExecutionHook on subsequent runs', async () => {
      let storedPhaseState: any = { modified: true };

      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'restore-phase',
          statePersistence: {
            persistenceFunction: async (options) => {
              const buffer = options.buffer || {};
              if (Object.keys(buffer).length === 0) {
                // LOAD mode - return previously stored state
                return storedPhaseState;
              } else {
                // STORE mode
                storedPhaseState = buffer;
                return buffer;
              }
            },
            loadBeforeHooks: true,
            storeAfterHooks: true
          },
          requests: [
            {
              id: 'req',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  path: '/users/1',
                  method: REQUEST_METHODS.GET
                },
                resReq: true
              }
            }
          ]
        }
      ];

      const result = await stableWorkflow(phases, {
        workflowId: 'test-restore-phase',
        prePhaseExecutionHook: async (options: PrePhaseExecutionHookOptions) => {
          return options.phase;
        }
      });

      expect(result.success).toBe(true);
      expect(storedPhaseState).toBeTruthy();
    });

    it('should restore persisted state in preBranchExecutionHook on subsequent runs', async () => {
      let storedBranchState: any = { modified: true };

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'restore-branch',
          statePersistence: {
            persistenceFunction: async (options) => {
              const buffer = options.buffer || {};
              if (Object.keys(buffer).length === 0) {
                // LOAD mode - return previously stored state
                return storedBranchState;
              } else {
                // STORE mode
                storedBranchState = buffer;
                return buffer;
              }
            },
            loadBeforeHooks: true,
            storeAfterHooks: true
          },
          phases: [
            {
              id: 'phase',
              requests: [
                {
                  id: 'req',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: '/users/1',
                      method: REQUEST_METHODS.GET
                    },
                    resReq: true
                  }
                }
              ]
            }
          ]
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'test-restore-branch',
        enableBranchExecution: true,
        branches,
        preBranchExecutionHook: async (options: PreBranchExecutionHookOptions) => {
          return options.branch;
        }
      });

      expect(result.success).toBe(true);
      expect(storedBranchState).toBeTruthy();
    });
  });
});
