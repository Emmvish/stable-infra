import { describe, it, expect } from '@jest/globals';
import {
  stableWorkflow,
  REQUEST_METHODS,
  PHASE_DECISION_ACTIONS,
  type STABLE_WORKFLOW_PHASE,
  type STABLE_WORKFLOW_BRANCH,
} from '../src/index.js';

describe('Dynamic Phase and Branch Addition', () => {
  
  // ===========================================================================
  // Phase Addition Tests
  // ===========================================================================
  
  describe('Dynamic Phase Addition', () => {
    
    it('should add phases dynamically using phaseDecisionHook', async () => {
      interface State {
        phase1Executed: boolean;
        dynamicPhaseExecuted: boolean;
      }

      const state: State = {
        phase1Executed: false,
        dynamicPhaseExecuted: false
      };

      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'initial-phase',
          requests: [
            {
              id: 'req1',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  path: '/users/1',
                  method: REQUEST_METHODS.GET
                },
                resReq: true,
                logAllSuccessfulAttempts: true,
                handleSuccessfulAttemptData: ({ commonBuffer }) => {
                  if (commonBuffer) {
                    const buffer = commonBuffer as State;
                    buffer.phase1Executed = true;
                  }
                }
              }
            }
          ],
          phaseDecisionHook: async () => {
            // Add a dynamic phase
            const dynamicPhase: STABLE_WORKFLOW_PHASE = {
              id: 'dynamic-phase',
              requests: [
                {
                  id: 'dynamic-req',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: '/users/2',
                      method: REQUEST_METHODS.GET
                    },
                    resReq: true,
                logAllSuccessfulAttempts: true,
                    handleSuccessfulAttemptData: ({ commonBuffer }) => {
                      const buffer = commonBuffer as State;
                      buffer.dynamicPhaseExecuted = true;
                    }
                  }
                }
              ]
            };

            return {
              action: PHASE_DECISION_ACTIONS.CONTINUE,
              addPhases: [dynamicPhase]
            };
          }
        },
        {
          id: 'final-phase',
          requests: [
            {
              id: 'final-req',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  path: '/users/3',
                  method: REQUEST_METHODS.GET
                },
                resReq: true
              }
            }
          ]
        }
      ];

      const result = await stableWorkflow(phases, {
        workflowId: 'test-dynamic-phase',
        enableNonLinearExecution: true,
        sharedBuffer: state
      });

      expect(result.success).toBe(true);
      expect(result.totalPhases).toBe(3); // initial + dynamic + final
      expect(state.phase1Executed).toBe(true);
      expect(state.dynamicPhaseExecuted).toBe(true);
    });

    it('should add multiple phases dynamically', async () => {
      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'phase1',
          requests: [
            {
              id: 'req1',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  path: '/users/1',
                  method: REQUEST_METHODS.GET
                },
                resReq: true
              }
            }
          ],
          phaseDecisionHook: async () => {
            return {
              action: PHASE_DECISION_ACTIONS.CONTINUE,
              addPhases: [
                {
                  id: 'dynamic-phase-1',
                  requests: [
                    {
                      id: 'dyn-req-1',
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
                },
                {
                  id: 'dynamic-phase-2',
                  requests: [
                    {
                      id: 'dyn-req-2',
                      requestOptions: {
                        reqData: {
                          hostname: 'jsonplaceholder.typicode.com',
                          path: '/users/3',
                          method: REQUEST_METHODS.GET
                        },
                        resReq: true
                      }
                    }
                  ]
                }
              ]
            };
          }
        }
      ];

      const result = await stableWorkflow(phases, {
        workflowId: 'test-multiple-dynamic-phases',
        enableNonLinearExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.totalPhases).toBe(3); // 1 original + 2 dynamic
    });

    it('should add phases conditionally based on sharedBuffer state', async () => {
      interface State {
        condition: boolean;
        conditionalPhaseExecuted: boolean;
      }

      const state: State = {
        condition: true,
        conditionalPhaseExecuted: false
      };

      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'decision-phase',
          requests: [
            {
              id: 'req1',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  path: '/users/1',
                  method: REQUEST_METHODS.GET
                },
                resReq: true
              }
            }
          ],
          phaseDecisionHook: async ({ sharedBuffer }) => {
            const buffer = sharedBuffer as State;
            
            if (buffer.condition) {
              return {
                action: PHASE_DECISION_ACTIONS.CONTINUE,
                addPhases: [
                  {
                    id: 'conditional-phase',
                    requests: [
                      {
                        id: 'conditional-req',
                        requestOptions: {
                          reqData: {
                            hostname: 'jsonplaceholder.typicode.com',
                            path: '/users/2',
                            method: REQUEST_METHODS.GET
                          },
                          resReq: true,
                logAllSuccessfulAttempts: true,
                          handleSuccessfulAttemptData: ({ commonBuffer }) => {
                            const buf = commonBuffer as State;
                            buf.conditionalPhaseExecuted = true;
                          }
                        }
                      }
                    ]
                  }
                ]
              };
            }

            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        }
      ];

      const result = await stableWorkflow(phases, {
        workflowId: 'test-conditional-phase',
        enableNonLinearExecution: true,
        sharedBuffer: state
      });

      expect(result.success).toBe(true);
      expect(state.conditionalPhaseExecuted).toBe(true);
    });

    it('should add phases based on phase result data', async () => {
      interface State {
        needsExtraProcessing: boolean;
        extraProcessingDone: boolean;
      }

      const state: State = {
        needsExtraProcessing: false,
        extraProcessingDone: false
      };

      const phases: STABLE_WORKFLOW_PHASE[] = [
        {
          id: 'data-fetch',
          requests: [
            {
              id: 'fetch',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  path: '/users',
                  method: REQUEST_METHODS.GET
                },
                resReq: true
              }
            }
          ],
          phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
            const buffer = sharedBuffer as State;
            const response = phaseResult.responses[0];
            const data = response.data;
            
            // Check if data requires extra processing
            if (Array.isArray(data) && data.length > 5) {
              buffer.needsExtraProcessing = true;
              
              return {
                action: PHASE_DECISION_ACTIONS.CONTINUE,
                addPhases: [
                  {
                    id: 'extra-processing',
                    requests: [
                      {
                        id: 'process',
                        requestOptions: {
                          reqData: {
                            hostname: 'jsonplaceholder.typicode.com',
                            path: '/posts/1',
                            method: REQUEST_METHODS.GET
                          },
                          resReq: true,
                logAllSuccessfulAttempts: true,
                          handleSuccessfulAttemptData: ({ commonBuffer }) => {
                            const buf = commonBuffer as State;
                            buf.extraProcessingDone = true;
                          }
                        }
                      }
                    ]
                  }
                ]
              };
            }

            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        }
      ];

      const result = await stableWorkflow(phases, {
        workflowId: 'test-result-based-phase',
        enableNonLinearExecution: true,
        sharedBuffer: state
      });

      expect(result.success).toBe(true);
      expect(state.needsExtraProcessing).toBe(true);
      expect(state.extraProcessingDone).toBe(true);
    });
  });

  // ===========================================================================
  // Branch Addition Tests
  // ===========================================================================
  
  describe('Dynamic Branch Addition', () => {
    
    it('should add branches dynamically using branchDecisionHook', async () => {
      interface State {
        mainBranchExecuted: boolean;
        dynamicBranchExecuted: boolean;
      }

      const state: State = {
        mainBranchExecuted: false,
        dynamicBranchExecuted: false
      };

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'main-branch',
          phases: [
            {
              id: 'main-phase',
              requests: [
                {
                  id: 'main-req',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: '/users/1',
                      method: REQUEST_METHODS.GET
                    },
                    resReq: true,
                logAllSuccessfulAttempts: true,
                    handleSuccessfulAttemptData: ({ commonBuffer }) => {
                      const buffer = commonBuffer as State;
                      buffer.mainBranchExecuted = true;
                    }
                  }
                }
              ]
            }
          ],
          branchDecisionHook: async () => {
            return {
              action: PHASE_DECISION_ACTIONS.CONTINUE,
              addBranches: [
                {
                  id: 'dynamic-branch',
                  phases: [
                    {
                      id: 'dynamic-phase',
                      requests: [
                        {
                          id: 'dynamic-req',
                          requestOptions: {
                            reqData: {
                              hostname: 'jsonplaceholder.typicode.com',
                              path: '/users/2',
                              method: REQUEST_METHODS.GET
                            },
                            resReq: true,
                logAllSuccessfulAttempts: true,
                            handleSuccessfulAttemptData: ({ commonBuffer }) => {
                              const buffer = commonBuffer as State;
                              buffer.dynamicBranchExecuted = true;
                            }
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            };
          }
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'test-dynamic-branch',
        enableBranchExecution: true,
        branches,
        sharedBuffer: state
      });

      expect(result.success).toBe(true);
      expect(result.branches?.length).toBe(2); // main + dynamic
      expect(state.mainBranchExecuted).toBe(true);
      expect(state.dynamicBranchExecuted).toBe(true);
    });

    it('should add multiple branches dynamically', async () => {
      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'starter-branch',
          phases: [
            {
              id: 'starter-phase',
              requests: [
                {
                  id: 'starter-req',
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
          ],
          branchDecisionHook: async () => {
            return {
              action: PHASE_DECISION_ACTIONS.CONTINUE,
              addBranches: [
                {
                  id: 'dynamic-branch-1',
                  phases: [
                    {
                      id: 'phase-1',
                      requests: [
                        {
                          id: 'req-1',
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
                },
                {
                  id: 'dynamic-branch-2',
                  phases: [
                    {
                      id: 'phase-2',
                      requests: [
                        {
                          id: 'req-2',
                          requestOptions: {
                            reqData: {
                              hostname: 'jsonplaceholder.typicode.com',
                              path: '/users/3',
                              method: REQUEST_METHODS.GET
                            },
                            resReq: true
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            };
          }
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'test-multiple-dynamic-branches',
        enableBranchExecution: true,
        branches
      });

      expect(result.success).toBe(true);
      expect(result.branches?.length).toBe(3); // 1 original + 2 dynamic
    });

    it('should add phases to current branch using addPhases in branchDecisionHook', async () => {
      interface State {
        dynamicPhaseInBranchExecuted: boolean;
      }

      const state: State = {
        dynamicPhaseInBranchExecuted: false
      };

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'expandable-branch',
          phases: [
            {
              id: 'initial-phase',
              requests: [
                {
                  id: 'initial-req',
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
          ],
          branchDecisionHook: async () => {
            return {
              action: PHASE_DECISION_ACTIONS.CONTINUE,
              addPhases: [
                {
                  id: 'dynamic-phase-in-branch',
                  requests: [
                    {
                      id: 'dynamic-req',
                      requestOptions: {
                        reqData: {
                          hostname: 'jsonplaceholder.typicode.com',
                          path: '/users/2',
                          method: REQUEST_METHODS.GET
                        },
                        resReq: true,
                        logAllSuccessfulAttempts: true,
                        handleSuccessfulAttemptData: ({ commonBuffer }) => {
                          const buffer = commonBuffer as State;
                          buffer.dynamicPhaseInBranchExecuted = true;
                        }
                      }
                    }
                  ]
                }
              ]
            };
          }
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'test-branch-phase-addition',
        enableBranchExecution: true,
        branches,
        sharedBuffer: state
      });

      expect(result.success).toBe(true);
      expect(state.dynamicPhaseInBranchExecuted).toBe(true);
    });
  });

  // ===========================================================================
  // Combined Phase and Branch Addition Tests
  // ===========================================================================
  
  describe('Combined Dynamic Addition', () => {
    
    it('should add both phases and branches in the same workflow', async () => {
      interface State {
        dynamicPhaseExecuted: boolean;
        dynamicBranchExecuted: boolean;
      }

      const state: State = {
        dynamicPhaseExecuted: false,
        dynamicBranchExecuted: false
      };

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'main-branch',
          phases: [
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
              ],
              phaseDecisionHook: async () => {
                // Add phase to current branch
                return {
                  action: PHASE_DECISION_ACTIONS.CONTINUE,
                  addPhases: [
                    {
                      id: 'dynamic-phase',
                      requests: [
                        {
                          id: 'dynamic-req',
                          requestOptions: {
                            reqData: {
                              hostname: 'jsonplaceholder.typicode.com',
                              path: '/users/2',
                              method: REQUEST_METHODS.GET
                            },
                            resReq: true,
                logAllSuccessfulAttempts: true,
                            handleSuccessfulAttemptData: ({ commonBuffer }) => {
                              const buffer = commonBuffer as State;
                              buffer.dynamicPhaseExecuted = true;
                            }
                          }
                        }
                      ]
                    }
                  ]
                };
              }
            }
          ],
          branchDecisionHook: async () => {
            // Add new branch
            return {
              action: PHASE_DECISION_ACTIONS.CONTINUE,
              addBranches: [
                {
                  id: 'dynamic-branch',
                  phases: [
                    {
                      id: 'branch-phase',
                      requests: [
                        {
                          id: 'branch-req',
                          requestOptions: {
                            reqData: {
                              hostname: 'jsonplaceholder.typicode.com',
                              path: '/posts/1',
                              method: REQUEST_METHODS.GET
                            },
                            resReq: true,
                logAllSuccessfulAttempts: true,
                            handleSuccessfulAttemptData: ({ commonBuffer }) => {
                              const buffer = commonBuffer as State;
                              buffer.dynamicBranchExecuted = true;
                            }
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            };
          }
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'test-combined-addition',
        enableBranchExecution: true,
        branches,
        sharedBuffer: state
      });

      expect(result.success).toBe(true);
      expect(state.dynamicPhaseExecuted).toBe(true);
      expect(state.dynamicBranchExecuted).toBe(true);
    });

    it('should handle complex nested dynamic additions', async () => {
      interface State {
        executionPath: string[];
      }

      const state: State = {
        executionPath: []
      };

      const branches: STABLE_WORKFLOW_BRANCH[] = [
        {
          id: 'root-branch',
          phases: [
            {
              id: 'root-phase',
              requests: [
                {
                  id: 'root-req',
                  requestOptions: {
                    reqData: {
                      hostname: 'jsonplaceholder.typicode.com',
                      path: '/users/1',
                      method: REQUEST_METHODS.GET
                    },
                    resReq: true,
                logAllSuccessfulAttempts: true,
                    handleSuccessfulAttemptData: ({ commonBuffer }) => {
                      const buffer = commonBuffer as State;
                      buffer.executionPath.push('root-phase');
                    }
                  }
                }
              ],
              phaseDecisionHook: async ({ sharedBuffer }) => {
                const buffer = sharedBuffer as State;
                
                // Conditionally add phase based on execution path
                if (buffer.executionPath.includes('root-phase')) {
                  return {
                    action: PHASE_DECISION_ACTIONS.CONTINUE,
                    addPhases: [
                      {
                        id: 'nested-dynamic-phase',
                        requests: [
                          {
                            id: 'nested-req',
                            requestOptions: {
                              reqData: {
                                hostname: 'jsonplaceholder.typicode.com',
                                path: '/users/2',
                                method: REQUEST_METHODS.GET
                              },
                              resReq: true,
                logAllSuccessfulAttempts: true,
                              handleSuccessfulAttemptData: ({ commonBuffer }) => {
                                const buf = commonBuffer as State;
                                buf.executionPath.push('nested-dynamic-phase');
                              }
                            }
                          }
                        ]
                      }
                    ]
                  };
                }

                return { action: PHASE_DECISION_ACTIONS.CONTINUE };
              }
            }
          ],
          branchDecisionHook: async ({ sharedBuffer, branchResults }) => {
            const buffer = sharedBuffer as State;
            
            // Add branch if certain conditions are met
            if (branchResults.length > 0 && buffer.executionPath.length >= 2) {
              return {
                action: PHASE_DECISION_ACTIONS.CONTINUE,
                addBranches: [
                  {
                    id: 'conditional-branch',
                    phases: [
                      {
                        id: 'conditional-phase',
                        requests: [
                          {
                            id: 'conditional-req',
                            requestOptions: {
                              reqData: {
                                hostname: 'jsonplaceholder.typicode.com',
                                path: '/posts/1',
                                method: REQUEST_METHODS.GET
                              },
                              resReq: true,
                logAllSuccessfulAttempts: true,
                              handleSuccessfulAttemptData: ({ commonBuffer }) => {
                                const buf = commonBuffer as State;
                                buf.executionPath.push('conditional-branch');
                              }
                            }
                          }
                        ]
                      }
                    ]
                  }
                ]
              };
            }

            return { action: PHASE_DECISION_ACTIONS.CONTINUE };
          }
        }
      ];

      const result = await stableWorkflow([], {
        workflowId: 'test-nested-dynamic',
        enableBranchExecution: true,
        branches,
        sharedBuffer: state
      });

      expect(result.success).toBe(true);
      expect(state.executionPath).toContain('root-phase');
      expect(state.executionPath).toContain('nested-dynamic-phase');
      expect(state.executionPath).toContain('conditional-branch');
    });
  });
});
