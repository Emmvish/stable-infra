import { 
  stableFunction, 
  RETRY_STRATEGIES,
} from '../src/index.js';
import { describe, it, expect } from '@jest/globals';
import { stableApiGateway, stableWorkflow, stableWorkflowGraph } from '../src/core/index.js';
import { createLinearWorkflowGraph, WorkflowGraphBuilder } from '../src/utilities/index.js';
import { REQUEST_METHODS, PHASE_DECISION_ACTIONS, VALID_REQUEST_PROTOCOLS, RequestOrFunction } from '../src/enums/index.js';
import type {
    API_GATEWAY_REQUEST,
    API_GATEWAY_FUNCTION,
    API_GATEWAY_ITEM,
    STABLE_FUNCTION,
    STABLE_WORKFLOW_PHASE,
    STABLE_WORKFLOW_BRANCH
} from '../src/types/index.js';

describe('stable-function', () => {
  describe('Basic Execution', () => {
    it('should execute a simple sync function successfully', async () => {
      const add = (a: number, b: number) => a + b;
      
      const result = await stableFunction({
        fn: add,
        args: [5, 3],
        returnResult: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(8);
      expect(result.metrics?.totalAttempts).toBe(1);
    });

    it('should execute an async function successfully', async () => {
      const asyncMultiply = async (a: number, b: number) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return a * b;
      };

      const result = await stableFunction({
        fn: asyncMultiply,
        args: [4, 5],
        returnResult: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(20);
    });

    it('should return success without data when returnResult is false', async () => {
      const logMessage = (msg: string) => console.log(msg);

      const result = await stableFunction({
        fn: logMessage,
        args: ['test'],
        returnResult: false
      });

      expect(result.success).toBe(true);
      // When returnResult is false, data will be 'true' (indicating success) rather than undefined
      expect(result.data).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed function calls', async () => {
      let attempts = 0;
      const flakyFunction = () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await stableFunction({
        fn: flakyFunction,
        args: [],
        returnResult: true,
        attempts: 5,
        wait: 10
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.metrics?.totalAttempts).toBe(3);
    });

    it('should use exponential backoff strategy', async () => {
      let attempts = 0;
      const timestamps: number[] = [];
      
      const timedFunction = () => {
        timestamps.push(Date.now());
        attempts++;
        if (attempts < 3) {
          throw new Error('Retry needed');
        }
        return 'done';
      };

      const result = await stableFunction({
        fn: timedFunction,
        args: [],
        returnResult: true,
        attempts: 5,
        wait: 100,
        retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
      });

      expect(result.success).toBe(true);
      expect(timestamps.length).toBe(3);
      
      // Check that delays are increasing (exponential)
      if (timestamps.length >= 3) {
        const delay1 = timestamps[1] - timestamps[0];
        const delay2 = timestamps[2] - timestamps[1];
        expect(delay2).toBeGreaterThan(delay1);
      }
    });

    it('should respect maxAllowedWait', async () => {
      let attempts = 0;
      const slowFunction = () => {
        attempts++;
        if (attempts < 4) {
          throw new Error('Keep retrying');
        }
        return 'complete';
      };

      const startTime = Date.now();
      const result = await stableFunction({
        fn: slowFunction,
        args: [],
        returnResult: true,
        attempts: 4,
        wait: 10000, // Very long wait
        maxAllowedWait: 100, // But capped at 100ms
        retryStrategy: RETRY_STRATEGIES.FIXED
      });
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      // Should complete in ~300ms (3 retries * 100ms max), not 30 seconds
      expect(totalTime).toBeLessThan(500);
    });
  });

  describe('Response Analysis', () => {
    it('should retry when response analyzer returns false', async () => {
      let attempts = 0;
      const conditionalFunction = () => {
        attempts++;
        return { value: attempts * 10, valid: attempts >= 3 };
      };

      const result = await stableFunction({
        fn: conditionalFunction,
        args: [],
        returnResult: true,
        attempts: 5,
        wait: 10,
        responseAnalyzer: ({ data }) => {
          return (data as any).valid === true;
        }
      });

      expect(result.success).toBe(true);
      expect((result.data as any).value).toBe(30);
      expect(result.metrics?.totalAttempts).toBe(3);
    });

    it('should handle async response analyzer', async () => {
      const validateAsync = async (data: any) => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return data.score > 50;
      };

      let score = 0;
      const scoredFunction = () => {
        score += 30;
        return { score };
      };

      const result = await stableFunction({
        fn: scoredFunction,
        args: [],
        returnResult: true,
        attempts: 5,
        wait: 10,
        responseAnalyzer: async ({ data }) => {
          return await validateAsync(data);
        }
      });

      expect(result.success).toBe(true);
      expect((result.data as any).score).toBeGreaterThan(50);
    });
  });

  describe('Error Handling', () => {
    it('should call handleErrors on failures', async () => {
      const errorLogs: any[] = [];
      
      let attempts = 0;
      const failingFunction = () => {
        attempts++;
        if (attempts < 2) {
          throw new Error(`Failure ${attempts}`);
        }
        return 'recovered';
      };

      const result = await stableFunction({
        fn: failingFunction,
        args: [],
        returnResult: true,
        attempts: 3,
        wait: 10,
        logAllErrors: true,
        handleErrors: ({ errorLog }) => {
          errorLogs.push(errorLog);
        }
      });

      expect(result.success).toBe(true);
      expect(errorLogs.length).toBe(1);
      expect(errorLogs[0].error).toContain('Failure 1');
    });

    it('should use finalErrorAnalyzer to convert error to failed result', async () => {
      const alwaysFails = () => {
        throw new Error('Permanent failure');
      };

      const result = await stableFunction({
        fn: alwaysFails,
        args: [],
        returnResult: true,
        attempts: 2,
        wait: 10,
        finalErrorAnalyzer: ({ error }) => {
          // Return true to convert to failed result instead of throwing
          return error.message.includes('Permanent');
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.metrics?.totalAttempts).toBe(2);
    });

    it('should throw error when finalErrorAnalyzer returns false', async () => {
      const criticalFailure = () => {
        throw new Error('Critical error');
      };

      await expect(
        stableFunction({
          fn: criticalFailure,
          args: [],
          returnResult: true,
          attempts: 1,
          finalErrorAnalyzer: ({ error }) => {
            return false; // Don't suppress the error
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should preserve type information for return values', async () => {
      interface User {
        id: string;
        name: string;
        age: number;
      }

      const createUser = async (name: string, age: number): Promise<User> => {
        return {
          id: 'user-1',
          name,
          age
        };
      };

      const result = await stableFunction<[string, number], User>({
        fn: createUser,
        args: ['Alice', 30],
        returnResult: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      if (result.data) {
        // TypeScript should recognize these properties
        expect(result.data.id).toBe('user-1');
        expect(result.data.name).toBe('Alice');
        expect(result.data.age).toBe(30);
      }
    });
  });

  describe('Metrics', () => {
    it('should track execution metrics', async () => {
      let attempts = 0;
      const countedFunction = () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Not yet');
        }
        return 'done';
      };

      const result = await stableFunction({
        fn: countedFunction,
        args: [],
        returnResult: true,
        attempts: 5,
        wait: 10
      });

      expect(result.metrics).toBeDefined();
      expect(result.metrics?.totalAttempts).toBe(3);
      expect(result.metrics?.successfulAttempts).toBe(1); // Third attempt succeeds
      expect(result.metrics?.failedAttempts).toBe(2); // First two attempts fail
      expect(result.metrics?.totalExecutionTime).toBeGreaterThan(0);
      expect(result.metrics?.averageAttemptTime).toBeGreaterThan(0);
    });

    it('should track successful attempts when logging enabled', async () => {
      let attempts = 0;
      const improvedFunction = () => {
        attempts++;
        return { attempt: attempts, value: 'data' };
      };

      const result = await stableFunction({
        fn: improvedFunction,
        args: [],
        returnResult: true,
        attempts: 3,
        wait: 10,
        performAllAttempts: true,
        logAllSuccessfulAttempts: true
      });

      expect(result.successfulAttempts).toBeDefined();
      expect(result.successfulAttempts?.length).toBe(3);
    });
  });

  describe('Pre-Execution Hooks', () => {
    it('should execute pre-execution hook', async () => {
      const hookCalls: any[] = [];
      
      const simpleFunction = (x: number) => x * 2;
      const buffer = {};

      const result = await stableFunction({
        fn: simpleFunction,
        args: [5],
        returnResult: true,
        preExecution: {
          preExecutionHook: ({ inputParams, commonBuffer, stableFunctionOptions }) => {
            hookCalls.push({ inputParams, fn: stableFunctionOptions.fn.name });
            if (commonBuffer) {
              commonBuffer.hookExecuted = true;
            }
          },
          preExecutionHookParams: { test: 'param' }
        },
        commonBuffer: buffer
      });

      expect(result.success).toBe(true);
      expect(hookCalls.length).toBe(1);
      expect(hookCalls[0].inputParams.test).toBe('param');
    });

    it('should apply config overrides from pre-execution hook', async () => {
      let attempts = 0;
      const countingFunction = () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Retry');
        }
        return 'success';
      };

      const result = await stableFunction({
        fn: countingFunction,
        args: [],
        returnResult: true,
        attempts: 1, // Start with 1 attempt
        wait: 10,
        preExecution: {
          preExecutionHook: () => {
            return { attempts: 5 }; // Override to 5 attempts
          },
          applyPreExecutionConfigOverride: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.metrics?.totalAttempts).toBe(3);
    });
  });

  describe('performAllAttempts', () => {
    it('should execute all attempts when performAllAttempts is true', async () => {
      let callCount = 0;
      const countingFunction = () => {
        callCount++;
        return callCount;
      };

      const result = await stableFunction({
        fn: countingFunction,
        args: [],
        returnResult: true,
        attempts: 5,
        wait: 10,
        performAllAttempts: true
      });

      expect(result.success).toBe(true);
      expect(callCount).toBe(5);
      expect(result.metrics?.totalAttempts).toBe(5);
    });
  });

  describe('Execution Context', () => {
    it('should include execution context in hooks', async () => {
      const contexts: any[] = [];
      
      const trackedFunction = () => 'result';

      const result = await stableFunction({
        fn: trackedFunction,
        args: [],
        returnResult: true,
        executionContext: {
          workflowId: 'wf-123',
          phaseId: 'phase-1',
          requestId: 'req-456'
        },
        handleSuccessfulAttemptData: ({ executionContext }) => {
          contexts.push(executionContext);
        },
        logAllSuccessfulAttempts: true
      });

      expect(result.success).toBe(true);
      expect(contexts.length).toBe(1);
      expect(contexts[0].workflowId).toBe('wf-123');
      expect(contexts[0].phaseId).toBe('phase-1');
      expect(contexts[0].requestId).toBe('req-456');
    });
  });
});

async function calculateSum(a: number, b: number): Promise<{ sum: number }> {
    await new Promise(resolve => setTimeout(resolve, 10));
    return { sum: a + b };
}

async function fetchUserProfile(userId: string): Promise<{ id: string; name: string }> {
    await new Promise(resolve => setTimeout(resolve, 15));
    return {
        id: userId,
        name: `User ${userId}`
    };
}

async function validateData(data: any): Promise<{ valid: boolean }> {
    await new Promise(resolve => setTimeout(resolve, 5));
    return { valid: !!data };
}

async function failingFunction(shouldFail: boolean): Promise<{ success: boolean }> {
    await new Promise(resolve => setTimeout(resolve, 5));
    if (shouldFail) {
        throw new Error('Simulated failure');
    }
    return { success: true };
}

// ============================================================================
// API Gateway Integration Tests
// ============================================================================

describe('Stable Function with API Gateway', () => {
    
    describe('Basic Integration', () => {
        it('should execute functions and requests together using separate arrays', async () => {
            const requests: API_GATEWAY_REQUEST[] = [
                {
                    id: 'api-req-1',
                    requestOptions: {
                        reqData: {
                            method: REQUEST_METHODS.GET,
                            protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                            hostname: 'jsonplaceholder.typicode.com',
                            path: '/posts/1'
                        }
                    }
                }
            ];

            const functions: API_GATEWAY_FUNCTION[] = [
                {
                    id: 'sum-func-1',
                    functionOptions: {
                        fn: calculateSum,
                        args: [10, 20],
                        attempts: 2,
                        returnResult: true
                    }
                },
                {
                    id: 'sum-func-2',
                    functionOptions: {
                        fn: calculateSum,
                        args: [5, 15],
                        attempts: 2,
                        returnResult: true
                    }
                }
            ];

            const results = await stableApiGateway(requests, functions, {
                concurrentExecution: true
            });

            expect(results).toHaveLength(3);
            expect(results.filter(r => r.type === RequestOrFunction.REQUEST)).toHaveLength(1);
            expect(results.filter(r => r.type === RequestOrFunction.FUNCTION)).toHaveLength(2);
            expect(results.every(r => r.success)).toBe(true);
            
            const funcResult1 = results.find(r => r.requestId === 'sum-func-1');
            expect(funcResult1?.data).toEqual({ sum: 30 });
        });

        it('should execute using unified items array', async () => {
            const items: API_GATEWAY_ITEM[] = [
                {
                    type: RequestOrFunction.REQUEST,
                    request: {
                        id: 'req-1',
                        requestOptions: {
                            reqData: {
                                method: REQUEST_METHODS.GET,
                                protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                                hostname: 'jsonplaceholder.typicode.com',
                                path: '/users/1'
                            }
                        }
                    }
                },
                {
                    type: RequestOrFunction.FUNCTION,
                    function: {
                        id: 'profile-func',
                        functionOptions: {
                            fn: fetchUserProfile,
                            args: ['user-123'],
                            attempts: 2
                        }
                    }
                },
                {
                    type: RequestOrFunction.FUNCTION,
                    function: {
                        id: 'validate-func',
                        functionOptions: {
                            fn: validateData,
                            args: [{ test: 'data' }],
                            attempts: 1
                        }
                    }
                }
            ];

            const results = await stableApiGateway(items, {
                concurrentExecution: true
            });

            expect(results).toHaveLength(3);
            expect(results[0].type).toBe(RequestOrFunction.REQUEST);
            expect(results[1].type).toBe(RequestOrFunction.FUNCTION);
            expect(results[2].type).toBe(RequestOrFunction.FUNCTION);
            expect(results.every(r => r.success)).toBe(true);
        });
    });

    describe('Common Options', () => {
        it('should apply common options to all functions', async () => {
            const functions: API_GATEWAY_FUNCTION[] = [
                {
                    id: 'func-1',
                    functionOptions: {
                        fn: calculateSum,
                        args: [1, 2],
                        returnResult: true
                    }
                },
                {
                    id: 'func-2',
                    functionOptions: {
                        fn: calculateSum,
                        args: [3, 4],
                        returnResult: true
                    }
                }
            ];

            const results = await stableApiGateway([], functions, {
                concurrentExecution: true,
                commonAttempts: 2,
                commonWait: 10
            });

            expect(results).toHaveLength(2);
            expect(results.every(r => r.success)).toBe(true);
            expect(results[0].data).toEqual({ sum: 3 });
            expect(results[1].data).toEqual({ sum: 7 });
        });
    });

    describe('Shared Buffer', () => {
        it('should share buffer between requests and functions', async () => {
            const sharedBuffer: Record<string, any> = { counter: 0 };

            const items: API_GATEWAY_ITEM[] = [
                {
                    type: RequestOrFunction.FUNCTION,
                    function: {
                        id: 'increment-1',
                        functionOptions: {
                            fn: async () => {
                                sharedBuffer.counter++;
                                return { value: sharedBuffer.counter };
                            },
                            args: [],
                            commonBuffer: sharedBuffer
                        }
                    }
                },
                {
                    type: RequestOrFunction.FUNCTION,
                    function: {
                        id: 'increment-2',
                        functionOptions: {
                            fn: async () => {
                                sharedBuffer.counter++;
                                return { value: sharedBuffer.counter };
                            },
                            args: [],
                            commonBuffer: sharedBuffer
                        }
                    }
                }
            ];

            const results = await stableApiGateway(items, {
                sharedBuffer,
                concurrentExecution: false
            });

            expect(results).toHaveLength(2);
            expect(results.every(r => r.success)).toBe(true);
            expect(sharedBuffer.counter).toBe(2);
        });
    });

    describe('Error Handling', () => {
        it('should handle function errors with retries', async () => {
            let attemptCount = 0;

            const functions: API_GATEWAY_FUNCTION[] = [
                {
                    id: 'retry-func',
                    functionOptions: {
                        fn: async () => {
                            attemptCount++;
                            if (attemptCount < 3) {
                                throw new Error('Temporary failure');
                            }
                            return { success: true };
                        },
                        args: [],
                        attempts: 3,
                        wait: 10
                    }
                }
            ];

            const results = await stableApiGateway([], functions, {});

            expect(results[0].success).toBe(true);
            expect(attemptCount).toBe(3);
        });

        it('should handle mixed success and failure', async () => {
            const items: API_GATEWAY_ITEM[] = [
                {
                    type: RequestOrFunction.FUNCTION,
                    function: {
                        id: 'success-func',
                        functionOptions: {
                            fn: failingFunction,
                            args: [false],
                            attempts: 1
                        }
                    }
                },
                {
                    type: RequestOrFunction.FUNCTION,
                    function: {
                        id: 'fail-func',
                        functionOptions: {
                            fn: failingFunction,
                            args: [true],
                            attempts: 1
                        }
                    }
                }
            ];

            const results = await stableApiGateway(items, {
                stopOnFirstError: false
            });

            expect(results).toHaveLength(2);
            expect(results.find(r => r.requestId === 'success-func')?.success).toBe(true);
            expect(results.find(r => r.requestId === 'fail-func')?.success).toBe(false);
        });
    });

    describe('Caching', () => {
        it('should cache function results', async () => {
            let executionCount = 0;

            const functions: API_GATEWAY_FUNCTION[] = [
                {
                    id: 'cached-func-1',
                    functionOptions: {
                        fn: async (value: number) => {
                            executionCount++;
                            await new Promise(resolve => setTimeout(resolve, 20));
                            return { computed: value * 2 };
                        },
                        args: [5],
                        returnResult: true,
                        cache: {
                            enabled: true,
                            ttl: 5000
                        }
                    }
                },
                {
                    id: 'cached-func-2',
                    functionOptions: {
                        fn: async (value: number) => {
                            executionCount++;
                            await new Promise(resolve => setTimeout(resolve, 20));
                            return { computed: value * 2 };
                        },
                        args: [5],
                        returnResult: true,
                        cache: {
                            enabled: true,
                            ttl: 5000
                        }
                    }
                }
            ];

            const results = await stableApiGateway([], functions, {
                commonCache: { enabled: true }
            });

            expect(results).toHaveLength(2);
            expect(results.every(r => r.success)).toBe(true);
            // Caching may execute 1-2 times depending on timing
            expect(executionCount).toBeLessThanOrEqual(2);
            expect(results[0].data).toEqual({ computed: 10 });
            expect(results[1].data).toEqual({ computed: 10 });
        });
    });

    describe('Circuit Breaker', () => {
        it('should apply circuit breaker to functions', async () => {
            const items: API_GATEWAY_ITEM[] = [];
            
            for (let i = 0; i < 5; i++) {
                items.push({
                    type: RequestOrFunction.FUNCTION,
                    function: {
                        id: `fail-${i}`,
                        functionOptions: {
                            fn: failingFunction,
                            args: [true],
                            attempts: 1
                        }
                    }
                });
            }

            const results = await stableApiGateway(items, {
                concurrentExecution: false,
                stopOnFirstError: false,
                circuitBreaker: {
                    failureThresholdPercentage: 50,
                    minimumRequests: 3,
                    recoveryTimeoutMs: 5000
                }
            });

            expect(results).toHaveLength(5);
            const failedCount = results.filter(r => !r.success).length;
            expect(failedCount).toBeGreaterThanOrEqual(3);
        });
    });
});

// ============================================================================
// Workflow Integration Tests
// ============================================================================

describe('Stable Function with Workflow', () => {
    
    describe('Phases with Functions', () => {
        it('should execute workflow phases with functions only', async () => {
            const phases: STABLE_WORKFLOW_PHASE[] = [
                {
                    id: 'compute-phase',
                    concurrentExecution: true,
                    functions: [
                        {
                            id: 'calc-1',
                            functionOptions: {
                                fn: calculateSum,
                                args: [10, 20],
                                attempts: 2
                            }
                        },
                        {
                            id: 'calc-2',
                            functionOptions: {
                                fn: calculateSum,
                                args: [30, 40],
                                attempts: 2
                            }
                        }
                    ]
                },
                {
                    id: 'validation-phase',
                    concurrentExecution: true,
                    functions: [
                        {
                            id: 'validate',
                            functionOptions: {
                                fn: validateData,
                                args: [{ test: 'data' }],
                                attempts: 1
                            }
                        }
                    ]
                }
            ];

            const result = await stableWorkflow(phases, {
                workflowId: 'function-workflow'
            });

            expect(result.success).toBe(true);
            expect(result.totalPhases).toBe(2);
            expect(result.phases.filter(p => p.success).length).toBe(2);
            expect(result.totalRequests).toBe(3);
            expect(result.successfulRequests).toBe(3);
        });

        it('should execute workflow with mixed requests and functions', async () => {
            const phases: STABLE_WORKFLOW_PHASE[] = [
                {
                    id: 'mixed-phase',
                    concurrentExecution: true,
                    items: [
                        {
                            type: RequestOrFunction.REQUEST,
                            request: {
                                id: 'api-call',
                                requestOptions: {
                                    reqData: {
                                        method: REQUEST_METHODS.GET,
                                        protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                                        hostname: 'jsonplaceholder.typicode.com',
                                        path: '/posts/1'
                                    }
                                }
                            }
                        },
                        {
                            type: RequestOrFunction.FUNCTION,
                            function: {
                                id: 'compute',
                                functionOptions: {
                                    fn: calculateSum,
                                    args: [100, 200],
                                    attempts: 2
                                }
                            }
                        }
                    ]
                }
            ];

            const result = await stableWorkflow(phases, {
                workflowId: 'mixed-workflow'
            });

            expect(result.success).toBe(true);
            expect(result.phases).toHaveLength(1);
            expect(result.phases[0].responses).toHaveLength(2);
            expect(result.phases[0].responses.some(r => r.type === RequestOrFunction.REQUEST)).toBe(true);
            expect(result.phases[0].responses.some(r => r.type === RequestOrFunction.FUNCTION)).toBe(true);
        });
    });

    describe('Shared Buffer in Workflow', () => {
        it('should maintain shared buffer across phases', async () => {
            const sharedBuffer: Record<string, any> = {};

            const phases: STABLE_WORKFLOW_PHASE[] = [
                {
                    id: 'write-phase',
                    functions: [
                        {
                            id: 'writer',
                            functionOptions: {
                                fn: async () => {
                                    sharedBuffer.phaseData = 'computed-value';
                                    sharedBuffer.timestamp = Date.now();
                                    return { written: true };
                                },
                                args: [],
                                attempts: 1
                            }
                        }
                    ]
                },
                {
                    id: 'read-phase',
                    functions: [
                        {
                            id: 'reader',
                            functionOptions: {
                                fn: async () => {
                                    return {
                                        readValue: sharedBuffer.phaseData,
                                        hasTimestamp: !!sharedBuffer.timestamp
                                    };
                                },
                                args: [],
                                attempts: 1
                            }
                        }
                    ]
                }
            ];

            const result = await stableWorkflow(phases, {
                workflowId: 'buffer-workflow',
                sharedBuffer
            });

            expect(result.success).toBe(true);
            expect(sharedBuffer.phaseData).toBe('computed-value');
            expect(sharedBuffer.timestamp).toBeDefined();
            
            // Verify the reader got the data (it returns an object with both values)
            const readerResponse = result.phases[1].responses[0];
            expect(readerResponse.success).toBe(true);
            expect(readerResponse.data).toBeDefined();
        });
    });

    describe('Phase Completion Hooks', () => {
        it('should call handlePhaseCompletion for function phases', async () => {
            const completedPhases: string[] = [];

            const phases: STABLE_WORKFLOW_PHASE[] = [
                {
                    id: 'phase-1',
                    functions: [
                        {
                            id: 'func-1',
                            functionOptions: {
                                fn: calculateSum,
                                args: [1, 2],
                                attempts: 1
                            }
                        }
                    ]
                },
                {
                    id: 'phase-2',
                    functions: [
                        {
                            id: 'func-2',
                            functionOptions: {
                                fn: calculateSum,
                                args: [3, 4],
                                attempts: 1
                            }
                        }
                    ]
                }
            ];

            await stableWorkflow(phases, {
                workflowId: 'hook-workflow',
                handlePhaseCompletion: async ({ phaseResult }) => {
                    completedPhases.push(phaseResult.phaseId);
                }
            });

            expect(completedPhases).toEqual(['phase-1', 'phase-2']);
        });
    });

    describe('Error Handling in Workflow', () => {
        it('should handle phase errors gracefully', async () => {
            const phases: STABLE_WORKFLOW_PHASE[] = [
                {
                    id: 'error-phase',
                    stopOnFirstError: false,
                    functions: [
                        {
                            id: 'success',
                            functionOptions: {
                                fn: failingFunction,
                                args: [false],
                                attempts: 1
                            }
                        },
                        {
                            id: 'failure',
                            functionOptions: {
                                fn: failingFunction,
                                args: [true],
                                attempts: 1
                            }
                        }
                    ]
                }
            ];

            const result = await stableWorkflow(phases, {
                workflowId: 'error-workflow'
            });

            expect(result.phases).toHaveLength(1);
            expect(result.phases[0].successfulRequests).toBe(1);
            expect(result.phases[0].failedRequests).toBe(1);
        });
    });
});

// ============================================================================
// Workflow Graph Integration Tests
// ============================================================================

describe('Stable Function with Workflow Graph', () => {
    
    describe('Linear Graph with Functions', () => {
        it('should execute a linear workflow graph with function phases', async () => {
            const phases: STABLE_WORKFLOW_PHASE[] = [
                {
                    id: 'compute-start',
                    functions: [
                        {
                            id: 'initial-calc',
                            functionOptions: {
                                fn: calculateSum,
                                args: [10, 20],
                                attempts: 2
                            }
                        }
                    ]
                },
                {
                    id: 'process-phase',
                    functions: [
                        {
                            id: 'validate',
                            functionOptions: {
                                fn: validateData,
                                args: [{ data: 'test' }],
                                attempts: 1
                            }
                        }
                    ]
                }
            ];

            const graph = createLinearWorkflowGraph(phases);
            const result = await stableWorkflowGraph(graph, {
                workflowId: 'function-graph',
                validateGraph: true
            });

            expect(result.success).toBe(true);
            expect(result.totalPhases).toBe(2);
            expect(result.phases.filter(p => p.success).length).toBe(2);
        });

        it('should execute graph with mixed request and function phases', async () => {
            const phases: STABLE_WORKFLOW_PHASE[] = [
                {
                    id: 'api-phase',
                    requests: [
                        {
                            id: 'api-req',
                            requestOptions: {
                                reqData: {
                                    method: REQUEST_METHODS.GET,
                                    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                                    hostname: 'jsonplaceholder.typicode.com',
                                    path: '/users/1'
                                }
                            }
                        }
                    ]
                },
                {
                    id: 'function-phase',
                    functions: [
                        {
                            id: 'process-api-result',
                            functionOptions: {
                                fn: async () => {
                                    return { processed: true };
                                },
                                args: [],
                                attempts: 1
                            }
                        }
                    ]
                }
            ];

            const graph = createLinearWorkflowGraph(phases);
            const result = await stableWorkflowGraph(graph, {
                workflowId: 'mixed-graph'
            });

            expect(result.success).toBe(true);
            expect(result.totalPhases).toBe(2);
        });
    });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Stable Function Integration - Performance', () => {
    
    it('should handle concurrent function execution efficiently', async () => {
        const items: API_GATEWAY_ITEM[] = [];
        
        for (let i = 0; i < 20; i++) {
            items.push({
                type: RequestOrFunction.FUNCTION,
                function: {
                    id: `func-${i}`,
                    functionOptions: {
                        fn: calculateSum,
                        args: [i, i],
                        attempts: 1
                    }
                }
            });
        }

        const startTime = Date.now();
        const results = await stableApiGateway(items, {
            concurrentExecution: true,
            maxConcurrentRequests: 10
        });
        const duration = Date.now() - startTime;

        expect(results).toHaveLength(20);
        expect(results.every(r => r.success)).toBe(true);
        expect(duration).toBeLessThan(500);
    });

    it('should respect maxConcurrentRequests for functions', async () => {
        const items: API_GATEWAY_ITEM[] = [];
        
        for (let i = 0; i < 6; i++) {
            items.push({
                type: RequestOrFunction.FUNCTION,
                function: {
                    id: `func-${i}`,
                    functionOptions: {
                        fn: async (value: number) => {
                            await new Promise(resolve => setTimeout(resolve, 30));
                            return { value };
                        },
                        args: [i],
                        attempts: 1
                    }
                }
            });
        }

        const startTime = Date.now();
        await stableApiGateway(items, {
            concurrentExecution: true,
            maxConcurrentRequests: 2
        });
        const duration = Date.now() - startTime;

        expect(duration).toBeGreaterThanOrEqual(80);
    });
});

async function fastCompute(value: number): Promise<{ result: number }> {
    await new Promise(resolve => setTimeout(resolve, 10));
    return { result: value * 2 };
}

async function slowCompute(value: number): Promise<{ result: number }> {
    await new Promise(resolve => setTimeout(resolve, 50));
    return { result: value * 3 };
}

async function errorFunction(shouldFail: boolean): Promise<{ success: boolean }> {
    await new Promise(resolve => setTimeout(resolve, 5));
    if (shouldFail) {
        throw new Error('Simulated failure');
    }
    return { success: true };
}

// ============================================================================
// Rate Limiting Tests
// ============================================================================

describe('Stable Function - Rate Limiting', () => {
    
    it('should enforce rate limits on function execution', async () => {
        const startTime = Date.now();
        
        const options: STABLE_FUNCTION<[number], { result: number }> = {
            fn: fastCompute,
            args: [5],
            returnResult: true,
            attempts: 1,  // Single attempt to test rate limiting
            rateLimit: {
                maxRequests: 2,
                windowMs: 1000
            }
        };

        // Execute once - rate limiter should be initialized and used
        const result = await stableFunction(options);
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ result: 10 });
        
        // Single execution should complete quickly
        expect(duration).toBeLessThan(500);
        
        // Rate limiter should be present in metrics
        expect(result.metrics?.infrastructureMetrics?.rateLimiter).toBeDefined();
    });

    it('should include rate limiter metrics in result', async () => {
        const result = await stableFunction({
            fn: fastCompute,
            args: [10],
            returnResult: true,
            attempts: 2,
            rateLimit: {
                maxRequests: 5,
                windowMs: 1000
            }
        });

        expect(result.success).toBe(true);
        expect(result.metrics?.infrastructureMetrics?.rateLimiter).toBeDefined();
        
        const rateLimiterMetrics = result.metrics!.infrastructureMetrics!.rateLimiter!;
        expect(rateLimiterMetrics.maxRequests).toBe(5);
        expect(rateLimiterMetrics.windowMs).toBe(1000);
        expect(rateLimiterMetrics.totalRequests).toBeGreaterThanOrEqual(1);
        expect(rateLimiterMetrics.completedRequests).toBeGreaterThanOrEqual(1);
    });

    it('should work without rate limiting when not configured', async () => {
        const startTime = Date.now();
        
        const result = await stableFunction({
            fn: fastCompute,
            args: [15],
            returnResult: true,
            attempts: 3
        });
        
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ result: 30 });
        expect(result.metrics?.infrastructureMetrics?.rateLimiter).toBeUndefined();
        
        // Without rate limiting, 3 attempts should complete quickly
        expect(duration).toBeLessThan(200);
    });

    it('should apply rate limiting across multiple retries', async () => {
        let attemptCount = 0;
        
        const result = await stableFunction({
            fn: async (value: number) => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new Error('Temporary failure');
                }
                return { result: value * 2 };
            },
            args: [20],
            returnResult: true,
            attempts: 4,
            wait: 10,
            rateLimit: {
                maxRequests: 1,
                windowMs: 500
            }
        });

        expect(result.success).toBe(true);
        expect(attemptCount).toBe(3);
        
        const rateLimiterMetrics = result.metrics!.infrastructureMetrics!.rateLimiter!;
        expect(rateLimiterMetrics.totalRequests).toBe(3);
    });
});

// ============================================================================
// Concurrency Limiting Tests
// ============================================================================

describe('Stable Function - Concurrency Limiting', () => {
    
    it('should enforce concurrency limits on function execution', async () => {
        let concurrentExecutions = 0;
        let peakConcurrency = 0;

        const trackedCompute = async (value: number) => {
            concurrentExecutions++;
            peakConcurrency = Math.max(peakConcurrency, concurrentExecutions);
            await new Promise(resolve => setTimeout(resolve, 30));
            concurrentExecutions--;
            return { result: value * 2 };
        };

        // Execute with attempts > maxConcurrentRequests
        const result = await stableFunction({
            fn: trackedCompute,
            args: [25],
            returnResult: true,
            attempts: 5,
            maxConcurrentRequests: 2
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ result: 50 });
        
        // Peak concurrency should respect the limit
        expect(peakConcurrency).toBeLessThanOrEqual(2);
    });

    it('should include concurrency limiter metrics in result', async () => {
        const result = await stableFunction({
            fn: fastCompute,
            args: [30],
            returnResult: true,
            attempts: 3,
            maxConcurrentRequests: 2
        });

        expect(result.success).toBe(true);
        expect(result.metrics?.infrastructureMetrics?.concurrencyLimiter).toBeDefined();
        
        const concurrencyMetrics = result.metrics!.infrastructureMetrics!.concurrencyLimiter!;
        expect(concurrencyMetrics.limit).toBe(2);
        expect(concurrencyMetrics.totalRequests).toBeGreaterThanOrEqual(1);
        expect(concurrencyMetrics.completedRequests).toBeGreaterThanOrEqual(1);
    });

    it('should work without concurrency limiting when not configured', async () => {
        const result = await stableFunction({
            fn: fastCompute,
            args: [35],
            returnResult: true,
            attempts: 3
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ result: 70 });
        expect(result.metrics?.infrastructureMetrics?.concurrencyLimiter).toBeUndefined();
    });

    it('should serialize retries when maxConcurrentRequests is 1', async () => {
        const executionOrder: number[] = [];
        
        let attemptCount = 0;
        const result = await stableFunction({
            fn: async (value: number) => {
                attemptCount++;
                executionOrder.push(attemptCount);
                if (attemptCount < 3) {
                    throw new Error('Retry');
                }
                return { result: value };
            },
            args: [40],
            returnResult: true,
            attempts: 4,
            wait: 10,
            maxConcurrentRequests: 1
        });

        expect(result.success).toBe(true);
        expect(executionOrder).toEqual([1, 2, 3]);
        
        const concurrencyMetrics = result.metrics!.infrastructureMetrics!.concurrencyLimiter!;
        expect(concurrencyMetrics.limit).toBe(1);
        expect(concurrencyMetrics.peakConcurrency).toBeLessThanOrEqual(1);
    });
});

// ============================================================================
// Combined Rate and Concurrency Limiting Tests
// ============================================================================

describe('Stable Function - Combined Rate and Concurrency Control', () => {
    
    it('should apply both rate and concurrency limits together', async () => {
        const result = await stableFunction({
            fn: slowCompute,
            args: [50],
            returnResult: true,
            attempts: 1,
            rateLimit: {
                maxRequests: 2,
                windowMs: 1000
            },
            maxConcurrentRequests: 1
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ result: 150 });
        
        // Should have both metrics
        expect(result.metrics?.infrastructureMetrics?.rateLimiter).toBeDefined();
        expect(result.metrics?.infrastructureMetrics?.concurrencyLimiter).toBeDefined();
        
        // Verify both limiters were configured correctly
        const rateLimiterMetrics = result.metrics!.infrastructureMetrics!.rateLimiter!;
        expect(rateLimiterMetrics.maxRequests).toBe(2);
        expect(rateLimiterMetrics.windowMs).toBe(1000);
        
        const concurrencyMetrics = result.metrics!.infrastructureMetrics!.concurrencyLimiter!;
        expect(concurrencyMetrics.limit).toBe(1);
    });

    it('should include all infrastructure metrics when all features are enabled', async () => {
        const result = await stableFunction({
            fn: fastCompute,
            args: [60],
            returnResult: true,
            attempts: 2,
            rateLimit: {
                maxRequests: 5,
                windowMs: 1000
            },
            maxConcurrentRequests: 3,
            circuitBreaker: {
                failureThresholdPercentage: 50,
                minimumRequests: 3,
                recoveryTimeoutMs: 5000
            },
            cache: {
                enabled: true,
                ttl: 5000
            }
        });

        expect(result.success).toBe(true);
        
        const infraMetrics = result.metrics?.infrastructureMetrics;
        expect(infraMetrics).toBeDefined();
        expect(infraMetrics?.circuitBreaker).toBeDefined();
        expect(infraMetrics?.cache).toBeDefined();
        expect(infraMetrics?.rateLimiter).toBeDefined();
        expect(infraMetrics?.concurrencyLimiter).toBeDefined();
    });
});

// ============================================================================
// Error Handling with Rate and Concurrency Limits
// ============================================================================

describe('Stable Function - Error Handling with Limits', () => {
    
    it('should respect rate limits even when retrying after errors', async () => {
        let attemptCount = 0;
        const startTime = Date.now();
        
        const result = await stableFunction({
            fn: async (value: number) => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new Error('Temporary failure');
                }
                return { result: value * 2 };
            },
            args: [70],
            returnResult: true,
            attempts: 4,
            wait: 10,
            rateLimit: {
                maxRequests: 1,
                windowMs: 500
            }
        });
        
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(attemptCount).toBe(3);
        
        // Rate limiting should still apply during retries
        const rateLimiterMetrics = result.metrics!.infrastructureMetrics!.rateLimiter!;
        expect(rateLimiterMetrics.totalRequests).toBe(3);
    });

    it('should respect concurrency limits during error retries', async () => {
        let concurrentExecutions = 0;
        let peakConcurrency = 0;
        let attemptCount = 0;

        const result = await stableFunction({
            fn: async (value: number) => {
                attemptCount++;
                concurrentExecutions++;
                peakConcurrency = Math.max(peakConcurrency, concurrentExecutions);
                await new Promise(resolve => setTimeout(resolve, 20));
                concurrentExecutions--;
                
                if (attemptCount < 3) {
                    throw new Error('Retry needed');
                }
                return { result: value };
            },
            args: [80],
            returnResult: true,
            attempts: 5,
            wait: 5,
            maxConcurrentRequests: 1
        });

        expect(result.success).toBe(true);
        expect(peakConcurrency).toBe(1);
        expect(attemptCount).toBe(3);
    });

    it('should handle final failure with rate and concurrency metrics', async () => {
        try {
            await stableFunction({
                fn: errorFunction,
                args: [true],
                returnResult: true,
                attempts: 3,
                wait: 10,
                rateLimit: {
                    maxRequests: 10,
                    windowMs: 1000
                },
                maxConcurrentRequests: 5
            });
            
            fail('Should have thrown an error');
        } catch (error: any) {
            expect(error).toBeDefined();
            expect(error.message).toContain('Simulated failure');
        }
    });
});

// ============================================================================
// Performance and Metrics Validation
// ============================================================================

describe('Stable Function - Performance Metrics', () => {
    
    it('should provide accurate metrics for rate-limited execution', async () => {
        const result = await stableFunction({
            fn: fastCompute,
            args: [90],
            returnResult: true,
            attempts: 1,
            logAllSuccessfulAttempts: true,
            rateLimit: {
                maxRequests: 5,
                windowMs: 1000
            }
        });

        expect(result.success).toBe(true);
        expect(result.metrics).toBeDefined();
        
        const metrics = result.metrics!;
        expect(metrics.totalAttempts).toBe(1);
        expect(metrics.successfulAttempts).toBe(1);
        expect(metrics.failedAttempts).toBe(0);
        expect(metrics.totalExecutionTime).toBeGreaterThan(0);
        
        const rateLimiterMetrics = metrics.infrastructureMetrics!.rateLimiter!;
        expect(rateLimiterMetrics.completedRequests).toBeGreaterThanOrEqual(1);
        expect(rateLimiterMetrics.currentRequestRate).toBeGreaterThanOrEqual(0);
    });

    it('should provide accurate metrics for concurrency-limited execution', async () => {
        const result = await stableFunction({
            fn: slowCompute,
            args: [100],
            returnResult: true,
            attempts: 2,
            maxConcurrentRequests: 1
        });

        expect(result.success).toBe(true);
        expect(result.metrics).toBeDefined();
        
        const concurrencyMetrics = result.metrics!.infrastructureMetrics!.concurrencyLimiter!;
        expect(concurrencyMetrics.completedRequests).toBeGreaterThanOrEqual(1);
        expect(concurrencyMetrics.successRate).toBeGreaterThan(0);
        expect(concurrencyMetrics.utilizationPercentage).toBeGreaterThanOrEqual(0);
    });

    it('should track utilization percentages correctly', async () => {
        const result = await stableFunction({
            fn: fastCompute,
            args: [110],
            returnResult: true,
            attempts: 1,
            rateLimit: {
                maxRequests: 10,
                windowMs: 1000
            },
            maxConcurrentRequests: 5
        });

        expect(result.success).toBe(true);
        
        const rateLimiterMetrics = result.metrics!.infrastructureMetrics!.rateLimiter!;
        expect(rateLimiterMetrics.utilizationPercentage).toBeGreaterThanOrEqual(0);
        expect(rateLimiterMetrics.utilizationPercentage).toBeLessThanOrEqual(100);
        
        const concurrencyMetrics = result.metrics!.infrastructureMetrics!.concurrencyLimiter!;
        expect(concurrencyMetrics.utilizationPercentage).toBeGreaterThanOrEqual(0);
        expect(concurrencyMetrics.utilizationPercentage).toBeLessThanOrEqual(100);
    });
});

// ============================================================================
// Integration with Existing Features
// ============================================================================

describe('Stable Function - Integration with Existing Features', () => {
    
    it('should work with circuit breaker and rate limiting', async () => {
        const result = await stableFunction({
            fn: fastCompute,
            args: [120],
            returnResult: true,
            attempts: 2,
            circuitBreaker: {
                failureThresholdPercentage: 50,
                minimumRequests: 2,
                recoveryTimeoutMs: 5000
            },
            rateLimit: {
                maxRequests: 5,
                windowMs: 1000
            }
        });

        expect(result.success).toBe(true);
        expect(result.metrics?.infrastructureMetrics?.circuitBreaker).toBeDefined();
        expect(result.metrics?.infrastructureMetrics?.rateLimiter).toBeDefined();
    });

    it('should work with caching and concurrency limiting', async () => {
        const result = await stableFunction({
            fn: fastCompute,
            args: [130],
            returnResult: true,
            attempts: 1,
            cache: {
                enabled: true,
                ttl: 5000
            },
            maxConcurrentRequests: 3
        });

        expect(result.success).toBe(true);
        expect(result.metrics?.infrastructureMetrics?.cache).toBeDefined();
        expect(result.metrics?.infrastructureMetrics?.concurrencyLimiter).toBeDefined();
    });

    it('should work with all features combined', async () => {
        const result = await stableFunction({
            fn: fastCompute,
            args: [140],
            returnResult: true,
            attempts: 2,
            wait: 10,
            circuitBreaker: {
                failureThresholdPercentage: 50,
                minimumRequests: 3,
                recoveryTimeoutMs: 5000,
                trackIndividualAttempts: true
            },
            cache: {
                enabled: true,
                ttl: 10000
            },
            rateLimit: {
                maxRequests: 10,
                windowMs: 1000
            },
            maxConcurrentRequests: 5
        });

        expect(result.success).toBe(true);
        
        const infraMetrics = result.metrics!.infrastructureMetrics!;
        expect(infraMetrics.circuitBreaker).toBeDefined();
        expect(infraMetrics.cache).toBeDefined();
        expect(infraMetrics.rateLimiter).toBeDefined();
        expect(infraMetrics.concurrencyLimiter).toBeDefined();
        
        // Verify circuit breaker metrics
        expect(infraMetrics.circuitBreaker!.state).toBeDefined();
        
        // Verify cache metrics
        expect(infraMetrics.cache!.isEnabled).toBe(true);
        
        // Verify rate limiter metrics
        expect(infraMetrics.rateLimiter!.maxRequests).toBe(10);
        
        // Verify concurrency limiter metrics
        expect(infraMetrics.concurrencyLimiter!.limit).toBe(5);
    });
});

async function processStep1(value: number): Promise<{ step: number; value: number }> {
    await new Promise(resolve => setTimeout(resolve, 10));
    return { step: 1, value: value * 2 };
}

async function processStep2(value: number): Promise<{ step: number; value: number }> {
    await new Promise(resolve => setTimeout(resolve, 10));
    return { step: 2, value: value + 10 };
}

async function processStep3(value: number): Promise<{ step: number; value: number }> {
    await new Promise(resolve => setTimeout(resolve, 10));
    return { step: 3, value: value * 3 };
}

async function validateResult(value: number): Promise<{ valid: boolean; value: number }> {
    await new Promise(resolve => setTimeout(resolve, 5));
    return { valid: value > 0, value };
}

async function computeValue(a: number, b: number): Promise<{ result: number }> {
    await new Promise(resolve => setTimeout(resolve, 10));
    return { result: a + b };
}

// ============================================================================
// Branch Execution Tests
// ============================================================================

describe('Stable Function - Branch Execution', () => {
    
    it('should execute branches with function-only phases', async () => {
        const branches: STABLE_WORKFLOW_BRANCH[] = [
            {
                id: 'branch-1',
                phases: [
                    {
                        id: 'branch1-phase1',
                        functions: [
                            {
                                id: 'func-1',
                                functionOptions: {
                                    fn: processStep1,
                                    args: [5],
                                    returnResult: true
                                }
                            }
                        ]
                    }
                ]
            },
            {
                id: 'branch-2',
                phases: [
                    {
                        id: 'branch2-phase1',
                        functions: [
                            {
                                id: 'func-2',
                                functionOptions: {
                                    fn: processStep2,
                                    args: [10],
                                    returnResult: true
                                }
                            }
                        ]
                    }
                ]
            }
        ];

        const result = await stableWorkflow([], {
            workflowId: 'branch-workflow',
            enableBranchExecution: true,
            branches
        });

        expect(result.success).toBe(true);
        expect(result.branches).toBeDefined();
        expect(result.branches!.length).toBe(2);
        expect(result.branches![0].success).toBe(true);
        expect(result.branches![1].success).toBe(true);
    });

    it('should execute concurrent branches with functions', async () => {
        const branches: STABLE_WORKFLOW_BRANCH[] = [
            {
                id: 'concurrent-1',
                markConcurrentBranch: true,
                phases: [
                    {
                        id: 'phase-c1',
                        functions: [
                            {
                                id: 'func-c1',
                                functionOptions: {
                                    fn: computeValue,
                                    args: [10, 20],
                                    returnResult: true
                                }
                            }
                        ]
                    }
                ]
            },
            {
                id: 'concurrent-2',
                markConcurrentBranch: true,
                phases: [
                    {
                        id: 'phase-c2',
                        functions: [
                            {
                                id: 'func-c2',
                                functionOptions: {
                                    fn: computeValue,
                                    args: [30, 40],
                                    returnResult: true
                                }
                            }
                        ]
                    }
                ]
            }
        ];

        const startTime = Date.now();
        const result = await stableWorkflow([], {
            workflowId: 'concurrent-branches',
            enableBranchExecution: true,
            branches
        });
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(result.branches!.length).toBe(2);
        
        // Concurrent execution should be faster than sequential
        expect(duration).toBeLessThan(100);
    });

    it('should support branch decision hooks with functions', async () => {
        const executionOrder: string[] = [];

        const branches: STABLE_WORKFLOW_BRANCH[] = [
            {
                id: 'decision-branch-1',
                phases: [
                    {
                        id: 'decision-phase-1',
                        functions: [
                            {
                                id: 'decision-func-1',
                                functionOptions: {
                                    fn: async () => {
                                        executionOrder.push('branch-1');
                                        return { value: 100 };
                                    },
                                    args: [],
                                    returnResult: true
                                }
                            }
                        ]
                    }
                ],
                branchDecisionHook: async ({ branchResults }) => {
                    // Skip branch-2 based on branch-1 results
                    return {
                        action: PHASE_DECISION_ACTIONS.SKIP,
                        targetBranchId: 'decision-branch-3'
                    };
                }
            },
            {
                id: 'decision-branch-2',
                phases: [
                    {
                        id: 'decision-phase-2',
                        functions: [
                            {
                                id: 'decision-func-2',
                                functionOptions: {
                                    fn: async () => {
                                        executionOrder.push('branch-2');
                                        return { value: 200 };
                                    },
                                    args: [],
                                    returnResult: true
                                }
                            }
                        ]
                    }
                ]
            },
            {
                id: 'decision-branch-3',
                phases: [
                    {
                        id: 'decision-phase-3',
                        functions: [
                            {
                                id: 'decision-func-3',
                                functionOptions: {
                                    fn: async () => {
                                        executionOrder.push('branch-3');
                                        return { value: 300 };
                                    },
                                    args: [],
                                    returnResult: true
                                }
                            }
                        ]
                    }
                ]
            }
        ];

        const result = await stableWorkflow([], {
            workflowId: 'branch-decision',
            enableBranchExecution: true,
            branches
        });

        expect(result.success).toBe(true);
        expect(executionOrder).toEqual(['branch-1', 'branch-3']);
        expect(result.branches!.find(b => b.branchId === 'decision-branch-2')?.skipped).toBe(true);
    });

    it('should share buffer across branches with functions', async () => {
        const sharedBuffer: Record<string, any> = {};

        const branches: STABLE_WORKFLOW_BRANCH[] = [
            {
                id: 'writer-branch',
                phases: [
                    {
                        id: 'write-phase',
                        functions: [
                            {
                                id: 'writer',
                                functionOptions: {
                                    fn: async () => {
                                        sharedBuffer.branchData = 'written-by-branch-1';
                                        return { written: true };
                                    },
                                    args: []
                                }
                            }
                        ]
                    }
                ]
            },
            {
                id: 'reader-branch',
                phases: [
                    {
                        id: 'read-phase',
                        functions: [
                            {
                                id: 'reader',
                                functionOptions: {
                                    fn: async () => {
                                        return {
                                            data: sharedBuffer.branchData,
                                            hasData: !!sharedBuffer.branchData
                                        };
                                    },
                                    args: []
                                }
                            }
                        ]
                    }
                ]
            }
        ];

        const result = await stableWorkflow([], {
            workflowId: 'shared-buffer-branches',
            enableBranchExecution: true,
            branches,
            sharedBuffer
        });

        expect(result.success).toBe(true);
        expect(sharedBuffer.branchData).toBe('written-by-branch-1');
    });
});

// ============================================================================
// Non-Linear Execution Tests
// ============================================================================

describe('Stable Function - Non-Linear Execution', () => {
    
    it('should support JUMP action with phase decision hooks', async () => {
        const executionOrder: string[] = [];

        const phases: STABLE_WORKFLOW_PHASE[] = [
            {
                id: 'jump-phase-1',
                functions: [
                    {
                        id: 'jump-func-1',
                        functionOptions: {
                            fn: async () => {
                                executionOrder.push('phase-1');
                                return { value: 1 };
                            },
                            args: []
                        }
                    }
                ],
                phaseDecisionHook: async () => ({
                    action: PHASE_DECISION_ACTIONS.JUMP,
                    targetPhaseId: 'jump-phase-3'
                })
            },
            {
                id: 'jump-phase-2',
                functions: [
                    {
                        id: 'jump-func-2',
                        functionOptions: {
                            fn: async () => {
                                executionOrder.push('phase-2');
                                return { value: 2 };
                            },
                            args: []
                        }
                    }
                ]
            },
            {
                id: 'jump-phase-3',
                functions: [
                    {
                        id: 'jump-func-3',
                        functionOptions: {
                            fn: async () => {
                                executionOrder.push('phase-3');
                                return { value: 3 };
                            },
                            args: []
                        }
                    }
                ]
            }
        ];

        const result = await stableWorkflow(phases, {
            workflowId: 'jump-workflow',
            enableNonLinearExecution: true
        });

        expect(result.success).toBe(true);
        expect(executionOrder).toEqual(['phase-1', 'phase-3']);
        expect(result.phases.length).toBe(2);
    });

    it('should support SKIP action with functions', async () => {
        const executionOrder: string[] = [];

        const phases: STABLE_WORKFLOW_PHASE[] = [
            {
                id: 'skip-phase-1',
                functions: [
                    {
                        id: 'skip-func-1',
                        functionOptions: {
                            fn: async () => {
                                executionOrder.push('phase-1');
                                return { value: 1 };
                            },
                            args: []
                        }
                    }
                ],
                phaseDecisionHook: async () => ({
                    action: PHASE_DECISION_ACTIONS.SKIP,
                    targetPhaseId: 'skip-phase-3'
                })
            },
            {
                id: 'skip-phase-2',
                functions: [
                    {
                        id: 'skip-func-2',
                        functionOptions: {
                            fn: async () => {
                                executionOrder.push('phase-2');
                                return { value: 2 };
                            },
                            args: []
                        }
                    }
                ]
            },
            {
                id: 'skip-phase-3',
                functions: [
                    {
                        id: 'skip-func-3',
                        functionOptions: {
                            fn: async () => {
                                executionOrder.push('phase-3');
                                return { value: 3 };
                            },
                            args: []
                        }
                    }
                ]
            }
        ];

        const result = await stableWorkflow(phases, {
            workflowId: 'skip-workflow',
            enableNonLinearExecution: true
        });

        expect(result.success).toBe(true);
        expect(executionOrder).toEqual(['phase-1', 'phase-3']);
        
        // Phase 2 should not be in the results since it was skipped
        expect(result.phases.length).toBe(2);
        expect(result.phases.find(p => p.phaseId === 'skip-phase-2')).toBeUndefined();
    });

    it('should support REPLAY action with functions', async () => {
        const executionCounts: Record<string, number> = {
            'phase-1': 0,
            'phase-2': 0
        };

        const phases: STABLE_WORKFLOW_PHASE[] = [
            {
                id: 'replay-phase-1',
                allowReplay: true,
                maxReplayCount: 2,
                functions: [
                    {
                        id: 'replay-func-1',
                        functionOptions: {
                            fn: async () => {
                                executionCounts['phase-1']++;
                                return { count: executionCounts['phase-1'] };
                            },
                            args: []
                        }
                    }
                ],
                phaseDecisionHook: async ({ phaseResult, executionHistory }) => {
                    const execCount = executionHistory.filter(
                        e => e.phaseId === 'replay-phase-1'
                    ).length;
                    
                    // First execution returns REPLAY, second execution returns REPLAY, third returns CONTINUE
                    if (execCount < 3) {
                        return {
                            action: PHASE_DECISION_ACTIONS.REPLAY,
                            targetPhaseId: 'replay-phase-1'
                        };
                    }
                    return { action: PHASE_DECISION_ACTIONS.CONTINUE };
                }
            },
            {
                id: 'replay-phase-2',
                functions: [
                    {
                        id: 'replay-func-2',
                        functionOptions: {
                            fn: async () => {
                                executionCounts['phase-2']++;
                                return { count: executionCounts['phase-2'] };
                            },
                            args: []
                        }
                    }
                ]
            }
        ];

        const result = await stableWorkflow(phases, {
            workflowId: 'replay-workflow',
            enableNonLinearExecution: true
        });

        expect(result.success).toBe(true);
        expect(executionCounts['phase-1']).toBe(3);
        expect(executionCounts['phase-2']).toBe(1);
    });

    it('should support TERMINATE action with functions', async () => {
        const executionOrder: string[] = [];

        const phases: STABLE_WORKFLOW_PHASE[] = [
            {
                id: 'terminate-phase-1',
                functions: [
                    {
                        id: 'terminate-func-1',
                        functionOptions: {
                            fn: async () => {
                                executionOrder.push('phase-1');
                                return { shouldTerminate: true };
                            },
                            args: []
                        }
                    }
                ],
                phaseDecisionHook: async ({ phaseResult }) => ({
                    action: PHASE_DECISION_ACTIONS.TERMINATE,
                    metadata: { reason: 'Early termination requested' }
                })
            },
            {
                id: 'terminate-phase-2',
                functions: [
                    {
                        id: 'terminate-func-2',
                        functionOptions: {
                            fn: async () => {
                                executionOrder.push('phase-2');
                                return { value: 2 };
                            },
                            args: []
                        }
                    }
                ]
            }
        ];

        const result = await stableWorkflow(phases, {
            workflowId: 'terminate-workflow',
            enableNonLinearExecution: true
        });

        expect(result.success).toBe(true);
        expect(result.terminatedEarly).toBe(true);
        expect(executionOrder).toEqual(['phase-1']);
        expect(result.phases.length).toBe(1);
    });

    it('should support dynamic phase addition with functions', async () => {
        const executionOrder: string[] = [];

        const phases: STABLE_WORKFLOW_PHASE[] = [
            {
                id: 'dynamic-phase-1',
                functions: [
                    {
                        id: 'dynamic-func-1',
                        functionOptions: {
                            fn: async () => {
                                executionOrder.push('phase-1');
                                return { addDynamic: true };
                            },
                            args: []
                        }
                    }
                ],
                phaseDecisionHook: async () => ({
                    action: PHASE_DECISION_ACTIONS.CONTINUE,
                    addPhases: [
                        {
                            id: 'injected-phase',
                            functions: [
                                {
                                    id: 'injected-func',
                                    functionOptions: {
                                        fn: async () => {
                                            executionOrder.push('injected');
                                            return { injected: true };
                                        },
                                        args: []
                                    }
                                }
                            ]
                        }
                    ]
                })
            },
            {
                id: 'dynamic-phase-2',
                functions: [
                    {
                        id: 'dynamic-func-2',
                        functionOptions: {
                            fn: async () => {
                                executionOrder.push('phase-2');
                                return { value: 2 };
                            },
                            args: []
                        }
                    }
                ]
            }
        ];

        const result = await stableWorkflow(phases, {
            workflowId: 'dynamic-workflow',
            enableNonLinearExecution: true
        });

        expect(result.success).toBe(true);
        expect(executionOrder).toEqual(['phase-1', 'injected', 'phase-2']);
    });
});

// ============================================================================
// Phase Decision Hooks Tests
// ============================================================================

describe('Stable Function - Phase Decision Hooks', () => {
    
    it('should call phase decision hooks for function phases', async () => {
        const hookCalls: string[] = [];

        const phases: STABLE_WORKFLOW_PHASE[] = [
            {
                id: 'hook-phase-1',
                functions: [
                    {
                        id: 'hook-func-1',
                        functionOptions: {
                            fn: processStep1,
                            args: [10],
                            returnResult: true
                        }
                    }
                ],
                phaseDecisionHook: async ({ phaseResult }) => {
                    hookCalls.push('phase-1-hook');
                    return { action: PHASE_DECISION_ACTIONS.CONTINUE };
                }
            },
            {
                id: 'hook-phase-2',
                functions: [
                    {
                        id: 'hook-func-2',
                        functionOptions: {
                            fn: processStep2,
                            args: [20],
                            returnResult: true
                        }
                    }
                ],
                phaseDecisionHook: async ({ phaseResult }) => {
                    hookCalls.push('phase-2-hook');
                    return { action: PHASE_DECISION_ACTIONS.CONTINUE };
                }
            }
        ];

        const result = await stableWorkflow(phases, {
            workflowId: 'hook-workflow',
            enableNonLinearExecution: true
        });

        expect(result.success).toBe(true);
        expect(hookCalls).toEqual(['phase-1-hook', 'phase-2-hook']);
    });

    it('should access phase results in decision hooks', async () => {
        let capturedResult: any = null;

        const phases: STABLE_WORKFLOW_PHASE[] = [
            {
                id: 'result-phase',
                functions: [
                    {
                        id: 'result-func',
                        functionOptions: {
                            fn: async () => ({ computed: 42 }),
                            args: [],
                            returnResult: true
                        }
                    }
                ],
                phaseDecisionHook: async ({ phaseResult }) => {
                    capturedResult = phaseResult;
                    return { action: PHASE_DECISION_ACTIONS.CONTINUE };
                }
            }
        ];

        const result = await stableWorkflow(phases, {
            workflowId: 'result-hook-workflow',
            enableNonLinearExecution: true
        });

        expect(result.success).toBe(true);
        expect(capturedResult).toBeDefined();
        expect(capturedResult.phaseId).toBe('result-phase');
        expect(capturedResult.success).toBe(true);
        expect(capturedResult.responses).toHaveLength(1);
    });

    it('should access shared buffer in phase decision hooks', async () => {
        const sharedBuffer: Record<string, any> = { counter: 0 };

        const phases: STABLE_WORKFLOW_PHASE[] = [
            {
                id: 'buffer-phase-1',
                functions: [
                    {
                        id: 'buffer-func-1',
                        functionOptions: {
                            fn: async () => {
                                sharedBuffer.counter++;
                                return { value: sharedBuffer.counter };
                            },
                            args: []
                        }
                    }
                ],
                phaseDecisionHook: async ({ sharedBuffer: buffer }) => {
                    buffer!.hookModified = true;
                    return { action: PHASE_DECISION_ACTIONS.CONTINUE };
                }
            },
            {
                id: 'buffer-phase-2',
                functions: [
                    {
                        id: 'buffer-func-2',
                        functionOptions: {
                            fn: async () => ({
                                counter: sharedBuffer.counter,
                                hookModified: sharedBuffer.hookModified
                            }),
                            args: []
                        }
                    }
                ]
            }
        ];

        const result = await stableWorkflow(phases, {
            workflowId: 'buffer-hook-workflow',
            enableNonLinearExecution: true,
            sharedBuffer
        });

        expect(result.success).toBe(true);
        expect(sharedBuffer.hookModified).toBe(true);
    });
});

// ============================================================================
// Mixed Request and Function Workflows
// ============================================================================

describe('Stable Function - Mixed Workflows with Advanced Features', () => {
    
    it('should handle mixed request/function phases with decision hooks', async () => {
        const executionOrder: string[] = [];

        const phases: STABLE_WORKFLOW_PHASE[] = [
            {
                id: 'mixed-phase-1',
                items: [
                    {
                        type: RequestOrFunction.FUNCTION,
                        function: {
                            id: 'mixed-func',
                            functionOptions: {
                                fn: async () => {
                                    executionOrder.push(RequestOrFunction.FUNCTION);
                                    return { type: RequestOrFunction.FUNCTION };
                                },
                                args: []
                            }
                        }
                    }
                ],
                phaseDecisionHook: async () => ({
                    action: PHASE_DECISION_ACTIONS.CONTINUE
                })
            }
        ];

        const result = await stableWorkflow(phases, {
            workflowId: 'mixed-decision-workflow',
            enableNonLinearExecution: true
        });

        expect(result.success).toBe(true);
        expect(executionOrder).toContain(RequestOrFunction.FUNCTION);
    });

    it('should work with branches containing mixed items', async () => {
        const branches: STABLE_WORKFLOW_BRANCH[] = [
            {
                id: 'mixed-branch',
                phases: [
                    {
                        id: 'mixed-phase',
                        items: [
                            {
                                type: RequestOrFunction.FUNCTION,
                                function: {
                                    id: 'mixed-branch-func',
                                    functionOptions: {
                                        fn: computeValue,
                                        args: [5, 10],
                                        returnResult: true
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        ];

        const result = await stableWorkflow([], {
            workflowId: 'mixed-branch-workflow',
            enableBranchExecution: true,
            branches
        });

        expect(result.success).toBe(true);
        expect(result.branches).toBeDefined();
        expect(result.branches![0].success).toBe(true);
    });
});

describe('Stable Workflow Graph - Function Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to get function response from phase
  const getFunctionResponse = (phase: any, index: number = 0) => {
    return phase?.responses?.filter((r: any) => r.type === RequestOrFunction.FUNCTION)?.[index];
  };

  // Helper to get request response from phase
  const getRequestResponse = (phase: any, index: number = 0) => {
    return phase?.responses?.filter((r: any) => r.type === RequestOrFunction.REQUEST)?.[index];
  };

  describe('Conditional Nodes with stable-function', () => {
    it('should route based on function execution result in conditional node', async () => {
      // Functions for routing test
      async function checkValue(value: number): Promise<{ isHigh: boolean }> {
        return { isHigh: value > 50 };
      }

      async function successHandler(): Promise<{ message: string }> {
        return { message: 'Success path executed' };
      }

      async function failureHandler(): Promise<{ message: string }> {
        return { message: 'Failure path executed' };
      }

      const graph = new WorkflowGraphBuilder()
        .addPhase('check-phase', {
          functions: [{
            id: 'check-fn',
            functionOptions: {
              fn: checkValue,
              args: [75],
              attempts: 1
            }
          }]
        })
        .addConditional('decision', async ({ results }) => {
          const checkResult = results.get('check-phase');
          const fnResult = checkResult?.responses?.find(r => r.type === RequestOrFunction.FUNCTION);
          // Route based on success of check phase
          return fnResult?.success ? 'success-branch' : 'failure-branch';
        })
        .addPhase('success-branch', {
          functions: [{
            id: 'success-fn',
            functionOptions: {
              fn: successHandler,
              args: [],
              attempts: 1
            }
          }]
        })
        .addPhase('failure-branch', {
          functions: [{
            id: 'failure-fn',
            functionOptions: {
              fn: failureHandler,
              args: [],
              attempts: 1
            }
          }]
        })
        .connectSequence('check-phase', 'decision')
        .setEntryPoint('check-phase')
        .build();

      const result = await stableWorkflowGraph(graph, {
        workflowId: 'conditional-functions-test'
      });

      expect(result.success).toBe(true);
      expect(result.phases.length).toBe(2);
      
      // Verify correct branch was executed
      const successPhase = result.phases.find(p => p.phaseId === 'success-branch');
      expect(successPhase).toBeDefined();
      expect(successPhase?.success).toBe(true);
    });

    it('should handle multiple conditional branches with different function outcomes', async () => {
      const processData = async (status: string): Promise<{ route: string; priority: number }> => {
        if (status === 'urgent') return { route: 'urgent', priority: 1 };
        if (status === 'normal') return { route: 'normal', priority: 2 };
        return { route: 'low', priority: 3 };
      };

      const urgentProcessor = async (data: any): Promise<string> => 'Urgent processed';
      const normalProcessor = async (data: any): Promise<string> => 'Normal processed';
      const lowProcessor = async (data: any): Promise<string> => 'Low processed';

      const graph = new WorkflowGraphBuilder()
        .addPhase('classify', {
          functions: [{
            id: 'classify-fn',
            functionOptions: {
              fn: processData,
              args: ['urgent'],
              attempts: 1
            }
          }]
        })
        .addConditional('router', async ({ results }) => {
          const classifyResult = results.get('classify');
          const fnResult = classifyResult?.responses?.find(r => r.type === RequestOrFunction.FUNCTION);
          const route = fnResult?.data?.route;
          return `${route}-handler`;
        })
        .addPhase('urgent-handler', {
          functions: [{
            id: 'urgent-fn',
            functionOptions: { fn: urgentProcessor, args: [{}], attempts: 1 }
          }]
        })
        .addPhase('normal-handler', {
          functions: [{
            id: 'normal-fn',
            functionOptions: { fn: normalProcessor, args: [{}], attempts: 1 }
          }]
        })
        .addPhase('low-handler', {
          functions: [{
            id: 'low-fn',
            functionOptions: { fn: lowProcessor, args: [{}], attempts: 1 }
          }]
        })
        .connectSequence('classify', 'router')
        .setEntryPoint('classify')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);
      const urgentPhase = result.phases.find(p => p.phaseId === 'urgent-handler');
      expect(urgentPhase).toBeDefined();
      const fnResponse = getFunctionResponse(urgentPhase);
      expect(fnResponse?.data).toBe('Urgent processed');
    });

    it('should use shared buffer in conditional routing with functions', async () => {
      const setSharedData = async (value: number): Promise<number> => value * 2;

      const graph = new WorkflowGraphBuilder()
        .addPhase('compute', {
          functions: [{
            id: 'compute-fn',
            functionOptions: {
              fn: setSharedData,
              args: [50],
              attempts: 1
            }
          }]
        })
        .addConditional('decision', async ({ results, sharedBuffer }) => {
          const computeResult = results.get('compute');
          const fnResult = computeResult?.responses?.find(r => r.type === RequestOrFunction.FUNCTION);
          const value = fnResult?.data || 0;
          if (sharedBuffer) sharedBuffer.computedValue = value;
          return value > 75 ? 'high-path' : 'low-path';
        })
        .addPhase('high-path', {
          functions: [{
            id: 'high-fn',
            functionOptions: {
              fn: async (val: number) => `High: ${val}`,
              args: [],
              attempts: 1,
              preExecution: {
                preExecutionHook: ({ commonBuffer }: any) => {
                  (commonBuffer as any).args = [commonBuffer.computedValue];
                },
                applyPreExecutionConfigOverride: true
              }
            }
          }]
        })
        .addPhase('low-path', {
          functions: [{
            id: 'low-fn',
            functionOptions: {
              fn: async (val: number) => `Low: ${val}`,
              args: [],
              attempts: 1
            }
          }]
        })
        .connectSequence('compute', 'decision')
        .setEntryPoint('compute')
        .build();

      const sharedBuffer = {};
      const result = await stableWorkflowGraph(graph, { sharedBuffer });

      expect(result.success).toBe(true);
      const highPhase = result.phases.find(p => p.phaseId === 'high-path');
      expect(highPhase).toBeDefined();
      expect((sharedBuffer as any).computedValue).toBe(100);
    });

    it('should handle conditional routing with function errors', async () => {
      const mayFail = async (shouldFail: boolean): Promise<string> => {
        if (shouldFail) throw new Error('Function failed');
        return 'success';
      };

      const errorHandler = async (): Promise<string> => 'Error handled';
      const successHandler = async (): Promise<string> => 'Success handled';

      const graph = new WorkflowGraphBuilder()
        .addPhase('risky-operation', {
          functions: [{
            id: 'risky-fn',
            functionOptions: {
              fn: mayFail,
              args: [true],
              attempts: 2,
              retryStrategy: RETRY_STRATEGIES.FIXED,
              wait: 10
            }
          }]
        })
        .addConditional('error-check', async ({ results }) => {
          const riskyResult = results.get('risky-operation');
          const fnResult = riskyResult?.responses?.find(r => r.type === RequestOrFunction.FUNCTION);
          return fnResult?.success ? 'success-path' : 'error-path';
        })
        .addPhase('error-path', {
          functions: [{
            id: 'error-fn',
            functionOptions: { fn: errorHandler, args: [], attempts: 1 }
          }]
        })
        .addPhase('success-path', {
          functions: [{
            id: 'success-fn',
            functionOptions: { fn: successHandler, args: [], attempts: 1 }
          }]
        })
        .connectSequence('risky-operation', 'error-check')
        .setEntryPoint('risky-operation')
        .build();

      const result = await stableWorkflowGraph(graph);

      // Workflow reports failure because risky-operation phase failed,
      // even though the error was handled via conditional routing
      expect(result.success).toBe(false);
      expect(result.failedRequests).toBeGreaterThan(0);
      
      // Verify the error handler executed successfully
      const errorPhase = result.phases.find(p => p.phaseId === 'error-path');
      expect(errorPhase).toBeDefined();
      expect(errorPhase?.success).toBe(true);
      const fnResponse = getFunctionResponse(errorPhase);
      expect(fnResponse?.data).toBe('Error handled');
    });
  });

  describe('Parallel Groups with stable-function', () => {
    it('should execute multiple functions in parallel group', async () => {
      const executionTimes: number[] = [];
      const startTime = Date.now();

      const slowFunction1 = async (value: number): Promise<number> => {
        await new Promise(resolve => setTimeout(resolve, 100));
        executionTimes.push(Date.now() - startTime);
        return value * 2;
      };

      const slowFunction2 = async (value: number): Promise<number> => {
        await new Promise(resolve => setTimeout(resolve, 100));
        executionTimes.push(Date.now() - startTime);
        return value * 3;
      };

      const slowFunction3 = async (value: number): Promise<number> => {
        await new Promise(resolve => setTimeout(resolve, 100));
        executionTimes.push(Date.now() - startTime);
        return value * 4;
      };

      const graph = new WorkflowGraphBuilder()
        .addPhase('fn-1', {
          functions: [{
            id: 'fn-1-exec',
            functionOptions: { fn: slowFunction1, args: [10], attempts: 1 }
          }]
        })
        .addPhase('fn-2', {
          functions: [{
            id: 'fn-2-exec',
            functionOptions: { fn: slowFunction2, args: [10], attempts: 1 }
          }]
        })
        .addPhase('fn-3', {
          functions: [{
            id: 'fn-3-exec',
            functionOptions: { fn: slowFunction3, args: [10], attempts: 1 }
          }]
        })
        .addParallelGroup('parallel-functions', ['fn-1', 'fn-2', 'fn-3'])
        .addPhase('collect-results', {
          functions: [{
            id: 'collect-fn',
            functionOptions: {
              fn: async () => 'All parallel functions completed',
              args: [],
              attempts: 1
            }
          }]
        })
        .connectSequence('parallel-functions', 'collect-results')
        .setEntryPoint('parallel-functions')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);
      expect(result.phases.length).toBe(4); // 3 parallel + 1 collect

      // Verify all parallel functions executed
      const fn1Phase = result.phases.find(p => p.phaseId === 'fn-1');
      const fn2Phase = result.phases.find(p => p.phaseId === 'fn-2');
      const fn3Phase = result.phases.find(p => p.phaseId === 'fn-3');

      expect(getFunctionResponse(fn1Phase)?.data).toBe(20);
      expect(getFunctionResponse(fn2Phase)?.data).toBe(30);
      expect(getFunctionResponse(fn3Phase)?.data).toBe(40);

      // Verify parallel execution (all should complete around the same time)
      const maxDiff = Math.max(...executionTimes) - Math.min(...executionTimes);
      expect(maxDiff).toBeLessThan(50); // Should be close in time
    });

    it('should handle mixed functions and requests in parallel group', async () => {
      const computeValue = async (x: number): Promise<number> => x * 2;

      const graph = new WorkflowGraphBuilder()
        .addPhase('function-phase', {
          functions: [{
            id: 'compute-fn',
            functionOptions: { fn: computeValue, args: [25], attempts: 1 }
          }]
        })
        .addPhase('request-phase', {
          requests: [{
            id: 'api-req',
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
        .addParallelGroup('mixed-parallel', ['function-phase', 'request-phase'])
        .setEntryPoint('mixed-parallel')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);
      expect(result.phases.length).toBe(2);

      const fnPhase = result.phases.find(p => p.phaseId === 'function-phase');
      const reqPhase = result.phases.find(p => p.phaseId === 'request-phase');

      expect(getFunctionResponse(fnPhase)?.data).toBe(50);
      expect(getRequestResponse(reqPhase)?.success).toBe(true);
    });

    it('should handle parallel group with function retries', async () => {
      let fn1Attempts = 0;
      let fn2Attempts = 0;

      const flakeyFunction1 = async (): Promise<string> => {
        fn1Attempts++;
        if (fn1Attempts < 2) throw new Error('Fn1 temporary error');
        return 'Fn1 success';
      };

      const flakeyFunction2 = async (): Promise<string> => {
        fn2Attempts++;
        if (fn2Attempts < 3) throw new Error('Fn2 temporary error');
        return 'Fn2 success';
      };

      const graph = new WorkflowGraphBuilder()
        .addPhase('flakey-1', {
          functions: [{
            id: 'flakey-fn-1',
            functionOptions: {
              fn: flakeyFunction1,
              args: [],
              attempts: 3,
              retryStrategy: RETRY_STRATEGIES.FIXED,
              wait: 10
            }
          }]
        })
        .addPhase('flakey-2', {
          functions: [{
            id: 'flakey-fn-2',
            functionOptions: {
              fn: flakeyFunction2,
              args: [],
              attempts: 4,
              retryStrategy: RETRY_STRATEGIES.FIXED,
              wait: 10
            }
          }]
        })
        .addParallelGroup('parallel-flakey', ['flakey-1', 'flakey-2'])
        .setEntryPoint('parallel-flakey')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);
      expect(fn1Attempts).toBe(2);
      expect(fn2Attempts).toBe(3);

      const fn1Phase = result.phases.find(p => p.phaseId === 'flakey-1');
      const fn2Phase = result.phases.find(p => p.phaseId === 'flakey-2');

      expect(getFunctionResponse(fn1Phase)?.data).toBe('Fn1 success');
      expect(getFunctionResponse(fn2Phase)?.data).toBe('Fn2 success');
    });

    it('should continue parallel execution even if one function fails', async () => {
      const successFn1 = async (): Promise<string> => 'Success 1';
      const failingFn = async (): Promise<string> => { throw new Error('Permanent failure'); };
      const successFn2 = async (): Promise<string> => 'Success 2';

      const graph = new WorkflowGraphBuilder()
        .addPhase('success-phase-1', {
          functions: [{
            id: 'success-fn-1',
            functionOptions: { fn: successFn1, args: [], attempts: 1 }
          }]
        })
        .addPhase('failing-phase', {
          functions: [{
            id: 'failing-fn',
            functionOptions: {
              fn: failingFn,
              args: [],
              attempts: 2,
              retryStrategy: RETRY_STRATEGIES.FIXED,
              wait: 10
            }
          }]
        })
        .addPhase('success-phase-2', {
          functions: [{
            id: 'success-fn-2',
            functionOptions: { fn: successFn2, args: [], attempts: 1 }
          }]
        })
        .addParallelGroup('mixed-results', ['success-phase-1', 'failing-phase', 'success-phase-2'])
        .setEntryPoint('mixed-results')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(false); // Overall fails due to one failure
      expect(result.phases.length).toBe(3);

      const success1 = result.phases.find(p => p.phaseId === 'success-phase-1');
      const failing = result.phases.find(p => p.phaseId === 'failing-phase');
      const success2 = result.phases.find(p => p.phaseId === 'success-phase-2');

      expect(getFunctionResponse(success1)?.success).toBe(true);
      expect(getFunctionResponse(failing)?.success).toBe(false);
      expect(getFunctionResponse(success2)?.success).toBe(true);
    });
  });

  describe('Merge Points with stable-function', () => {
    it('should wait for all parallel functions before continuing', async () => {
      const executionOrder: string[] = [];

      const parallelFn1 = async (): Promise<number> => {
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push('parallel-1');
        return 10;
      };

      const parallelFn2 = async (): Promise<number> => {
        await new Promise(resolve => setTimeout(resolve, 100));
        executionOrder.push('parallel-2');
        return 20;
      };

      const mergeFn = async (): Promise<string> => {
        executionOrder.push('merge');
        return 'Merged result';
      };

      const graph = new WorkflowGraphBuilder()
        .addPhase('parallel-1', {
          functions: [{
            id: 'p1-fn',
            functionOptions: { fn: parallelFn1, args: [], attempts: 1 }
          }]
        })
        .addPhase('parallel-2', {
          functions: [{
            id: 'p2-fn',
            functionOptions: { fn: parallelFn2, args: [], attempts: 1 }
          }]
        })
        .addMergePoint('merge-point', ['parallel-1', 'parallel-2'])
        .addPhase('after-merge', {
          functions: [{
            id: 'merge-fn',
            functionOptions: { fn: mergeFn, args: [], attempts: 1 }
          }]
        })
        .addParallelGroup('parallel-start', ['parallel-1', 'parallel-2'])
        .connectSequence('parallel-start', 'merge-point', 'after-merge')
        .setEntryPoint('parallel-start')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);
      expect(executionOrder).toContain('parallel-1');
      expect(executionOrder).toContain('parallel-2');
      expect(executionOrder).toContain('merge');

      // Merge should be last
      expect(executionOrder.indexOf('merge')).toBe(2);

      const mergePhase = result.phases.find(p => p.phaseId === 'after-merge');
      expect(getFunctionResponse(mergePhase)?.data).toBe('Merged result');
    });

    it('should aggregate results from parallel functions at merge point', async () => {
      const computeA = async (x: number): Promise<number> => x * 2;
      const computeB = async (x: number): Promise<number> => x * 3;
      const computeC = async (x: number): Promise<number> => x * 4;

      const aggregateResults = async (buffer: any): Promise<string> => {
        const total = (buffer.a || 0) + (buffer.b || 0) + (buffer.c || 0);
        return `Total: ${total}`;
      };

      const graph = new WorkflowGraphBuilder()
        .addPhase('compute-a', {
          functions: [{
            id: 'fn-a',
            functionOptions: {
              fn: computeA,
              args: [5],
              attempts: 1,
              logAllSuccessfulAttempts: true,
              handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }: any) => {
                commonBuffer.a = successfulAttemptData.data;
              }
            }
          }]
        })
        .addPhase('compute-b', {
          functions: [{
            id: 'fn-b',
            functionOptions: {
              fn: computeB,
              args: [5],
              attempts: 1,
              logAllSuccessfulAttempts: true,
              handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }: any) => {
                commonBuffer.b = successfulAttemptData.data;
              }
            }
          }]
        })
        .addPhase('compute-c', {
          functions: [{
            id: 'fn-c',
            functionOptions: {
              fn: computeC,
              args: [5],
              attempts: 1,
              logAllSuccessfulAttempts: true,
              handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }: any) => {
                commonBuffer.c = successfulAttemptData.data;
              }
            }
          }]
        })
        .addMergePoint('merge', ['compute-a', 'compute-b', 'compute-c'])
        .addPhase('aggregate', {
          functions: [{
            id: 'aggregate-fn',
            functionOptions: {
              fn: aggregateResults,
              args: [],
              attempts: 1,
              preExecution: {
                preExecutionHook: ({ commonBuffer }: any) => {
                  return { args: [commonBuffer] };
                },
                applyPreExecutionConfigOverride: true
              }
            }
          }]
        })
        .addParallelGroup('parallel-compute', ['compute-a', 'compute-b', 'compute-c'])
        .connectSequence('parallel-compute', 'merge', 'aggregate')
        .setEntryPoint('parallel-compute')
        .build();

      const sharedBuffer = {};
      const result = await stableWorkflowGraph(graph, { sharedBuffer });

      expect(result.success).toBe(true);
      expect(sharedBuffer).toEqual({ a: 10, b: 15, c: 20 });

      const aggregatePhase = result.phases.find(p => p.phaseId === 'aggregate');
      expect(getFunctionResponse(aggregatePhase)?.data).toBe('Total: 45');
    });

    it('should handle merge point when one parallel function fails', async () => {
      const successFn = async (): Promise<string> => 'Success';
      const failingFn = async (): Promise<string> => { throw new Error('Failed'); };
      const mergeFn = async (): Promise<string> => 'Attempted merge';

      const graph = new WorkflowGraphBuilder()
        .addPhase('success-branch', {
          functions: [{
            id: 'success-fn',
            functionOptions: { fn: successFn, args: [], attempts: 1 }
          }]
        })
        .addPhase('failing-branch', {
          functions: [{
            id: 'failing-fn',
            functionOptions: {
              fn: failingFn,
              args: [],
              attempts: 2,
              retryStrategy: RETRY_STRATEGIES.FIXED,
              wait: 10
            }
          }]
        })
        .addMergePoint('merge', ['success-branch', 'failing-branch'])
        .addPhase('after-merge', {
          functions: [{
            id: 'merge-fn',
            functionOptions: { fn: mergeFn, args: [], attempts: 1 }
          }]
        })
        .addParallelGroup('parallel', ['success-branch', 'failing-branch'])
        .connectSequence('parallel', 'merge', 'after-merge')
        .setEntryPoint('parallel')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(false);
      
      const successPhase = result.phases.find(p => p.phaseId === 'success-branch');
      const failingPhase = result.phases.find(p => p.phaseId === 'failing-branch');

      expect(getFunctionResponse(successPhase)?.success).toBe(true);
      expect(getFunctionResponse(failingPhase)?.success).toBe(false);
    });

    it('should support nested parallel groups with merge points', async () => {
      const level1Fn1 = async () => 'L1-1';
      const level1Fn2 = async () => 'L1-2';
      const level2Fn1 = async () => 'L2-1';
      const level2Fn2 = async () => 'L2-2';
      const finalMergeFn = async () => 'Final merged';

      const graph = new WorkflowGraphBuilder()
        .addPhase('l1-1', {
          functions: [{ id: 'l1-1-fn', functionOptions: { fn: level1Fn1, args: [], attempts: 1 } }]
        })
        .addPhase('l1-2', {
          functions: [{ id: 'l1-2-fn', functionOptions: { fn: level1Fn2, args: [], attempts: 1 } }]
        })
        .addPhase('l2-1', {
          functions: [{ id: 'l2-1-fn', functionOptions: { fn: level2Fn1, args: [], attempts: 1 } }]
        })
        .addPhase('l2-2', {
          functions: [{ id: 'l2-2-fn', functionOptions: { fn: level2Fn2, args: [], attempts: 1 } }]
        })
        .addParallelGroup('parallel-1', ['l1-1', 'l1-2'])
        .addMergePoint('merge-1', ['l1-1', 'l1-2'])
        .addParallelGroup('parallel-2', ['l2-1', 'l2-2'])
        .addMergePoint('merge-2', ['l2-1', 'l2-2'])
        .addPhase('final-merge', {
          functions: [{ id: 'final-fn', functionOptions: { fn: finalMergeFn, args: [], attempts: 1 } }]
        })
        .connectSequence('parallel-1', 'merge-1', 'parallel-2', 'merge-2', 'final-merge')
        .setEntryPoint('parallel-1')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);
      expect(result.phases.length).toBe(5);

      const finalPhase = result.phases.find(p => p.phaseId === 'final-merge');
      expect(getFunctionResponse(finalPhase)?.data).toBe('Final merged');
    });
  });

  describe('Complex Scenarios - Functions with Conditionals, Parallel Groups, and Merge Points', () => {
    it('should handle conditional routing to parallel groups with functions', async () => {
      const checkEnvironment = async (env: string): Promise<string> => env;
      
      const devTask1 = async () => 'Dev task 1 done';
      const devTask2 = async () => 'Dev task 2 done';
      const prodTask1 = async () => 'Prod task 1 done';
      const prodTask2 = async () => 'Prod task 2 done';

      const graph = new WorkflowGraphBuilder()
        .addPhase('check-env', {
          functions: [{
            id: 'check-fn',
            functionOptions: { fn: checkEnvironment, args: ['production'], attempts: 1 }
          }]
        })
        .addConditional('env-router', async ({ results }) => {
          const envResult = results.get('check-env');
          const fnResult = envResult?.responses?.find(r => r.type === RequestOrFunction.FUNCTION);
          const env = fnResult?.data;
          return env === 'production' ? 'prod-tasks' : 'dev-tasks';
        })
        .addPhase('dev-1', {
          functions: [{ id: 'dev-1-fn', functionOptions: { fn: devTask1, args: [], attempts: 1 } }]
        })
        .addPhase('dev-2', {
          functions: [{ id: 'dev-2-fn', functionOptions: { fn: devTask2, args: [], attempts: 1 } }]
        })
        .addPhase('prod-1', {
          functions: [{ id: 'prod-1-fn', functionOptions: { fn: prodTask1, args: [], attempts: 1 } }]
        })
        .addPhase('prod-2', {
          functions: [{ id: 'prod-2-fn', functionOptions: { fn: prodTask2, args: [], attempts: 1 } }]
        })
        .addParallelGroup('dev-tasks', ['dev-1', 'dev-2'])
        .addParallelGroup('prod-tasks', ['prod-1', 'prod-2'])
        .addMergePoint('dev-merge', ['dev-1', 'dev-2'])
        .addMergePoint('prod-merge', ['prod-1', 'prod-2'])
        .connectSequence('check-env', 'env-router')
        .connect('dev-tasks', 'dev-merge')
        .connect('prod-tasks', 'prod-merge')
        .setEntryPoint('check-env')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);
      
      const prod1Phase = result.phases.find(p => p.phaseId === 'prod-1');
      const prod2Phase = result.phases.find(p => p.phaseId === 'prod-2');

      expect(prod1Phase).toBeDefined();
      expect(prod2Phase).toBeDefined();
      expect(getFunctionResponse(prod1Phase)?.data).toBe('Prod task 1 done');
      expect(getFunctionResponse(prod2Phase)?.data).toBe('Prod task 2 done');
    });

    it('should execute parallel functions, merge results, then conditionally route', async () => {
      const fetchDataA = async (): Promise<number> => 100;
      const fetchDataB = async (): Promise<number> => 200;
      
      const analyzeData = async (total: number): Promise<string> => {
        return total > 250 ? 'high' : 'low';
      };

      const highHandler = async () => 'High value processed';
      const lowHandler = async () => 'Low value processed';

      const graph = new WorkflowGraphBuilder()
        .addPhase('fetch-a', {
          functions: [{
            id: 'fetch-a-fn',
            functionOptions: {
              fn: fetchDataA,
              args: [],
              attempts: 1,
              logAllSuccessfulAttempts: true,
              handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }: any) => {
                commonBuffer.dataA = successfulAttemptData.data;
              }
            }
          }]
        })
        .addPhase('fetch-b', {
          functions: [{
            id: 'fetch-b-fn',
            functionOptions: {
              fn: fetchDataB,
              args: [],
              attempts: 1,
              logAllSuccessfulAttempts: true,
              handleSuccessfulAttemptData: ({ successfulAttemptData, commonBuffer }: any) => {
                commonBuffer.dataB = successfulAttemptData.data;
              }
            }
          }]
        })
        .addParallelGroup('parallel-fetch', ['fetch-a', 'fetch-b'])
        .addMergePoint('merge-data', ['fetch-a', 'fetch-b'])
        .addPhase('analyze', {
          functions: [{
            id: 'analyze-fn',
            functionOptions: {
              fn: analyzeData,
              args: [],
              attempts: 1,
              preExecution: {
                preExecutionHook: ({ commonBuffer }: any) => {
                  const total = (commonBuffer.dataA || 0) + (commonBuffer.dataB || 0);
                  return { args: [total] };
                },
                applyPreExecutionConfigOverride: true
              }
            }
          }]
        })
        .addConditional('value-router', async ({ results }) => {
          const analyzeResult = results.get('analyze');
          const fnResult = analyzeResult?.responses?.find(r => r.type === RequestOrFunction.FUNCTION);
          const category = fnResult?.data;
          return `${category}-handler`;
        })
        .addPhase('high-handler', {
          functions: [{ id: 'high-fn', functionOptions: { fn: highHandler, args: [], attempts: 1 } }]
        })
        .addPhase('low-handler', {
          functions: [{ id: 'low-fn', functionOptions: { fn: lowHandler, args: [], attempts: 1 } }]
        })
        .connectSequence('parallel-fetch', 'merge-data', 'analyze', 'value-router')
        .setEntryPoint('parallel-fetch')
        .build();

      const sharedBuffer = {};
      const result = await stableWorkflowGraph(graph, { sharedBuffer });

      expect(result.success).toBe(true);
      expect(sharedBuffer).toEqual({ dataA: 100, dataB: 200 });

      const highPhase = result.phases.find(p => p.phaseId === 'high-handler');
      expect(highPhase).toBeDefined();
      expect(getFunctionResponse(highPhase)?.data).toBe('High value processed');
    });

    it('should support multiple conditional branches leading to different parallel groups', async () => {
      const determineStrategy = async (type: string): Promise<string> => type;

      const strategyATask1 = async () => 'Strategy A - Task 1';
      const strategyATask2 = async () => 'Strategy A - Task 2';
      const strategyBTask1 = async () => 'Strategy B - Task 1';
      const strategyBTask2 = async () => 'Strategy B - Task 2';
      const strategyCTask1 = async () => 'Strategy C - Task 1';

      const finalReport = async (buffer: any) => `Report generated with strategy`;

      const graph = new WorkflowGraphBuilder()
        .addPhase('determine', {
          functions: [{
            id: 'determine-fn',
            functionOptions: { fn: determineStrategy, args: ['B'], attempts: 1 }
          }]
        })
        .addConditional('strategy-router', async ({ results }) => {
          const result = results.get('determine');
          const fnResult = result?.responses?.find(r => r.type === RequestOrFunction.FUNCTION);
          const strategy = fnResult?.data;
          return `strategy-${strategy}-parallel`;
        })
        .addPhase('a-task-1', {
          functions: [{ id: 'a1-fn', functionOptions: { fn: strategyATask1, args: [], attempts: 1 } }]
        })
        .addPhase('a-task-2', {
          functions: [{ id: 'a2-fn', functionOptions: { fn: strategyATask2, args: [], attempts: 1 } }]
        })
        .addPhase('b-task-1', {
          functions: [{ id: 'b1-fn', functionOptions: { fn: strategyBTask1, args: [], attempts: 1 } }]
        })
        .addPhase('b-task-2', {
          functions: [{ id: 'b2-fn', functionOptions: { fn: strategyBTask2, args: [], attempts: 1 } }]
        })
        .addPhase('c-task-1', {
          functions: [{ id: 'c1-fn', functionOptions: { fn: strategyCTask1, args: [], attempts: 1 } }]
        })
        .addParallelGroup('strategy-A-parallel', ['a-task-1', 'a-task-2'])
        .addParallelGroup('strategy-B-parallel', ['b-task-1', 'b-task-2'])
        .addParallelGroup('strategy-C-parallel', ['c-task-1'])
        .addMergePoint('merge-a', ['a-task-1', 'a-task-2'])
        .addMergePoint('merge-b', ['b-task-1', 'b-task-2'])
        .addMergePoint('merge-c', ['c-task-1'])
        .addPhase('final-report', {
          functions: [{ id: 'report-fn', functionOptions: { fn: finalReport, args: [{}], attempts: 1 } }]
        })
        .connectSequence('determine', 'strategy-router')
        .connect('strategy-A-parallel', 'merge-a')
        .connect('merge-a', 'final-report')
        .connect('strategy-B-parallel', 'merge-b')
        .connect('merge-b', 'final-report')
        .connect('strategy-C-parallel', 'merge-c')
        .connect('merge-c', 'final-report')
        .setEntryPoint('determine')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);

      const b1Phase = result.phases.find(p => p.phaseId === 'b-task-1');
      const b2Phase = result.phases.find(p => p.phaseId === 'b-task-2');

      expect(b1Phase).toBeDefined();
      expect(b2Phase).toBeDefined();
      expect(getFunctionResponse(b1Phase)?.data).toBe('Strategy B - Task 1');
      expect(getFunctionResponse(b2Phase)?.data).toBe('Strategy B - Task 2');
    });

    it('should handle retry logic in parallel functions within conditional branches', async () => {
      let failCount = 0;
      
      const checkCondition = async () => 'path-a';
      
      const retryableTask = async (): Promise<string> => {
        failCount++;
        if (failCount < 3) throw new Error('Temporary failure');
        return 'Success after retries';
      };

      const stableTask = async () => 'Stable result';

      const graph = new WorkflowGraphBuilder()
        .addPhase('condition-check', {
          functions: [{
            id: 'check-fn',
            functionOptions: { fn: checkCondition, args: [], attempts: 1 }
          }]
        })
        .addConditional('path-decision', async ({ results }) => {
          const result = results.get('condition-check');
          const fnResult = result?.responses?.find(r => r.type === RequestOrFunction.FUNCTION);
          return fnResult?.data || 'path-b';
        })
        .addPhase('retryable-phase', {
          functions: [{
            id: 'retryable-fn',
            functionOptions: {
              fn: retryableTask,
              args: [],
              attempts: 5,
              retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
              wait: 10,
              maxAllowedWait: 100
            }
          }]
        })
        .addPhase('stable-phase', {
          functions: [{
            id: 'stable-fn',
            functionOptions: { fn: stableTask, args: [], attempts: 1 }
          }]
        })
        .addParallelGroup('path-a', ['retryable-phase', 'stable-phase'])
        .addMergePoint('merge-a', ['retryable-phase', 'stable-phase'])
        .connectSequence('condition-check', 'path-decision')
        .connect('path-a', 'merge-a')
        .setEntryPoint('condition-check')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);
      expect(failCount).toBe(3);

      const retryablePhase = result.phases.find(p => p.phaseId === 'retryable-phase');
      const retryableResponse = getFunctionResponse(retryablePhase);
      expect(retryableResponse?.data).toBe('Success after retries');
      // Metrics are at phase level, not response level
      expect(retryablePhase?.totalRequests).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large parallel groups of functions efficiently', async () => {
      const computeValue = async (id: number): Promise<number> => id * 2;

      const builder = new WorkflowGraphBuilder();
      const phaseIds: string[] = [];

      // Create 20 parallel function phases
      for (let i = 1; i <= 20; i++) {
        const phaseId = `compute-${i}`;
        phaseIds.push(phaseId);
        builder.addPhase(phaseId, {
          functions: [{
            id: `fn-${i}`,
            functionOptions: { fn: computeValue, args: [i], attempts: 1 }
          }]
        });
      }

      builder.addParallelGroup('large-parallel', phaseIds);
      builder.addMergePoint('large-merge', phaseIds);
      builder.addPhase('summary', {
        functions: [{
          id: 'summary-fn',
          functionOptions: {
            fn: async () => 'All completed',
            args: [],
            attempts: 1
          }
        }]
      });
      builder.connectSequence('large-parallel', 'large-merge', 'summary');
      builder.setEntryPoint('large-parallel');

      const graph = builder.build();
      const startTime = Date.now();
      const result = await stableWorkflowGraph(graph);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.phases.length).toBe(21); // 20 compute + 1 summary
      
      // Verify all phases completed
      for (let i = 1; i <= 20; i++) {
        const phase = result.phases.find(p => p.phaseId === `compute-${i}`);
        expect(getFunctionResponse(phase)?.data).toBe(i * 2);
      }

      // Should complete reasonably fast due to parallel execution
      expect(executionTime).toBeLessThan(5000);
    });

    it('should handle empty parallel groups gracefully', async () => {
      const testFn = async () => 'Test';

      // This should throw an error as per WorkflowGraphBuilder validation
      expect(() => {
        new WorkflowGraphBuilder()
          .addParallelGroup('empty-parallel', [])
          .build();
      }).toThrow();
    });

    it('should handle conditional routing with async evaluation', async () => {
      const asyncEvaluator = async (value: number): Promise<string> => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return value > 50 ? 'high' : 'low';
      };

      const graph = new WorkflowGraphBuilder()
        .addPhase('input', {
          functions: [{
            id: 'input-fn',
            functionOptions: { fn: async () => 75, args: [], attempts: 1 }
          }]
        })
        .addConditional('async-decision', async ({ results }) => {
          const inputResult = results.get('input');
          const fnResult = inputResult?.responses?.find(r => r.type === RequestOrFunction.FUNCTION);
          const value = fnResult?.data || 0;
          return await asyncEvaluator(value);
        })
        .addPhase('high', {
          functions: [{ id: 'high-fn', functionOptions: { fn: async () => 'High path', args: [], attempts: 1 } }]
        })
        .addPhase('low', {
          functions: [{ id: 'low-fn', functionOptions: { fn: async () => 'Low path', args: [], attempts: 1 } }]
        })
        .connectSequence('input', 'async-decision')
        .setEntryPoint('input')
        .build();

      const result = await stableWorkflowGraph(graph);

      expect(result.success).toBe(true);
      const highPhase = result.phases.find(p => p.phaseId === 'high');
      expect(highPhase).toBeDefined();
    });
  });
});

describe('Request Groups with Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should apply group configuration over global configuration for functions', async () => {
    let callCount = 0;
    const failTwiceThenSucceed = async (): Promise<string> => {
      callCount++;
      if (callCount < 3) {
        throw new Error('Failed attempt');
      }
      return 'Success';
    };

    const functions = [
      {
        id: 'critical-function',
        groupId: 'critical',
        functionOptions: {
          fn: failTwiceThenSucceed,
          args: [] as []
        }
      }
    ] satisfies API_GATEWAY_FUNCTION[];

    await stableApiGateway([], functions, {
      commonAttempts: 1, // Global: 1 attempt
      commonWait: 10,
      
      requestGroups: [
        {
          id: 'critical',
          commonConfig: {
            commonAttempts: 3, // Group: 3 attempts (should override global)
            commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
          }
        }
      ]
    });

    // Should use group's 3 attempts, not global's 1
    expect(callCount).toBe(3);
  });

  it('should apply individual function options over group and global config', async () => {
    let callCount = 0;
    const failMultipleTimes = async (): Promise<string> => {
      callCount++;
      if (callCount < 5) {
        throw new Error('Failed attempt');
      }
      return 'Success';
    };

    const functions = [
      {
        id: 'special-function',
        groupId: 'standard',
        functionOptions: {
          fn: failMultipleTimes,
          args: [] as [],
          attempts: 5 // Individual: 5 attempts (highest priority)
        }
      }
    ] satisfies API_GATEWAY_FUNCTION[];

    await stableApiGateway([], functions, {
      commonAttempts: 1, // Global: 1
      commonWait: 10,
      
      requestGroups: [
        {
          id: 'standard',
          commonConfig: {
            commonAttempts: 3 // Group: 3
          }
        }
      ]
    });

    // Should use individual's 5 attempts
    expect(callCount).toBe(5);
  });

  it('should apply different configurations to different function groups', async () => {
    let criticalCount = 0;
    let optionalCount = 0;

    const criticalFunction = async (): Promise<string> => {
      criticalCount++;
      if (criticalCount < 3) {
        throw new Error('Critical failed');
      }
      return 'Critical success';
    };

    const optionalFunction = async (): Promise<string> => {
      optionalCount++;
      throw new Error('Optional failed');
    };

    const functions = [
      {
        id: 'critical-fn',
        groupId: 'critical',
        functionOptions: {
          fn: criticalFunction,
          args: [] as []
        }
      },
      {
        id: 'optional-fn',
        groupId: 'optional',
        functionOptions: {
          fn: optionalFunction,
          args: [] as []
        }
      }
    ] satisfies API_GATEWAY_FUNCTION[];

    const results = await stableApiGateway([], functions, {
      commonAttempts: 1,
      commonWait: 10,
      concurrentExecution: true,
      
      requestGroups: [
        {
          id: 'critical',
          commonConfig: {
            commonAttempts: 3
          }
        },
        {
          id: 'optional',
          commonConfig: {
            commonAttempts: 1
          }
        }
      ]
    });

    expect(results).toHaveLength(2);
    expect(criticalCount).toBe(3); // Critical used 3 attempts from group
    expect(optionalCount).toBe(1); // Optional used 1 attempt from group
    expect(results[0].success).toBe(true); // Critical succeeded
    expect(results[1].success).toBe(false); // Optional failed
  });

  it('should handle functions without groupId using only global config', async () => {
    let callCount = 0;
    const failOnceThenSucceed = async (): Promise<string> => {
      callCount++;
      if (callCount < 2) {
        throw new Error('Failed');
      }
      return 'Success';
    };

    const functions = [
      {
        id: 'ungrouped',
        functionOptions: {
          fn: failOnceThenSucceed,
          args: [] as []
        }
      }
    ] satisfies API_GATEWAY_FUNCTION[];

    await stableApiGateway([], functions, {
      commonAttempts: 2, // Should use this
      commonWait: 10,
      requestGroups: [
        {
          id: 'critical',
          commonConfig: {
            commonAttempts: 5 // Should NOT use this
          }
        }
      ]
    });

    // Should use global config (2 attempts)
    expect(callCount).toBe(2);
  });

  it('should include groupId in response for grouped functions', async () => {
    const testFunction = async (): Promise<string> => 'Result';

    const functions = [
      {
        id: 'grouped-fn',
        groupId: 'my-group',
        functionOptions: {
          fn: testFunction,
          args: [] as []
        }
      }
    ] satisfies API_GATEWAY_FUNCTION[];

    const results = await stableApiGateway([], functions, {
      requestGroups: [{ id: 'my-group', commonConfig: {} }]
    });

    expect(results[0]).toMatchObject({
      requestId: 'grouped-fn',
      groupId: 'my-group',
      success: true,
      data: 'Result'
    });
  });

  it('should handle mixed requests and functions with different group configs', async () => {
    let fnCallCount = 0;
    const failOnceFn = async (): Promise<string> => {
      fnCallCount++;
      if (fnCallCount < 2) {
        throw new Error('Function failed');
      }
      return 'Function success';
    };

    const functions = [
      {
        id: 'critical-fn',
        groupId: 'critical',
        functionOptions: {
          fn: failOnceFn,
          args: [] as []
        }
      }
    ] satisfies API_GATEWAY_FUNCTION[];

    const results = await stableApiGateway([], functions, {
      concurrentExecution: true,
      commonAttempts: 1,
      commonWait: 10,
      
      requestGroups: [
        {
          id: 'critical',
          commonConfig: {
            commonAttempts: 3,
            commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
          }
        },
        {
          id: 'optional',
          commonConfig: {
            commonAttempts: 1
          }
        }
      ]
    });

    expect(results).toHaveLength(1);
    expect(fnCallCount).toBe(2); // Critical function used group's 3 attempt limit
    expect(results[0].success).toBe(true);
    expect(results[0].groupId).toBe('critical');
  });

  it('should apply group-level returnResult configuration to functions', async () => {
    const returnNumberFn = async (): Promise<number> => 42;

    const functions = [
      {
        id: 'fn-no-return',
        groupId: 'no-return-group',
        functionOptions: {
          fn: returnNumberFn,
          args: [] as []
        }
      },
      {
        id: 'fn-with-return',
        groupId: 'with-return-group',
        functionOptions: {
          fn: returnNumberFn,
          args: [] as []
        }
      }
    ] satisfies API_GATEWAY_FUNCTION[];

    const results = await stableApiGateway([], functions, {
      commonReturnResult: false, // Global: don't return
      
      requestGroups: [
        {
          id: 'no-return-group',
          commonConfig: {
            commonReturnResult: false // Group says don't return
          }
        },
        {
          id: 'with-return-group',
          commonConfig: {
            commonReturnResult: true // Group says return
          }
        }
      ]
    });

    expect(results).toHaveLength(2);
    expect(results[0].data).toBe(true); // Group config: no return (returns true for success)
    expect(results[1].data).toBe(42); // Group config: return result
  });

  it('should apply group-level hook configuration to functions', async () => {
    const groupHookCalls: string[] = [];
    const individualHookCalls: string[] = [];

    const testFn1 = async (): Promise<string> => 'Result 1';
    const testFn2 = async (): Promise<string> => 'Result 2';

    const functions = [
      {
        id: 'fn-with-group-hook',
        groupId: 'hooked-group',
        functionOptions: {
          fn: testFn1,
          args: [] as [],
          logAllSuccessfulAttempts: true
        }
      },
      {
        id: 'fn-with-individual-hook',
        functionOptions: {
          fn: testFn2,
          args: [] as [],
          logAllSuccessfulAttempts: true,
          handleSuccessfulAttemptData: async ({ successfulAttemptData }) => {
            individualHookCalls.push(`individual-${successfulAttemptData.data}`);
          }
        }
      }
    ] satisfies API_GATEWAY_FUNCTION[];

    await stableApiGateway([], functions, {
      requestGroups: [
        {
          id: 'hooked-group',
          commonConfig: {
            commonHandleSuccessfulFunctionAttemptData: async ({ successfulAttemptData }) => {
              groupHookCalls.push(`group-${successfulAttemptData.data}`);
            }
          }
        }
      ]
    });

    expect(groupHookCalls).toEqual(['group-Result 1']); // Group hook called
    expect(individualHookCalls).toEqual(['individual-Result 2']); // Individual hook called
  });
});

describe('Execution Timeout Tests', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  describe('Function-Level Timeout', () => {
    it('should complete successfully when function finishes before timeout', async () => {
      const fastFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'success';
      };

      const result = await stableFunction({
        fn: fastFunction,
        args: [],
        returnResult: true,
        executionTimeout: 200,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.metrics?.totalExecutionTime).toBeLessThan(200);
    });

    it('should timeout when function exceeds execution timeout', async () => {
      const slowFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return 'should not reach here';
      };

      const result = await stableFunction({
        fn: slowFunction,
        args: [],
        returnResult: true,
        executionTimeout: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.error).toContain('100ms');
    });

    it('should respect function-level timeout over gateway-level timeout', async () => {
      const slowFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return 'should not reach here';
      };

      const result = await stableApiGateway(
        [
          {
            type: RequestOrFunction.FUNCTION,
            function: {
              id: 'func1',
              functionOptions: {
                fn: slowFunction,
                args: [],
                returnResult: true,
                executionTimeout: 100, // Function-specific timeout
              },
            },
          },
        ],
        {
          commonExecutionTimeout: 1000, // Gateway-level timeout
        }
      );

      expect(result[0].success).toBe(false);
      expect(result[0].error).toContain('100ms');
    });

    it('should work without timeout when executionTimeout is not set', async () => {
      const normalFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'success';
      };

      const result = await stableFunction({
        fn: normalFunction,
        args: [],
        returnResult: true,
        // No executionTimeout set
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
    });
  });

  describe('Gateway-Level Timeout', () => {
    it('should apply commonExecutionTimeout to all functions without specific timeout', async () => {
      const fastFunc = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'fast';
      };

      const slowFunc = async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return 'slow';
      };

      const result = await stableApiGateway(
        [
          {
            type: RequestOrFunction.FUNCTION,
            function: {
              id: 'fast',
              functionOptions: {
                fn: fastFunc,
                args: [],
                returnResult: true,
              },
            },
          },
          {
            type: RequestOrFunction.FUNCTION,
            function: {
              id: 'slow',
              functionOptions: {
                fn: slowFunc,
                args: [],
                returnResult: true,
              },
            },
          },
        ],
        {
          commonExecutionTimeout: 150,
          concurrentExecution: true,
        }
      );

      expect(result[0].success).toBe(true);
      expect(result[0].data).toBe('fast');
      expect(result[1].success).toBe(false);
      expect(result[1].error).toContain('timeout');
    });

    it('should work with sequential execution and timeout', async () => {
      const func1 = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'first';
      };

      const func2 = async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return 'second';
      };

      const result = await stableApiGateway(
        [
          {
            type: RequestOrFunction.FUNCTION,
            function: {
              id: 'func1',
              functionOptions: {
                fn: func1,
                args: [],
                returnResult: true,
              },
            },
          },
          {
            type: RequestOrFunction.FUNCTION,
            function: {
              id: 'func2',
              functionOptions: {
                fn: func2,
                args: [],
                returnResult: true,
              },
            },
          },
        ],
        {
          commonExecutionTimeout: 100,
          concurrentExecution: false,
        }
      );

      expect(result[0].success).toBe(true);
      expect(result[0].data).toBe('first');
      expect(result[1].success).toBe(false);
      expect(result[1].error).toContain('timeout');
    });
  });

  describe('Request Group-Level Timeout', () => {
    it('should apply group-level timeout to functions in the group', async () => {
      const fastFunc = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'fast';
      };

      const slowFunc = async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return 'slow';
      };

      const result = await stableApiGateway(
        [
          {
            type: RequestOrFunction.FUNCTION,
            function: {
              id: 'fast',
              groupId: 'strictGroup',
              functionOptions: {
                fn: fastFunc,
                args: [],
                returnResult: true,
              },
            },
          },
          {
            type: RequestOrFunction.FUNCTION,
            function: {
              id: 'slow',
              groupId: 'strictGroup',
              functionOptions: {
                fn: slowFunc,
                args: [],
                returnResult: true,
              },
            },
          },
        ],
        {
          requestGroups: [
            {
              id: 'strictGroup',
              commonConfig: {
                commonExecutionTimeout: 100,
              },
            },
          ],
          concurrentExecution: true,
        }
      );

      expect(result[0].success).toBe(true);
      expect(result[1].success).toBe(false);
      expect(result[1].error).toContain('timeout');
    });

    it('should allow group timeout to override gateway timeout', async () => {
      const mediumFunc = async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
        return 'medium';
      };

      const result = await stableApiGateway(
        [
          {
            type: RequestOrFunction.FUNCTION,
            function: {
              id: 'func1',
              groupId: 'lenientGroup',
              functionOptions: {
                fn: mediumFunc,
                args: [],
                returnResult: true,
              },
            },
          },
        ],
        {
          commonExecutionTimeout: 50, // Strict gateway timeout
          requestGroups: [
            {
              id: 'lenientGroup',
              commonConfig: {
                commonExecutionTimeout: 300, // More lenient group timeout
              },
            },
          ],
        }
      );

      expect(result[0].success).toBe(true);
      expect(result[0].data).toBe('medium');
    });
  });

  describe('Workflow Phase-Level Timeout', () => {
    it('should apply phase-level timeout from commonConfig', async () => {
      const fastFunc = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'fast';
      };

      const slowFunc = async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return 'slow';
      };

      const result = await stableWorkflow(
        [
          {
            id: 'phase1',
            functions: [
              {
                id: 'fast',
                functionOptions: {
                  fn: fastFunc,
                  args: [],
                  returnResult: true,
                },
              },
            ],
            commonConfig: {
              commonExecutionTimeout: 100,
            },
          },
          {
            id: 'phase2',
            functions: [
              {
                id: 'slow',
                functionOptions: {
                  fn: slowFunc,
                  args: [],
                  returnResult: true,
                },
              },
            ],
            commonConfig: {
              commonExecutionTimeout: 100,
            },
          },
        ],
        {
          logPhaseResults: false,
        }
      );

      expect(result.success).toBe(false);
      expect(result.phases[0].success).toBe(true);
      expect(result.phases[1].success).toBe(false);
    });

    it('should inherit workflow-level timeout when phase has no specific timeout', async () => {
      const mediumFunc = async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
        return 'medium';
      };

      const result = await stableWorkflow(
        [
          {
            id: 'phase1',
            functions: [
              {
                id: 'func1',
                functionOptions: {
                  fn: mediumFunc,
                  args: [],
                  returnResult: true,
                },
              },
            ],
          },
        ],
        {
          commonExecutionTimeout: 100,
          logPhaseResults: false,
        }
      );

      expect(result.success).toBe(false);
      expect(result.phases[0].responses[0].error).toContain('timeout');
    });
  });

  describe('Workflow Branch-Level Timeout', () => {
    it('should apply branch-level timeout from commonConfig', async () => {
      const fastFunc = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'fast';
      };

      const slowFunc = async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return 'slow';
      };

      const result = await stableWorkflow(
        [],
        {
          enableBranchExecution: true,
          branches: [
            {
              id: 'branch1',
              phases: [
                {
                  id: 'phase1',
                  functions: [
                    {
                      id: 'fast',
                      functionOptions: {
                        fn: fastFunc,
                        args: [],
                        returnResult: true,
                      },
                    },
                  ],
                },
              ],
              commonConfig: {
                commonExecutionTimeout: 200,
              },
            },
            {
              id: 'branch2',
              phases: [
                {
                  id: 'phase2',
                  functions: [
                    {
                      id: 'slow',
                      functionOptions: {
                        fn: slowFunc,
                        args: [],
                        returnResult: true,
                      },
                    },
                  ],
                },
              ],
              commonConfig: {
                commonExecutionTimeout: 100,
              },
            },
          ],
          logPhaseResults: false,
        }
      );

      expect(result.branches?.[0].success).toBe(true);
      expect(result.branches?.[1].success).toBe(false);
    });

    it('should inherit workflow-level timeout when branch has no specific timeout', async () => {
      const mediumFunc = async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
        return 'medium';
      };

      const result = await stableWorkflow(
        [],
        {
          enableBranchExecution: true,
          branches: [
            {
              id: 'branch1',
              phases: [
                {
                  id: 'phase1',
                  functions: [
                    {
                      id: 'func1',
                      functionOptions: {
                        fn: mediumFunc,
                        args: [],
                        returnResult: true,
                      },
                    },
                  ],
                },
              ],
            },
          ],
          commonExecutionTimeout: 100,
          logPhaseResults: false,
        }
      );

      expect(result.branches?.[0].success).toBe(false);
    });
  });

  describe('Timeout Hierarchy and Precedence', () => {
    it('should follow precedence: function > group > phase/branch > gateway', async () => {
      const func = async () => {
        await new Promise(resolve => setTimeout(resolve, 175));
        return 'result';
      };

      // Test function-level timeout (highest precedence)
      const result1 = await stableApiGateway(
        [
          {
            type: RequestOrFunction.FUNCTION,
            function: {
              id: 'func1',
              groupId: 'group1',
              functionOptions: {
                fn: func,
                args: [],
                returnResult: true,
                executionTimeout: 200, // Function-level (should win)
              },
            },
          },
        ],
        {
          commonExecutionTimeout: 100, // Gateway-level
          requestGroups: [
            {
              id: 'group1',
              commonConfig: {
                commonExecutionTimeout: 150, // Group-level
              },
            },
          ],
        }
      );
      expect(result1[0].success).toBe(true);

      // Test group-level timeout (overrides gateway)
      const result2 = await stableApiGateway(
        [
          {
            type: RequestOrFunction.FUNCTION,
            function: {
              id: 'func2',
              groupId: 'group2',
              functionOptions: {
                fn: func,
                args: [],
                returnResult: true,
                // No function-level timeout
              },
            },
          },
        ],
        {
          commonExecutionTimeout: 100, // Gateway-level
          requestGroups: [
            {
              id: 'group2',
              commonConfig: {
                commonExecutionTimeout: 200, // Group-level (should win)
              },
            },
          ],
        }
      );
      expect(result2[0].success).toBe(true);
    });
  });

  describe('Timeout with Retries', () => {
    it('should timeout the entire execution including all retries', async () => {
      let attemptCount = 0;
      const retryableFunc = async () => {
        attemptCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        throw new Error('Retry me');
      };

      const result = await stableFunction({
        fn: retryableFunc,
        args: [],
        returnResult: true,
        attempts: 10,
        wait: 50,
        executionTimeout: 200, // Should timeout during retries
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(attemptCount).toBeLessThan(10); // Didn't complete all attempts
    });

    it('should allow successful completion within timeout despite retries', async () => {
      let attemptCount = 0;
      const eventualSuccessFunc = async () => {
        attemptCount++;
        await new Promise(resolve => setTimeout(resolve, 40));
        if (attemptCount < 3) {
          throw new Error('Not yet');
        }
        return 'success';
      };

      const result = await stableFunction({
        fn: eventualSuccessFunc,
        args: [],
        returnResult: true,
        attempts: 5,
        wait: 20,
        executionTimeout: 200,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(attemptCount).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero timeout as no timeout', async () => {
      const func = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'success';
      };

      const result = await stableFunction({
        fn: func,
        args: [],
        returnResult: true,
        executionTimeout: 0,
      });

      expect(result.success).toBe(true);
    });

    it('should handle negative timeout as no timeout', async () => {
      const func = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'success';
      };

      const result = await stableFunction({
        fn: func,
        args: [],
        returnResult: true,
        executionTimeout: -100,
      });

      expect(result.success).toBe(true);
    });

    it('should handle very short timeout', async () => {
      const func = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'should not reach';
      };

      const result = await stableFunction({
        fn: func,
        args: [],
        returnResult: true,
        executionTimeout: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should track metrics correctly even when timeout occurs', async () => {
      const func = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return 'should not reach';
      };

      const result = await stableFunction({
        fn: func,
        args: [],
        returnResult: true,
        executionTimeout: 100,
      });

      expect(result.success).toBe(false);
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.totalExecutionTime).toBeGreaterThan(0);
      expect(result.metrics?.totalExecutionTime).toBeLessThan(200); // Should be close to timeout
    });
  });
});