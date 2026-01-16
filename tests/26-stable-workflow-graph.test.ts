import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  stableWorkflowGraph,
  WorkflowGraphBuilder,
  createLinearWorkflowGraph,
  validateWorkflowGraph,
  detectCycles,
  REQUEST_METHODS,
  WorkflowEdgeConditionTypes,
  PHASE_DECISION_ACTIONS,
  PhaseDecisionHookOptions, 
  PhaseExecutionDecision
} from '../src/index.js';

describe('stableWorkflowGraph - Graph-Based Workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Linear Workflow', () => {
    it('should execute a simple linear workflow with sequential phases', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              attempts: 1
            }
          }]
        })
        .addPhase('phase-2', {
          requests: [{
            id: 'req-2',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              attempts: 1
            }
          }]
        })
        .connectSequence('phase-1', 'phase-2')
        .setEntryPoint('phase-1')
        .build();

      const result = await stableWorkflowGraph(graph, {
        workflowId: 'linear-test'
      });

      expect(result.success).toBe(true);
      expect(result.phases.length).toBe(2);
      expect(result.totalRequests).toBe(2);
      expect(result.successfulRequests).toBe(2);
    });

    it('should work with createLinearWorkflowGraph helper', async () => {
      const phases = [
        {
          id: 'phase-1',
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/users/1' as `/${string}`,
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        },
        {
          id: 'phase-2',
          requests: [{
            id: 'req-2',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/users/2' as `/${string}`,
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        }
      ];

      const graph = createLinearWorkflowGraph(phases);
      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);
      expect(result.phases.length).toBe(2);
    });
  });

  describe('Parallel Execution', () => {
    it('should execute parallel phases using parallel-group node', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('fetch-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('fetch-2', {
          requests: [{
            id: 'req-2',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('fetch-3', {
          requests: [{
            id: 'req-3',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/3',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addParallelGroup('parallel', ['fetch-1', 'fetch-2', 'fetch-3'])
        .setEntryPoint('parallel')
        .build();

      const startTime = Date.now();
      const result = await stableWorkflowGraph(graph);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.phases.length).toBe(3);
      expect(result.totalRequests).toBe(3);
      
      // Parallel execution should be faster than sequential
      expect(duration).toBeLessThan(3000); // Should complete faster than 3 sequential requests
    });
  });

  describe('Merge Points', () => {
    it('should wait for multiple parallel branches to complete before continuing', async () => {
      const executionOrder: string[] = [];

      const graph = new WorkflowGraphBuilder()
        .addPhase('branch-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              logAllSuccessfulAttempts: true,
              handleSuccessfulAttemptData: async () => {
                executionOrder.push('branch-1');
              }
            }
          }]
        })
        .addPhase('branch-2', {
          requests: [{
            id: 'req-2',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              logAllSuccessfulAttempts: true,
              handleSuccessfulAttemptData: async () => {
                executionOrder.push('branch-2');
              }
            }
          }]
        })
        .addMergePoint('merge', ['branch-1', 'branch-2'])
        .addPhase('after-merge', {
          requests: [{
            id: 'req-3',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/3',
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              logAllSuccessfulAttempts: true,
              handleSuccessfulAttemptData: async () => {
                executionOrder.push('after-merge');
              }
            }
          }]
        })
        .addParallelGroup('parallel-start', ['branch-1', 'branch-2'])
        .connectSequence('parallel-start', 'merge', 'after-merge')
        .setEntryPoint('parallel-start')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);
      expect(executionOrder).toContain('branch-1');
      expect(executionOrder).toContain('branch-2');
      expect(executionOrder).toContain('after-merge');
      
      // after-merge should be last
      expect(executionOrder.indexOf('after-merge')).toBe(2);
    });
  });

  describe('Conditional Routing', () => {
    it('should route based on conditional evaluation', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('check', {
          requests: [{
            id: 'check-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addConditional('decision', async ({ results }) => {
          const checkResult = results.get('check');
          return checkResult?.success ? 'success-path' : 'failure-path';
        })
        .addPhase('success-path', {
          requests: [{
            id: 'success-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/users/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('failure-path', {
          requests: [{
            id: 'failure-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/users/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .connectSequence('check', 'decision')
        .setEntryPoint('check')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);
      expect(result.phases.length).toBe(2);
      
      // Should have executed success-path
      const successPhase = result.phases.find(p => p.phaseId === 'success-path');
      expect(successPhase).toBeDefined();
    });

    it('should support complex conditional logic with shared buffer', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('init', {
          requests: [{
            id: 'init-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              logAllSuccessfulAttempts: true,
              handleSuccessfulAttemptData: async ({ successfulAttemptData, commonBuffer }) => {
                commonBuffer!.postId = (successfulAttemptData.data as any).id;
              }
            }
          }]
        })
        .addConditional('route', async ({ sharedBuffer }) => {
          return sharedBuffer!.postId > 0 ? 'route-a' : 'route-b';
        })
        .addPhase('route-a', {
          requests: [{
            id: 'route-a-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/comments?postId=1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('route-b', {
          requests: [{
            id: 'route-b-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/users',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .connectSequence('init', 'route')
        .setEntryPoint('init')
        .build();

      const result = await stableWorkflowGraph(graph, {
        sharedBuffer: {}
      });

      expect(result.success).toBe(true);
      expect(result.phases.some(p => p.phaseId === 'route-a')).toBe(true);
    });
  });

  describe('Edge Conditions', () => {
    it('should support success/failure edge conditions', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('attempt', {
          requests: [{
            id: 'attempt-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('on-success', {
          requests: [{
            id: 'success-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/users/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('on-failure', {
          requests: [{
            id: 'failure-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/users/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .connect('attempt', 'on-success', {
          condition: { type: WorkflowEdgeConditionTypes.SUCCESS }
        })
        .connect('attempt', 'on-failure', {
          condition: { type: WorkflowEdgeConditionTypes.FAILURE }
        })
        .setEntryPoint('attempt')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);
      
      // Should execute on-success path
      const successPhase = result.phases.find(p => p.phaseId === 'on-success');
      expect(successPhase).toBeDefined();
      
      // Should NOT execute on-failure path
      const failurePhase = result.phases.find(p => p.phaseId === 'on-failure');
      expect(failurePhase).toBeUndefined();
    });

    it('should support custom edge conditions', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('check', {
          requests: [{
            id: 'check-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              logAllSuccessfulAttempts: true,
              handleSuccessfulAttemptData: async ({ commonBuffer }) => {
                commonBuffer!.value = 42;
              }
            }
          }]
        })
        .addPhase('conditional-phase', {
          requests: [{
            id: 'cond-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/users/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .connect('check', 'conditional-phase', {
          condition: {
            type: WorkflowEdgeConditionTypes.CUSTOM,
            evaluate: async ({ sharedBuffer }) => sharedBuffer!.value > 40
          }
        })
        .setEntryPoint('check')
        .build();

      const result = await stableWorkflowGraph(graph, {
        sharedBuffer: {}
      });

      expect(result.success).toBe(true);
      expect(result.phases.some(p => p.phaseId === 'conditional-phase')).toBe(true);
    });
  });

  describe('Graph Validation', () => {
    it('should validate graph structure before execution', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .setEntryPoint('phase-1')
        .build();

      const validation = validateWorkflowGraph(graph);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should detect missing entry point', () => {
      const builder = new WorkflowGraphBuilder()
        .addPhase('phase-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'test.com',
                path: '/test'
              }
            }
          }]
        });

      expect(() => builder.build()).toThrow('Entry point must be set');
    });

    it('should detect cycles in the graph', () => {
      const builder = new WorkflowGraphBuilder()
        .addPhase('phase-1', { requests: [{ id: 'r1', requestOptions: { reqData: { hostname: 'test.com', path: '/1' }}}]})
        .addPhase('phase-2', { requests: [{ id: 'r2', requestOptions: { reqData: { hostname: 'test.com', path: '/2' }}}]})
        .addPhase('phase-3', { requests: [{ id: 'r3', requestOptions: { reqData: { hostname: 'test.com', path: '/3' }}}]})
        .connectSequence('phase-1', 'phase-2', 'phase-3')
        .connect('phase-3', 'phase-1') // Creates a cycle
        .setEntryPoint('phase-1')
        .setEnforceDAG(false); // Disable enforcement to allow building
      
      const graph = builder.build();
      const cycles = detectCycles(graph);
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should detect unreachable nodes', () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', { requests: [{ id: 'r1', requestOptions: { reqData: { hostname: 'test.com', path: '/1' }}}]})
        .addPhase('phase-2', { requests: [{ id: 'r2', requestOptions: { reqData: { hostname: 'test.com', path: '/2' }}}]})
        .addPhase('orphan', { requests: [{ id: 'r3', requestOptions: { reqData: { hostname: 'test.com', path: '/3' }}}]})
        .connect('phase-1', 'phase-2')
        .setEntryPoint('phase-1')
        .build();

      const validation = validateWorkflowGraph(graph);
      expect(validation.unreachableNodes).toContain('orphan');
    });
  });

  describe('DAG Guarantees', () => {
    it('should reject simple cycles during build', () => {
      const builder = new WorkflowGraphBuilder()
        .addPhase('phase-1', { requests: [{ id: 'r1', requestOptions: { reqData: { hostname: 'test.com', path: '/1' }}}]})
        .addPhase('phase-2', { requests: [{ id: 'r2', requestOptions: { reqData: { hostname: 'test.com', path: '/2' }}}]})
        .connect('phase-1', 'phase-2')
        .connect('phase-2', 'phase-1') // Creates a cycle: phase-1 → phase-2 → phase-1
        .setEntryPoint('phase-1');

      expect(() => builder.build()).toThrow(/DAG constraint violated/);
      expect(() => builder.build()).toThrow(/cycle/);
    });

    it('should reject self-loops during build', () => {
      const builder = new WorkflowGraphBuilder()
        .addPhase('phase-1', { requests: [{ id: 'r1', requestOptions: { reqData: { hostname: 'test.com', path: '/1' }}}]})
        .connect('phase-1', 'phase-1') // Self-loop
        .setEntryPoint('phase-1');

      expect(() => builder.build()).toThrow(/DAG constraint violated/);
      expect(() => builder.build()).toThrow(/phase-1.*phase-1/);
    });

    it('should reject complex cycles during build', () => {
      const builder = new WorkflowGraphBuilder()
        .addPhase('phase-1', { requests: [{ id: 'r1', requestOptions: { reqData: { hostname: 'test.com', path: '/1' }}}]})
        .addPhase('phase-2', { requests: [{ id: 'r2', requestOptions: { reqData: { hostname: 'test.com', path: '/2' }}}]})
        .addPhase('phase-3', { requests: [{ id: 'r3', requestOptions: { reqData: { hostname: 'test.com', path: '/3' }}}]})
        .addPhase('phase-4', { requests: [{ id: 'r4', requestOptions: { reqData: { hostname: 'test.com', path: '/4' }}}]})
        .connectSequence('phase-1', 'phase-2', 'phase-3', 'phase-4')
        .connect('phase-4', 'phase-2') // Creates a cycle: phase-2 → phase-3 → phase-4 → phase-2
        .setEntryPoint('phase-1');

      expect(() => builder.build()).toThrow(/DAG constraint violated/);
    });

    it('should reject multiple cycles during build', () => {
      const builder = new WorkflowGraphBuilder()
        .addPhase('a', { requests: [{ id: 'r1', requestOptions: { reqData: { hostname: 'test.com', path: '/a' }}}]})
        .addPhase('b', { requests: [{ id: 'r2', requestOptions: { reqData: { hostname: 'test.com', path: '/b' }}}]})
        .addPhase('c', { requests: [{ id: 'r3', requestOptions: { reqData: { hostname: 'test.com', path: '/c' }}}]})
        .addPhase('d', { requests: [{ id: 'r4', requestOptions: { reqData: { hostname: 'test.com', path: '/d' }}}]})
        .connect('a', 'b')
        .connect('b', 'a') // Cycle 1: a ↔ b
        .connect('c', 'd')
        .connect('d', 'c') // Cycle 2: c ↔ d
        .setEntryPoint('a');

      expect(() => builder.build()).toThrow(/DAG constraint violated/);
      expect(() => builder.build()).toThrow(/Found \d+ cycle/);
    });

    it('should allow disabling DAG enforcement', () => {
      const builder = new WorkflowGraphBuilder()
        .addPhase('phase-1', { requests: [{ id: 'r1', requestOptions: { reqData: { hostname: 'test.com', path: '/1' }}}]})
        .addPhase('phase-2', { requests: [{ id: 'r2', requestOptions: { reqData: { hostname: 'test.com', path: '/2' }}}]})
        .connect('phase-1', 'phase-2')
        .connect('phase-2', 'phase-1') // Creates a cycle
        .setEntryPoint('phase-1')
        .setEnforceDAG(false); // Explicitly disable DAG enforcement

      // Should not throw when enforcement is disabled
      expect(() => builder.build()).not.toThrow();
      
      const graph = builder.build();
      expect(graph.nodes.size).toBe(2);
    });

    it('should accept valid DAGs with complex branching', () => {
      const builder = new WorkflowGraphBuilder()
        .addPhase('start', { requests: [{ id: 'r1', requestOptions: { reqData: { hostname: 'test.com', path: '/start' }}}]})
        .addPhase('branch-1', { requests: [{ id: 'r2', requestOptions: { reqData: { hostname: 'test.com', path: '/b1' }}}]})
        .addPhase('branch-2', { requests: [{ id: 'r3', requestOptions: { reqData: { hostname: 'test.com', path: '/b2' }}}]})
        .addPhase('merge', { requests: [{ id: 'r4', requestOptions: { reqData: { hostname: 'test.com', path: '/merge' }}}]})
        .addPhase('end', { requests: [{ id: 'r5', requestOptions: { reqData: { hostname: 'test.com', path: '/end' }}}]})
        .connect('start', 'branch-1')
        .connect('start', 'branch-2')
        .connect('branch-1', 'merge')
        .connect('branch-2', 'merge')
        .connect('merge', 'end')
        .setEntryPoint('start');

      // Should not throw - this is a valid DAG (diamond pattern)
      expect(() => builder.build()).not.toThrow();
      
      const graph = builder.build();
      expect(graph.nodes.size).toBe(5);
    });

    it('should accept DAGs with multiple levels', () => {
      const builder = new WorkflowGraphBuilder()
        .addPhase('level-0', { requests: [{ id: 'r0', requestOptions: { reqData: { hostname: 'test.com', path: '/0' }}}]})
        .addPhase('level-1a', { requests: [{ id: 'r1a', requestOptions: { reqData: { hostname: 'test.com', path: '/1a' }}}]})
        .addPhase('level-1b', { requests: [{ id: 'r1b', requestOptions: { reqData: { hostname: 'test.com', path: '/1b' }}}]})
        .addPhase('level-2a', { requests: [{ id: 'r2a', requestOptions: { reqData: { hostname: 'test.com', path: '/2a' }}}]})
        .addPhase('level-2b', { requests: [{ id: 'r2b', requestOptions: { reqData: { hostname: 'test.com', path: '/2b' }}}]})
        .addPhase('level-2c', { requests: [{ id: 'r2c', requestOptions: { reqData: { hostname: 'test.com', path: '/2c' }}}]})
        .addPhase('level-3', { requests: [{ id: 'r3', requestOptions: { reqData: { hostname: 'test.com', path: '/3' }}}]})
        .connect('level-0', 'level-1a')
        .connect('level-0', 'level-1b')
        .connect('level-1a', 'level-2a')
        .connect('level-1a', 'level-2b')
        .connect('level-1b', 'level-2c')
        .connect('level-2a', 'level-3')
        .connect('level-2b', 'level-3')
        .connect('level-2c', 'level-3')
        .setEntryPoint('level-0');

      // Should not throw - this is a valid DAG
      expect(() => builder.build()).not.toThrow();
      
      const graph = builder.build();
      expect(graph.nodes.size).toBe(7);
    });

    it('should detect cycles during validation even if enforcement was disabled', () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', { requests: [{ id: 'r1', requestOptions: { reqData: { hostname: 'test.com', path: '/1' }}}]})
        .addPhase('phase-2', { requests: [{ id: 'r2', requestOptions: { reqData: { hostname: 'test.com', path: '/2' }}}]})
        .connect('phase-1', 'phase-2')
        .connect('phase-2', 'phase-1')
        .setEntryPoint('phase-1')
        .setEnforceDAG(false) // Disable enforcement
        .build();

      const validation = validateWorkflowGraph(graph);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('cycle'))).toBe(true);
      expect(validation.cycles).toBeDefined();
      expect(validation.cycles!.length).toBeGreaterThan(0);
    });

    it('should prevent execution of graphs with cycles when validateGraph is enabled', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('phase-2', {
          requests: [{
            id: 'req-2',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .connect('phase-1', 'phase-2')
        .connect('phase-2', 'phase-1') // Cycle
        .setEntryPoint('phase-1')
        .setEnforceDAG(false) // Disable build-time enforcement
        .build();

      // Should throw during execution when validateGraph is true (default)
      await expect(stableWorkflowGraph(graph, {
        validateGraph: true // Default
      })).rejects.toThrow(/Invalid workflow graph/);
      
      await expect(stableWorkflowGraph(graph, {
        validateGraph: true
      })).rejects.toThrow(/cycle/);
    });

    it('should allow execution with validateGraph disabled (at your own risk)', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              attempts: 1
            }
          }]
        })
        .setEntryPoint('phase-1')
        .setEnforceDAG(false)
        .build();

      // Should execute when validateGraph is disabled (even though we don't have cycles in this test)
      const result = await stableWorkflowGraph(graph, {
        validateGraph: false
      });

      expect(result.success).toBe(true);
    });
  });

  describe('WorkflowGraphBuilder', () => {
    it('should support fluent API for building graphs', () => {
      const builder = new WorkflowGraphBuilder()
        .addPhase('p1', { requests: [{ id: 'r1', requestOptions: { reqData: { hostname: 'test.com', path: '/1' }}}]})
        .addPhase('p2', { requests: [{ id: 'r2', requestOptions: { reqData: { hostname: 'test.com', path: '/2' }}}]})
        .connect('p1', 'p2')
        .setEntryPoint('p1');

      expect(builder.hasNode('p1')).toBe(true);
      expect(builder.hasNode('p2')).toBe(true);
      expect(builder.getNodeCount()).toBe(2);
      expect(builder.getEdgeCount()).toBe(1);
    });

    it('should support connectToMany for fan-out patterns', () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('start', { requests: [{ id: 'r1', requestOptions: { reqData: { hostname: 'test.com', path: '/1' }}}]})
        .addPhase('branch-1', { requests: [{ id: 'r2', requestOptions: { reqData: { hostname: 'test.com', path: '/2' }}}]})
        .addPhase('branch-2', { requests: [{ id: 'r3', requestOptions: { reqData: { hostname: 'test.com', path: '/3' }}}]})
        .addPhase('branch-3', { requests: [{ id: 'r4', requestOptions: { reqData: { hostname: 'test.com', path: '/4' }}}]})
        .connectToMany('start', ['branch-1', 'branch-2', 'branch-3'])
        .setEntryPoint('start')
        .build();

      expect(graph.edges.get('start')?.length).toBe(3);
    });

    it('should support connectManyTo for fan-in patterns', () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('branch-1', { requests: [{ id: 'r1', requestOptions: { reqData: { hostname: 'test.com', path: '/1' }}}]})
        .addPhase('branch-2', { requests: [{ id: 'r2', requestOptions: { reqData: { hostname: 'test.com', path: '/2' }}}]})
        .addPhase('branch-3', { requests: [{ id: 'r3', requestOptions: { reqData: { hostname: 'test.com', path: '/3' }}}]})
        .addPhase('merge', { requests: [{ id: 'r4', requestOptions: { reqData: { hostname: 'test.com', path: '/4' }}}]})
        .connectManyTo(['branch-1', 'branch-2', 'branch-3'], 'merge')
        .setEntryPoint('branch-1')
        .build();

      expect(graph.edges.get('branch-1')).toBeDefined();
      expect(graph.edges.get('branch-2')).toBeDefined();
      expect(graph.edges.get('branch-3')).toBeDefined();
    });

    it('should support node removal', () => {
      const builder = new WorkflowGraphBuilder()
        .addPhase('p1', { requests: [{ id: 'r1', requestOptions: { reqData: { hostname: 'test.com', path: '/1' }}}]})
        .addPhase('p2', { requests: [{ id: 'r2', requestOptions: { reqData: { hostname: 'test.com', path: '/2' }}}]})
        .addPhase('p3', { requests: [{ id: 'r3', requestOptions: { reqData: { hostname: 'test.com', path: '/3' }}}]})
        .connectSequence('p1', 'p2', 'p3');

      expect(builder.getNodeCount()).toBe(3);

      builder.removeNode('p2');

      expect(builder.getNodeCount()).toBe(2);
      expect(builder.hasNode('p2')).toBe(false);
    });

    it('should auto-detect exit points', () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('start', { requests: [{ id: 'r1', requestOptions: { reqData: { hostname: 'test.com', path: '/1' }}}]})
        .addPhase('middle', { requests: [{ id: 'r2', requestOptions: { reqData: { hostname: 'test.com', path: '/2' }}}]})
        .addPhase('end', { requests: [{ id: 'r3', requestOptions: { reqData: { hostname: 'test.com', path: '/3' }}}]})
        .connectSequence('start', 'middle', 'end')
        .setEntryPoint('start')
        .build();

      expect(graph.exitPoints).toContain('end');
    });
  });

  describe('Complex Workflow Patterns', () => {
    it('should handle diamond pattern (fork and join)', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('start', {
          requests: [{
            id: 'start-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('path-a', {
          requests: [{
            id: 'path-a-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/users/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('path-b', {
          requests: [{
            id: 'path-b-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/users/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addMergePoint('merge', ['path-a', 'path-b'])
        .addPhase('end', {
          requests: [{
            id: 'end-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/comments/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addParallelGroup('fork', ['path-a', 'path-b'])
        .connectSequence('start', 'fork', 'merge', 'end')
        .setEntryPoint('start')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);
      expect(result.phases.length).toBe(4);
    });

    it('should handle multi-level parallel execution', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('level1-1', {
          requests: [{
            id: 'l1-1',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('level1-2', {
          requests: [{
            id: 'l1-2',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('level2-1', {
          requests: [{
            id: 'l2-1',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/users/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('level2-2', {
          requests: [{
            id: 'l2-2',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/users/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addParallelGroup('parallel-1', ['level1-1', 'level1-2'])
        .addMergePoint('merge-1', ['level1-1', 'level1-2'])
        .addParallelGroup('parallel-2', ['level2-1', 'level2-2'])
        .connectSequence('parallel-1', 'merge-1', 'parallel-2')
        .setEntryPoint('parallel-1')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);
      expect(result.phases.length).toBe(4);
    });
  });

  describe('State Management', () => {
    it('should share state across phases via sharedBuffer', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              logAllSuccessfulAttempts: true,
              handleSuccessfulAttemptData: async ({ successfulAttemptData, commonBuffer }) => {
                commonBuffer!.firstPhaseData = successfulAttemptData.data;
              }
            }
          }]
        })
        .addPhase('phase-2', {
          requests: [{
            id: 'req-2',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              logAllSuccessfulAttempts: true,
              handleSuccessfulAttemptData: async ({ commonBuffer }) => {
                expect(commonBuffer!.firstPhaseData).toBeDefined();
                commonBuffer!.secondPhaseCompleted = true;
              }
            }
          }]
        })
        .connectSequence('phase-1', 'phase-2')
        .setEntryPoint('phase-1')
        .build();

      const sharedBuffer: Record<string, any> = {};
      const result = await stableWorkflowGraph(graph, { sharedBuffer });

      expect(result.success).toBe(true);
      expect(sharedBuffer.firstPhaseData).toBeDefined();
      expect(sharedBuffer.secondPhaseCompleted).toBe(true);
    });

    it('should support prePhaseExecutionHook', async () => {
      const hookCalls: string[] = [];

      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('phase-2', {
          requests: [{
            id: 'req-2',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .connectSequence('phase-1', 'phase-2')
        .setEntryPoint('phase-1')
        .build();

      const result = await stableWorkflowGraph(graph, {
        prePhaseExecutionHook: async ({ phaseId, phase }) => {
          hookCalls.push(phaseId);
          return phase;
        }
      });

      expect(result.success).toBe(true);
      expect(hookCalls).toContain('phase-1');
      expect(hookCalls).toContain('phase-2');
    });

    it('should execute hooks with state persistence', async () => {
      const persistenceStore: Record<string, any> = {};
      const persistenceCalls: Array<{ operation: string; phase: string }> = [];
      
      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('phase-2', {
          requests: [{
            id: 'req-2',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .connectSequence('phase-1', 'phase-2')
        .setEntryPoint('phase-1')
        .build();

      const sharedBuffer: Record<string, any> = { initialValue: 'test' };
      let callCount = 0;
      
      const result = await stableWorkflowGraph(graph, {
        sharedBuffer,
        statePersistence: {
          loadBeforeHooks: true,
          storeAfterHooks: true,
          persistenceFunction: async ({ buffer, executionContext }) => {
            const key = `${executionContext.workflowId}-${executionContext.phaseId}`;
            callCount++;
            
            // First call for each phase is load (loadBeforeHooks), second is store (storeAfterHooks)
            const isLoad = callCount % 2 === 1;
            
            if (isLoad) {
              persistenceCalls.push({ operation: 'load', phase: executionContext.phaseId || 'unknown' });
              // Load persisted state into buffer
              if (persistenceStore[key]) {
                Object.assign(buffer, persistenceStore[key]);
              }
              return buffer;
            } else {
              persistenceCalls.push({ operation: 'store', phase: executionContext.phaseId || 'unknown' });
              // Store buffer state
              persistenceStore[key] = { ...buffer };
            }
          }
        },
        prePhaseExecutionHook: async ({ phaseId, phase, sharedBuffer }) => {
          // Modify buffer in hook - should be persisted
          sharedBuffer!.hookExecuted = phaseId;
          sharedBuffer![`${phaseId}_timestamp`] = Date.now();
          return phase;
        }
      });

      expect(result.success).toBe(true);
      
      // Verify persistence functions were called (2 phases * 2 calls each = 4 total)
      expect(persistenceCalls.length).toBeGreaterThanOrEqual(4);
      expect(persistenceCalls.filter(c => c.operation === 'load').length).toBeGreaterThan(0);
      expect(persistenceCalls.filter(c => c.operation === 'store').length).toBeGreaterThan(0);
      
      // Verify buffer modifications from hooks were maintained
      expect(sharedBuffer.hookExecuted).toBeDefined();
      expect(sharedBuffer.initialValue).toBe('test');
      expect(sharedBuffer['phase-1_timestamp']).toBeDefined();
      expect(sharedBuffer['phase-2_timestamp']).toBeDefined();
    });

    it('should execute conditional evaluations with state persistence', async () => {
      const persistenceStore: Record<string, any> = {};
      const evaluationCalls: string[] = [];
      
      const graph = new WorkflowGraphBuilder()
        .addPhase('init', {
          requests: [{
            id: 'init-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              logAllSuccessfulAttempts: true,
              handleSuccessfulAttemptData: async ({ successfulAttemptData, commonBuffer }) => {
                commonBuffer!.dataValue = (successfulAttemptData.data as any).id;
              }
            }
          }]
        })
        .addConditional('decision', async ({ sharedBuffer }) => {
          evaluationCalls.push('evaluated');
          // Modify buffer during conditional evaluation
          sharedBuffer!.conditionEvaluated = true;
          sharedBuffer!.evaluationTime = Date.now();
          return sharedBuffer!.dataValue > 0 ? 'path-a' : 'path-b';
        })
        .addPhase('path-a', {
          requests: [{
            id: 'path-a-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/users/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('path-b', {
          requests: [{
            id: 'path-b-req',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/users/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .connectSequence('init', 'decision')
        .setEntryPoint('init')
        .build();

      const sharedBuffer: Record<string, any> = {};
      
      const result = await stableWorkflowGraph(graph, {
        sharedBuffer,
        statePersistence: {
          loadBeforeHooks: true,
          storeAfterHooks: true,
          persistenceFunction: async ({ buffer, executionContext }) => {
            const key = `${executionContext.workflowId}-conditional`;
            
            // Simulate persistence by storing and loading from in-memory store
            if (Object.keys(buffer).length > 0) {
              persistenceStore[key] = { ...buffer };
            }
            
            if (persistenceStore[key]) {
              Object.assign(buffer, persistenceStore[key]);
            }
          }
        }
      });

      expect(result.success).toBe(true);
      expect(evaluationCalls.length).toBe(1);
      
      // Verify conditional evaluation was executed and state was modified
      expect(sharedBuffer.conditionEvaluated).toBe(true);
      expect(sharedBuffer.evaluationTime).toBeDefined();
      expect(sharedBuffer.dataValue).toBeDefined();
      
      // Verify correct path was taken
      expect(result.phases.some(p => p.phaseId === 'path-a')).toBe(true);
      expect(result.phases.some(p => p.phaseId === 'path-b')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle phase failures gracefully', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'invalid-hostname-that-does-not-exist.com',
                path: '/test',
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              attempts: 1
            }
          }]
        })
        .addPhase('phase-2', {
          requests: [{
            id: 'req-2',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .connectSequence('phase-1', 'phase-2')
        .setEntryPoint('phase-1')
        .build();

      const result = await stableWorkflowGraph(graph, {
        stopOnFirstPhaseError: false
      });

      expect(result.success).toBe(false);
      expect(result.failedRequests).toBeGreaterThan(0);
    });

    it('should terminate early when stopOnFirstPhaseError is true', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'invalid-hostname.com',
                path: '/test',
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              attempts: 1
            }
          }]
        })
        .addPhase('phase-2', {
          requests: [{
            id: 'req-2',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .connectSequence('phase-1', 'phase-2')
        .setEntryPoint('phase-1')
        .build();

      const result = await stableWorkflowGraph(graph, {
        stopOnFirstPhaseError: true
      });

      expect(result.terminatedEarly).toBe(true);
      expect(result.phases.length).toBe(1); // Only phase-1 should execute
    });
  });

  describe('Metrics and Observability', () => {
    it('should collect comprehensive metrics', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('phase-2', {
          requests: [{
            id: 'req-2',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .connectSequence('phase-1', 'phase-2')
        .setEntryPoint('phase-1')
        .build();

      const result = await stableWorkflowGraph(graph, {
        workflowId: 'metrics-test'
      });

      expect(result.metrics).toBeDefined();
      expect(result.metrics?.workflowId).toBe('metrics-test');
      expect(result.metrics?.totalPhases).toBe(2);
      expect(result.metrics?.completedPhases).toBe(2);
      expect(result.metrics?.requestSuccessRate).toBeGreaterThan(0);
    });

    it('should track execution history', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('phase-2', {
          requests: [{
            id: 'req-2',
            requestOptions: {
              reqData: {
                hostname: 'jsonplaceholder.typicode.com',
                path: '/posts/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .connectSequence('phase-1', 'phase-2')
        .setEntryPoint('phase-1')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.executionHistory).toBeDefined();
      expect(result.executionHistory.length).toBe(2);
      expect(result.executionHistory[0].phaseId).toBe('phase-1');
      expect(result.executionHistory[1].phaseId).toBe('phase-2');
    });
  });

  describe('Configuration Cascading', () => {
    it('should apply common configuration to all phases', async () => {
      const graph = new WorkflowGraphBuilder()
        .addPhase('phase-1', {
          requests: [{
            id: 'req-1',
            requestOptions: {
              reqData: {
                path: '/posts/1',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .addPhase('phase-2', {
          requests: [{
            id: 'req-2',
            requestOptions: {
              reqData: {
                path: '/posts/2',
                method: REQUEST_METHODS.GET
              },
              resReq: true
            }
          }]
        })
        .connectSequence('phase-1', 'phase-2')
        .setEntryPoint('phase-1')
        .build();

      const result = await stableWorkflowGraph(graph, {
        commonRequestData: {
          hostname: 'jsonplaceholder.typicode.com'
        }
      });

      expect(result.success).toBe(true);
      expect(result.totalRequests).toBe(2);
    });
  });
});

describe('Workflow Graph - Phase Decision Hook with Replay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should replay a phase when phaseDecisionHook returns REPLAY action', async () => {
    let executionCount = 0;
    const sharedBuffer: Record<string, any> = { attempts: [] };

    const testFunction = async (): Promise<string> => {
      executionCount++;
      sharedBuffer.attempts.push(executionCount);
      return `Execution ${executionCount}`;
    };

    const graph = new WorkflowGraphBuilder()
      .addPhase('test-phase', {
        functions: [{
          id: 'test-fn',
          functionOptions: {
            fn: testFunction,
            args: []
          }
        }]
      })
      .setEntryPoint('test-phase')
      .build();

    // Add phaseDecisionHook to the phase node
    const phaseNode = graph.nodes.get('test-phase')!;
    phaseNode.phaseDecisionHook = async ({ phaseResult, sharedBuffer }: PhaseDecisionHookOptions): Promise<PhaseExecutionDecision> => {
      // Replay if less than 3 executions
      if (sharedBuffer!.attempts.length < 3) {
        return {
          action: PHASE_DECISION_ACTIONS.REPLAY
        };
      }
      return {
        action: PHASE_DECISION_ACTIONS.CONTINUE
      };
    };

    const result = await stableWorkflowGraph(graph, {
      workflowId: 'replay-test',
      sharedBuffer
    });

    expect(result.success).toBe(true);
    expect(executionCount).toBe(3);
    expect(sharedBuffer.attempts).toEqual([1, 2, 3]);
    expect(result.executionHistory.filter(h => h.phaseId === 'test-phase')).toHaveLength(3);
  });

  it('should stop replaying when CONTINUE is returned', async () => {
    let executionCount = 0;

    const testFunction = async (): Promise<number> => {
      executionCount++;
      return executionCount;
    };

    const graph = new WorkflowGraphBuilder()
      .addPhase('replay-phase', {
        functions: [{
          id: 'counter-fn',
          functionOptions: {
            fn: testFunction,
            args: []
          }
        }]
      })
      .setEntryPoint('replay-phase')
      .build();

    const phaseNode = graph.nodes.get('replay-phase')!;
    phaseNode.phaseDecisionHook = async () => {
      // Only replay once
      if (executionCount === 1) {
        return { action: PHASE_DECISION_ACTIONS.REPLAY };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    };

    const result = await stableWorkflowGraph(graph, {
      workflowId: 'stop-replay-test'
    });

    expect(result.success).toBe(true);
    expect(executionCount).toBe(2);
  });

  it('should terminate workflow when phaseDecisionHook returns TERMINATE', async () => {
    let phase1Count = 0;
    let phase2Count = 0;

    const graph = new WorkflowGraphBuilder()
      .addPhase('phase-1', {
        functions: [{
          id: 'fn-1',
          functionOptions: {
            fn: async () => { phase1Count++; return 'done'; },
            args: []
          }
        }]
      })
      .addPhase('phase-2', {
        functions: [{
          id: 'fn-2',
          functionOptions: {
            fn: async () => { phase2Count++; return 'done'; },
            args: []
          }
        }]
      })
      .connectSequence('phase-1', 'phase-2')
      .setEntryPoint('phase-1')
      .build();

    const phaseNode = graph.nodes.get('phase-1')!;
    phaseNode.phaseDecisionHook = async () => {
      return {
        action: PHASE_DECISION_ACTIONS.TERMINATE,
        reason: 'Testing termination'
      };
    };

    const result = await stableWorkflowGraph(graph, {
      workflowId: 'terminate-test'
    });

    expect(result.terminatedEarly).toBe(true);
    expect(result.terminationReason).toContain('Testing termination');
    expect(phase1Count).toBe(1);
    expect(phase2Count).toBe(0); // Phase 2 should not execute
  });

  it('should access phaseResult in phaseDecisionHook', async () => {
    let hookCalled = false;
    let capturedPhaseResult: any = null;

    const graph = new WorkflowGraphBuilder()
      .addPhase('data-phase', {
        functions: [{
          id: 'data-fn',
          functionOptions: {
            fn: async () => ({ value: 42 }),
            args: []
          }
        }]
      })
      .setEntryPoint('data-phase')
      .build();

    const phaseNode = graph.nodes.get('data-phase')!;
    phaseNode.phaseDecisionHook = async ({ phaseResult }: PhaseDecisionHookOptions): Promise<PhaseExecutionDecision> => {
      hookCalled = true;
      capturedPhaseResult = phaseResult;
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    };

    const result = await stableWorkflowGraph(graph, {
      workflowId: 'access-result-test'
    });

    expect(result.success).toBe(true);
    expect(hookCalled).toBe(true);
    expect(capturedPhaseResult).toBeDefined();
    expect(capturedPhaseResult.success).toBe(true);
    expect(capturedPhaseResult.phaseId).toBe('data-phase');
  });

  it('should track execution numbers correctly during replay', async () => {
    const executionRecords: number[] = [];

    const graph = new WorkflowGraphBuilder()
      .addPhase('tracked-phase', {
        functions: [{
          id: 'tracker-fn',
          functionOptions: {
            fn: async () => 'result',
            args: []
          }
        }]
      })
      .setEntryPoint('tracked-phase')
      .build();

    const phaseNode = graph.nodes.get('tracked-phase')!;
    phaseNode.phaseDecisionHook = async () => {
      executionRecords.push(executionRecords.length + 1);
      if (executionRecords.length < 4) {
        return { action: PHASE_DECISION_ACTIONS.REPLAY };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    };

    const result = await stableWorkflowGraph(graph, {
      workflowId: 'tracking-test'
    });

    expect(result.success).toBe(true);
    const phaseExecutions = result.executionHistory.filter(h => h.phaseId === 'tracked-phase');
    expect(phaseExecutions).toHaveLength(4);
    expect(phaseExecutions[0].executionNumber).toBe(1);
    expect(phaseExecutions[1].executionNumber).toBe(2);
    expect(phaseExecutions[2].executionNumber).toBe(3);
    expect(phaseExecutions[3].executionNumber).toBe(4);
  });

  it('should work with shared buffer updates during replay', async () => {
    const sharedBuffer: Record<string, any> = { counter: 0, values: [] };

    const incrementFunction = async (): Promise<number> => {
      sharedBuffer.counter++;
      sharedBuffer.values.push(sharedBuffer.counter * 10);
      return sharedBuffer.counter;
    };

    const graph = new WorkflowGraphBuilder()
      .addPhase('buffer-phase', {
        functions: [{
          id: 'increment-fn',
          functionOptions: {
            fn: incrementFunction,
            args: []
          }
        }]
      })
      .setEntryPoint('buffer-phase')
      .build();

    const phaseNode = graph.nodes.get('buffer-phase')!;
    phaseNode.phaseDecisionHook = async ({ sharedBuffer }: PhaseDecisionHookOptions): Promise<PhaseExecutionDecision> => {
      if (sharedBuffer!.counter < 5) {
        return { action: PHASE_DECISION_ACTIONS.REPLAY };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    };

    const result = await stableWorkflowGraph(graph, {
      workflowId: 'buffer-replay-test',
      sharedBuffer
    });

    expect(result.success).toBe(true);
    expect(sharedBuffer.counter).toBe(5);
    expect(sharedBuffer.values).toEqual([10, 20, 30, 40, 50]);
  });

  it('should handle replay with conditional success criteria', async () => {
    let attempts = 0;
    const sharedBuffer: Record<string, any> = {};

    const mayFailFunction = async (): Promise<string> => {
      attempts++;
      if (attempts < 3) {
        throw new Error(`Attempt ${attempts} failed`);
      }
      return 'Success';
    };

    const graph = new WorkflowGraphBuilder()
      .addPhase('retry-phase', {
        functions: [{
          id: 'may-fail-fn',
          functionOptions: {
            fn: mayFailFunction,
            args: [],
            attempts: 1 // No internal retry
          }
        }]
      })
      .setEntryPoint('retry-phase')
      .build();

    const phaseNode = graph.nodes.get('retry-phase')!;
    phaseNode.phaseDecisionHook = async ({ phaseResult }: PhaseDecisionHookOptions): Promise<PhaseExecutionDecision> => {
      // Replay if phase failed
      if (!phaseResult.success) {
        return { action: PHASE_DECISION_ACTIONS.REPLAY };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    };

    const result = await stableWorkflowGraph(graph, {
      workflowId: 'conditional-retry-test',
      sharedBuffer
    });

    // The workflow reports failure because failed requests are counted even though replay eventually succeeds
    // This is expected behavior - failedRequests accumulates across all attempts
    expect(attempts).toBe(3);
    expect(result.failedRequests).toBe(2); // First 2 attempts failed
    expect(result.successfulRequests).toBe(1); // Last attempt succeeded
    
    // The final phase execution was successful
    const lastPhaseResult = result.phases[result.phases.length - 1];
    expect(lastPhaseResult.success).toBe(true);
  });

  it('should work in multi-phase workflow with selective replay', async () => {
    let phase1Count = 0;
    let phase2Count = 0;
    let phase3Count = 0;

    const graph = new WorkflowGraphBuilder()
      .addPhase('phase-1', {
        functions: [{
          id: 'fn-1',
          functionOptions: {
            fn: async () => { phase1Count++; return 'phase-1-done'; },
            args: []
          }
        }]
      })
      .addPhase('phase-2', {
        functions: [{
          id: 'fn-2',
          functionOptions: {
            fn: async () => { phase2Count++; return 'phase-2-done'; },
            args: []
          }
        }]
      })
      .addPhase('phase-3', {
        functions: [{
          id: 'fn-3',
          functionOptions: {
            fn: async () => { phase3Count++; return 'phase-3-done'; },
            args: []
          }
        }]
      })
      .connectSequence('phase-1', 'phase-2')
      .connectSequence('phase-2', 'phase-3')
      .setEntryPoint('phase-1')
      .build();

    // Only phase-2 should replay
    const phase2Node = graph.nodes.get('phase-2')!;
    phase2Node.phaseDecisionHook = async () => {
      if (phase2Count < 2) {
        return { action: PHASE_DECISION_ACTIONS.REPLAY };
      }
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    };

    const result = await stableWorkflowGraph(graph, {
      workflowId: 'multi-phase-replay-test'
    });

    expect(result.success).toBe(true);
    expect(phase1Count).toBe(1); // Executes once
    expect(phase2Count).toBe(2); // Replays once
    expect(phase3Count).toBe(1); // Executes once
  });
});