import { describe, it, expect, beforeEach } from '@jest/globals';
import { stableApiGateway, stableWorkflow } from '../src/index.js';
import { API_GATEWAY_REQUEST, API_GATEWAY_FUNCTION, STABLE_WORKFLOW_BRANCH } from '../src/types/index.js';
import { VALID_REQUEST_PROTOCOLS, REQUEST_METHODS } from '../src/enums/index.js';

describe('Racing Features', () => {
  describe('Request Racing (Gateway Level)', () => {
    it('should return only the first successful request and cancel others', async () => {
      const fastRequest: API_GATEWAY_REQUEST = {
        id: 'fast-request',
        requestOptions: {
          reqData: {
            hostname: 'jsonplaceholder.typicode.com',
            protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
            path: '/posts/1',
            method: REQUEST_METHODS.GET,
          },
          attempts: 1,
        },
      };

      const slowRequest: API_GATEWAY_REQUEST = {
        id: 'slow-request',
        requestOptions: {
          reqData: {
            hostname: 'jsonplaceholder.typicode.com',
            protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
            path: '/posts/2',
            method: REQUEST_METHODS.GET,
          },
          attempts: 1,
          wait: 2000, // Artificial delay to make it slower
        },
      };

      const verySlowRequest: API_GATEWAY_REQUEST = {
        id: 'very-slow-request',
        requestOptions: {
          reqData: {
            hostname: 'jsonplaceholder.typicode.com',
            protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
            path: '/posts/3',
            method: REQUEST_METHODS.GET,
          },
          attempts: 1,
          wait: 3000, // Even more delay
        },
      };

      const result = await stableApiGateway(
        [fastRequest, slowRequest, verySlowRequest],
        {
          concurrentExecution: true,
          enableRacing: true,
        }
      );

      // Should return responses for all requests
      expect(result.length).toBe(3);
      
      // Exactly one should win (network timing varies, so we don't assume which one)
      const winners = result.filter((r) => r.success);
      expect(winners.length).toBe(1);
      expect(winners[0].requestId).toMatch(/^(fast-request|slow-request|very-slow-request)$/);

      // Others should be marked as cancelled
      const cancelled = result.filter((r) => !r.success);
      expect(cancelled.length).toBe(2);
      cancelled.forEach((response) => {
        expect(response.error).toContain('Cancelled');
      });
    });

    it('should handle racing with all requests failing', async () => {
      const failRequest1: API_GATEWAY_REQUEST = {
        id: 'fail-1',
        requestOptions: {
          reqData: {
            hostname: 'invalid-hostname-12345.com',
            protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
            path: '/fail',
            method: REQUEST_METHODS.GET,
          },
          attempts: 1,
        },
      };

      const failRequest2: API_GATEWAY_REQUEST = {
        id: 'fail-2',
        requestOptions: {
          reqData: {
            hostname: 'invalid-hostname-67890.com',
            protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
            path: '/fail',
            method: REQUEST_METHODS.GET,
          },
          attempts: 1,
        },
      };

      const result = await stableApiGateway([failRequest1, failRequest2], {
        concurrentExecution: true,
        enableRacing: true,
      });

      // Should return responses for all requests
      expect(result.length).toBeGreaterThan(0);
      
      // At least one should have a failure
      const failures = result.filter((r) => !r.success);
      expect(failures.length).toBeGreaterThan(0);
    });

    it('should work with racing disabled (normal concurrent execution)', async () => {
      const request1: API_GATEWAY_REQUEST = {
        id: 'request-1',
        requestOptions: {
          reqData: {
            hostname: 'jsonplaceholder.typicode.com',
            protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
            path: '/posts/1',
            method: REQUEST_METHODS.GET,
          },
          attempts: 1,
        },
      };

      const request2: API_GATEWAY_REQUEST = {
        id: 'request-2',
        requestOptions: {
          reqData: {
            hostname: 'jsonplaceholder.typicode.com',
            protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
            path: '/posts/2',
            method: REQUEST_METHODS.GET,
          },
          attempts: 1,
        },
      };

      const result = await stableApiGateway([request1, request2], {
        concurrentExecution: true,
        enableRacing: false,
      });

      // Both requests should complete
      expect(result.length).toBe(2);
      
      // Both should succeed
      const successes = result.filter((r) => r.success);
      expect(successes.length).toBe(2);
    });
  });

  describe('Function Racing (Gateway Level)', () => {
    it('should return only the first successful function and cancel others', async () => {
      const fastFunction: API_GATEWAY_FUNCTION<[], string> = {
        id: 'fast-function',
        functionOptions: {
          fn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return 'fast-result';
          },
          args: [],
          attempts: 1,
        },
      };

      const slowFunction: API_GATEWAY_FUNCTION<[], string> = {
        id: 'slow-function',
        functionOptions: {
          fn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return 'slow-result';
          },
          args: [],
          attempts: 1,
        },
      };

      const result = await stableApiGateway(
        [],
        [fastFunction, slowFunction],
        {
          concurrentExecution: true,
          enableRacing: true,
        }
      );

      // Should return responses for all functions
      expect(result.length).toBe(2);
      
      // First successful one should win
      const winner = result.find((r) => r.success);
      expect(winner).toBeDefined();
      expect(winner?.requestId).toBe('fast-function');
      expect(winner?.data).toBe('fast-result');

      // Other should be cancelled
      const cancelled = result.filter((r) => !r.success);
      expect(cancelled.length).toBe(1);
      expect(cancelled[0].error).toContain('Cancelled');
    });

    it('should handle racing with mixed requests and functions', async () => {
      const fastRequest: API_GATEWAY_REQUEST = {
        id: 'fast-request',
        requestOptions: {
          reqData: {
            hostname: 'jsonplaceholder.typicode.com',
            protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
            path: '/posts/1',
            method: REQUEST_METHODS.GET,
          },
          attempts: 1,
        },
      };

      const slowFunction: API_GATEWAY_FUNCTION<[], string> = {
        id: 'slow-function',
        functionOptions: {
          fn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            return 'slow-result';
          },
          args: [],
          attempts: 1,
        },
      };

      const result = await stableApiGateway(
        [fastRequest],
        [slowFunction],
        {
          concurrentExecution: true,
          enableRacing: true,
        }
      );

      // Should return responses for all items
      expect(result.length).toBe(2);
      
      // Request should win
      const winner = result.find((r) => r.success);
      expect(winner).toBeDefined();
      expect(winner?.requestId).toBe('fast-request');

      // Function should be cancelled
      const cancelled = result.find((r) => r.requestId === 'slow-function');
      expect(cancelled).toBeDefined();
      expect(cancelled?.success).toBe(false);
    });

    it('should handle function racing with all functions failing', async () => {
      const failFunction1: API_GATEWAY_FUNCTION<[], string> = {
        id: 'fail-function-1',
        functionOptions: {
          fn: async () => {
            throw new Error('Function 1 failed');
          },
          args: [],
          attempts: 1,
        },
      };

      const failFunction2: API_GATEWAY_FUNCTION<[], string> = {
        id: 'fail-function-2',
        functionOptions: {
          fn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            throw new Error('Function 2 failed');
          },
          args: [],
          attempts: 1,
        },
      };

      const result = await stableApiGateway([], [failFunction1, failFunction2], {
        concurrentExecution: true,
        enableRacing: true,
      });

      // Should return responses for all functions
      expect(result.length).toBeGreaterThan(0);
      
      // At least one should fail
      const failures = result.filter((r) => !r.success);
      expect(failures.length).toBeGreaterThan(0);
    });
  });

  describe('Branch Racing (Workflow Level)', () => {
    it('should complete only the first branch and cancel others', async () => {
      const fastBranch: STABLE_WORKFLOW_BRANCH = {
        id: 'fast-branch',
        phases: [
          {
            id: 'fast-phase-1',
            requests: [
              {
                id: 'fast-request-1',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/1',
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                },
              },
            ],
          },
        ],
      };

      const slowBranch: STABLE_WORKFLOW_BRANCH = {
        id: 'slow-branch',
        phases: [
          {
            id: 'slow-phase-1',
            requests: [
              {
                id: 'slow-request-1',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/2',
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                  wait: 3000, // Artificial delay
                },
              },
            ],
          },
        ],
      };

      const result = await stableWorkflow([], {
        enableBranchExecution: true,
        enableBranchRacing: true,
        branches: [fastBranch, slowBranch],
      });

      // Should have results from racing
      expect(result.branches).toBeDefined();
      expect(result.branches!.length).toBe(2);

      // Exactly one branch should win (network timing varies, so we don't assume which)
      const winners = result.branches!.filter((b) => b.success && !b.skipped);
      expect(winners.length).toBe(1);
      expect(winners[0].branchId).toMatch(/^(fast-branch|slow-branch)$/);

      // Other branch should be cancelled
      const cancelled = result.branches!.filter((b) => b.skipped);
      expect(cancelled.length).toBe(1);
      expect(cancelled[0].error).toContain('Cancelled');
    });

    it('should handle branch racing with multiple phases per branch', async () => {
      const fastBranch: STABLE_WORKFLOW_BRANCH = {
        id: 'fast-multi-phase-branch',
        phases: [
          {
            id: 'fast-phase-1',
            requests: [
              {
                id: 'fast-request-1',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/1',
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                },
              },
            ],
          },
          {
            id: 'fast-phase-2',
            requests: [
              {
                id: 'fast-request-2',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/2',
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                },
              },
            ],
          },
        ],
      };

      const slowBranch: STABLE_WORKFLOW_BRANCH = {
        id: 'slow-multi-phase-branch',
        phases: [
          {
            id: 'slow-phase-1',
            requests: [
              {
                id: 'slow-request-1',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/3',
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                  wait: 5000,
                },
              },
            ],
          },
        ],
      };

      const result = await stableWorkflow([], {
        enableBranchExecution: true,
        enableBranchRacing: true,
        branches: [fastBranch, slowBranch],
      });

      // One branch should complete (network timing varies)
      const winners = result.branches!.filter((b) => b.success && !b.skipped);
      expect(winners.length).toBe(1);
      
      // Winner should have completed its phases
      expect(winners[0].completedPhases).toBeGreaterThan(0);

      // Other branch should be cancelled
      const cancelled = result.branches!.filter((b) => b.skipped);
      expect(cancelled.length).toBe(1);
      expect(cancelled[0].error).toContain('Cancelled');
    });

    it('should handle branch racing with all branches failing', async () => {
      const failBranch1: STABLE_WORKFLOW_BRANCH = {
        id: 'fail-branch-1',
        phases: [
          {
            id: 'fail-phase-1',
            requests: [
              {
                id: 'fail-request-1',
                requestOptions: {
                  reqData: {
                    hostname: 'invalid-hostname-123.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/fail',
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                },
              },
            ],
          },
        ],
      };

      const failBranch2: STABLE_WORKFLOW_BRANCH = {
        id: 'fail-branch-2',
        phases: [
          {
            id: 'fail-phase-2',
            requests: [
              {
                id: 'fail-request-2',
                requestOptions: {
                  reqData: {
                    hostname: 'invalid-hostname-456.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/fail',
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                },
              },
            ],
          },
        ],
      };

      const result = await stableWorkflow([], {
        enableBranchExecution: true,
        enableBranchRacing: true,
        branches: [failBranch1, failBranch2],
      });

      // Should have branch results
      expect(result.branches).toBeDefined();
      expect(result.branches!.length).toBeGreaterThan(0);

      // At least one branch should fail or be cancelled
      const nonSuccessful = result.branches!.filter((b) => !b.success || b.skipped);
      expect(nonSuccessful.length).toBeGreaterThan(0);
    });

    it('should work with branch racing disabled (normal branch execution)', async () => {
      const branch1: STABLE_WORKFLOW_BRANCH = {
        id: 'normal-branch-1',
        phases: [
          {
            id: 'normal-phase-1',
            requests: [
              {
                id: 'normal-request-1',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/1',
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                },
              },
            ],
          },
        ],
      };

      const branch2: STABLE_WORKFLOW_BRANCH = {
        id: 'normal-branch-2',
        phases: [
          {
            id: 'normal-phase-2',
            requests: [
              {
                id: 'normal-request-2',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/2',
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                },
              },
            ],
          },
        ],
      };

      const result = await stableWorkflow([], {
        enableBranchExecution: true,
        enableBranchRacing: false,
        branches: [branch1, branch2],
      });

      // Both branches should complete
      expect(result.branches).toBeDefined();
      expect(result.branches!.length).toBe(2);

      // Both should succeed
      const successes = result.branches!.filter((b) => b.success);
      expect(successes.length).toBe(2);
    });

    it('should handle branch racing with function-based phases', async () => {
      const fastFunctionBranch: STABLE_WORKFLOW_BRANCH = {
        id: 'fast-function-branch',
        phases: [
          {
            id: 'fast-function-phase',
            functions: [
              {
                id: 'fast-function',
                functionOptions: {
                  fn: async () => {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    return 'fast-function-result';
                  },
                  args: [],
                  attempts: 1,
                },
              },
            ],
          },
        ],
      };

      const slowFunctionBranch: STABLE_WORKFLOW_BRANCH = {
        id: 'slow-function-branch',
        phases: [
          {
            id: 'slow-function-phase',
            functions: [
              {
                id: 'slow-function',
                functionOptions: {
                  fn: async () => {
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                    return 'slow-function-result';
                  },
                  args: [],
                  attempts: 1,
                },
              },
            ],
          },
        ],
      };

      const result = await stableWorkflow([], {
        enableBranchExecution: true,
        enableBranchRacing: true,
        branches: [fastFunctionBranch, slowFunctionBranch],
      });

      // Fast function branch should win
      const winner = result.branches!.find((b) => b.branchId === 'fast-function-branch');
      expect(winner).toBeDefined();
      expect(winner?.success).toBe(true);

      // Slow function branch should be cancelled
      const cancelled = result.branches!.find((b) => b.branchId === 'slow-function-branch');
      expect(cancelled).toBeDefined();
      expect(cancelled?.skipped).toBe(true);
    });
  });

  describe('Phase-Level Racing (within workflow phases)', () => {
    it('should enable racing for individual phases', async () => {
      const result = await stableWorkflow(
        [
          {
            id: 'racing-phase',
            requests: [
              {
                id: 'fast-req',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/1',
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                },
              },
              {
                id: 'slow-req',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/2',
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                  wait: 3000,
                },
              },
            ],
            concurrentExecution: true,
            commonConfig: {
              enableRacing: true,
            },
          },
        ],
        {
          logPhaseResults: false,
        }
      );

      // Phase should complete
      expect(result.phases.length).toBe(1);
      
      // Should have responses for all requests
      expect(result.phases[0].responses.length).toBe(2);

      // Exactly one should succeed (winner), others cancelled
      const winners = result.phases[0].responses.filter((r) => r.success);
      expect(winners.length).toBe(1);
      expect(winners[0].requestId).toMatch(/^(fast-req|slow-req)$/);

      const cancelled = result.phases[0].responses.filter((r) => !r.success);
      expect(cancelled.length).toBe(1);
      expect(cancelled[0].error).toContain('Cancelled');
      
      // Phase metrics should show 1 success, 1 failure (cancelled)
      expect(result.phases[0].successfulRequests).toBe(1);
      expect(result.phases[0].failedRequests).toBe(1);
    });
  });

  describe('Racing Performance and Edge Cases', () => {
    it('should handle racing with single request (no actual race)', async () => {
      const singleRequest: API_GATEWAY_REQUEST = {
        id: 'single-request',
        requestOptions: {
          reqData: {
            hostname: 'jsonplaceholder.typicode.com',
            protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
            path: '/posts/1',
            method: REQUEST_METHODS.GET,
          },
          attempts: 1,
        },
      };

      const result = await stableApiGateway([singleRequest], {
        concurrentExecution: true,
        enableRacing: true,
      });

      // Should complete successfully
      expect(result.length).toBe(1);
      expect(result[0].success).toBe(true);
    });

    it('should handle racing with empty requests array', async () => {
      const result = await stableApiGateway([], {
        concurrentExecution: true,
        enableRacing: true,
      });

      // Should return empty result
      expect(result.length).toBe(0);
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.totalRequests).toBe(0);
    });

    it('should measure racing performance metrics', async () => {
      const requests: API_GATEWAY_REQUEST[] = Array.from({ length: 5 }, (_, i) => ({
        id: `request-${i}`,
        requestOptions: {
          reqData: {
            hostname: 'jsonplaceholder.typicode.com',
            protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
            path: `/posts/${i + 1}`,
            method: REQUEST_METHODS.GET,
          },
          attempts: 1,
          wait: i * 500, // Different speeds
        },
      }));

      const startTime = Date.now();
      const result = await stableApiGateway(requests, {
        concurrentExecution: true,
        enableRacing: true,
      });
      const duration = Date.now() - startTime;

      // Should complete faster than the slowest request
      expect(duration).toBeLessThan(2000); // Less than slowest request

      // Metrics should be present
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.executionTime).toBeLessThan(2000);
    });
  });

  describe('Branch Racing (Workflow Graph Level)', () => {
    it('should support branch racing in workflow graphs', async () => {
      const { stableWorkflowGraph, WorkflowGraphBuilder } = await import('../src/index.js');
      
      const branch1: STABLE_WORKFLOW_BRANCH = {
        id: 'branch-1',
        phases: [
          {
            id: 'phase-1-1',
            requests: [
              {
                id: 'req-1-1',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/1' as `/${string}`,
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                },
              },
            ],
          },
        ],
      };

      const branch2: STABLE_WORKFLOW_BRANCH = {
        id: 'branch-2',
        phases: [
          {
            id: 'phase-2-1',
            requests: [
              {
                id: 'req-2-1',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/2' as `/${string}`,
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                  wait: 1000, // Slower
                },
              },
            ],
          },
        ],
      };

      const graph = new WorkflowGraphBuilder()
        .addBranch('branch-1', branch1)
        .addBranch('branch-2', branch2)
        .addParallelGroup('race-group', ['branch-1', 'branch-2'])
        .setEntryPoint('race-group')
        .build();

      const result = await stableWorkflowGraph(graph, {
        workflowId: 'graph-branch-racing-test',
        enableBranchRacing: true,
      });

      // Workflow should succeed
      expect(result.success).toBe(true);
      
      // Should have results from both branches
      expect(result.phases.length).toBeGreaterThanOrEqual(2);
      
      // Exactly one branch should succeed, one should be cancelled
      const successfulPhases = result.phases.filter((p) => p.success && !p.skipped);
      const cancelledPhases = result.phases.filter((p) => !p.success && p.skipped);
      
      expect(successfulPhases.length).toBeGreaterThanOrEqual(1);
      expect(cancelledPhases.length).toBeGreaterThanOrEqual(1);
      
      // Cancelled phases should have appropriate error
      cancelledPhases.forEach((phase) => {
        expect(phase.error).toContain('Cancelled');
      });
    });

    it('should handle graph branch racing with one branch failing', async () => {
      const { stableWorkflowGraph, WorkflowGraphBuilder } = await import('../src/index.js');
      
      const goodBranch: STABLE_WORKFLOW_BRANCH = {
        id: 'good-branch',
        phases: [
          {
            id: 'good-phase',
            requests: [
              {
                id: 'good-req',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/1' as `/${string}`,
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                },
              },
            ],
          },
        ],
      };

      const badBranch: STABLE_WORKFLOW_BRANCH = {
        id: 'bad-branch',
        phases: [
          {
            id: 'bad-phase',
            requests: [
              {
                id: 'bad-req',
                requestOptions: {
                  reqData: {
                    hostname: 'invalid-hostname-xyz.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/fail' as `/${string}`,
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                },
              },
            ],
          },
        ],
      };

      const graph = new WorkflowGraphBuilder()
        .addBranch('good-branch', goodBranch)
        .addBranch('bad-branch', badBranch)
        .addParallelGroup('race-group', ['good-branch', 'bad-branch'])
        .setEntryPoint('race-group')
        .build();

      const result = await stableWorkflowGraph(graph, {
        workflowId: 'graph-racing-with-failure',
        enableBranchRacing: true,
      });

      // One of the branches wins - could be good or bad depending on timing
      // So we just check that racing happened
      expect(result.phases.length).toBeGreaterThanOrEqual(2);
      
      // Should have one or more cancelled branches
      const cancelledPhases = result.phases.filter((p) => p.skipped);
      expect(cancelledPhases.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle graph branch racing with sequential phases after racing', async () => {
      const { stableWorkflowGraph, WorkflowGraphBuilder } = await import('../src/index.js');
      
      const branch1: STABLE_WORKFLOW_BRANCH = {
        id: 'racer-1',
        phases: [
          {
            id: 'race-phase-1',
            requests: [
              {
                id: 'race-req-1',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/1' as `/${string}`,
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                },
              },
            ],
          },
        ],
      };

      const branch2: STABLE_WORKFLOW_BRANCH = {
        id: 'racer-2',
        phases: [
          {
            id: 'race-phase-2',
            requests: [
              {
                id: 'race-req-2',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/2' as `/${string}`,
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                  wait: 500,
                },
              },
            ],
          },
        ],
      };

      const graph = new WorkflowGraphBuilder()
        .addBranch('racer-1', branch1)
        .addBranch('racer-2', branch2)
        .addParallelGroup('race-group', ['racer-1', 'racer-2'])
        .addPhase('final-phase', {
          requests: [
            {
              id: 'final-req',
              requestOptions: {
                reqData: {
                  hostname: 'jsonplaceholder.typicode.com',
                  protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                  path: '/posts/3' as `/${string}`,
                  method: REQUEST_METHODS.GET,
                },
                attempts: 1,
              },
            },
          ],
        })
        .connectSequence('race-group', 'final-phase')
        .setEntryPoint('race-group')
        .build();

      const result = await stableWorkflowGraph(graph, {
        workflowId: 'graph-racing-with-final-phase',
        enableBranchRacing: true,
      });

      // Should succeed
      expect(result.success).toBe(true);
      
      // Should have executed the final phase
      const finalPhase = result.phases.find((p) => p.phaseId === 'final-phase');
      expect(finalPhase).toBeDefined();
      expect(finalPhase?.success).toBe(true);
    });

    it('should not apply racing when enableBranchRacing is false in graphs', async () => {
      const { stableWorkflowGraph, WorkflowGraphBuilder } = await import('../src/index.js');
      
      const branch1: STABLE_WORKFLOW_BRANCH = {
        id: 'branch-no-race-1',
        phases: [
          {
            id: 'phase-nr-1',
            requests: [
              {
                id: 'req-nr-1',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/1' as `/${string}`,
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                },
              },
            ],
          },
        ],
      };

      const branch2: STABLE_WORKFLOW_BRANCH = {
        id: 'branch-no-race-2',
        phases: [
          {
            id: 'phase-nr-2',
            requests: [
              {
                id: 'req-nr-2',
                requestOptions: {
                  reqData: {
                    hostname: 'jsonplaceholder.typicode.com',
                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                    path: '/posts/2' as `/${string}`,
                    method: REQUEST_METHODS.GET,
                  },
                  attempts: 1,
                },
              },
            ],
          },
        ],
      };

      const graph = new WorkflowGraphBuilder()
        .addBranch('branch-no-race-1', branch1)
        .addBranch('branch-no-race-2', branch2)
        .addParallelGroup('no-race-group', ['branch-no-race-1', 'branch-no-race-2'])
        .setEntryPoint('no-race-group')
        .build();

      const result = await stableWorkflowGraph(graph, {
        workflowId: 'graph-no-racing',
        enableBranchRacing: false,
      });

      // Both branches should complete
      expect(result.success).toBe(true);
      
      // Both branches should succeed (no cancellation)
      const successfulPhases = result.phases.filter((p) => p.success);
      expect(successfulPhases.length).toBeGreaterThanOrEqual(2);
      
      // No phases should be cancelled
      const cancelledPhases = result.phases.filter((p) => p.skipped);
      expect(cancelledPhases.length).toBe(0);
    });
  });
});
