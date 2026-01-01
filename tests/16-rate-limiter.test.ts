import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosRequestConfig } from 'axios';
import { stableApiGateway, stableWorkflow, RateLimiter } from '../src/index.js';
import { API_GATEWAY_REQUEST, STABLE_WORKFLOW_PHASE } from '../src/types/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Rate Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('RateLimiter class', () => {
    it('should limit execution rate to specified requests per window', async () => {
      const limiter = new RateLimiter(3, 1000); // 3 requests per second
      const executionTimes: number[] = [];

      const task = async () => {
        executionTimes.push(Date.now());
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      const startTime = Date.now();
      const tasks = Array.from({ length: 6 }, () => limiter.execute(task));
      await Promise.all(tasks);
      const totalTime = Date.now() - startTime;

      // First 3 should execute immediately, next 3 after 1 second
      expect(totalTime).toBeGreaterThanOrEqual(1000);
      expect(totalTime).toBeLessThan(1500);

      // Check that first 3 executed quickly
      const firstThree = executionTimes.slice(0, 3);
      const timeDiff = Math.max(...firstThree) - Math.min(...firstThree);
      expect(timeDiff).toBeLessThan(50);

      // Check that there's a gap between first 3 and last 3
      const lastThree = executionTimes.slice(3);
      const gap = Math.min(...lastThree) - Math.max(...firstThree);
      expect(gap).toBeGreaterThanOrEqual(900);
    });

    it('should handle single request per window (strictest rate limit)', async () => {
      const limiter = new RateLimiter(1, 500); // 1 request per 500ms
      const executionTimes: number[] = [];

      const task = async () => {
        executionTimes.push(Date.now());
      };

      const startTime = Date.now();
      const tasks = [1, 2, 3].map(() => limiter.execute(task));
      await Promise.all(tasks);
      const totalTime = Date.now() - startTime;

      // Should take at least 1 second (3 requests * 500ms spacing)
      expect(totalTime).toBeGreaterThanOrEqual(1000);

      // Verify spacing between requests
      for (let i = 1; i < executionTimes.length; i++) {
        const gap = executionTimes[i] - executionTimes[i - 1];
        expect(gap).toBeGreaterThanOrEqual(450); // Allow small variance
      }
    });

    it('should work with high throughput rate limit', async () => {
      const limiter = new RateLimiter(100, 1000); // 100 requests per second
      let completed = 0;

      const task = async () => {
        completed++;
      };

      const tasks = Array.from({ length: 50 }, () => limiter.execute(task));
      await Promise.all(tasks);

      expect(completed).toBe(50);
    });

    it('should expose current state for monitoring', () => {
      const limiter = new RateLimiter(5, 1000);
      
      const initialState = limiter.getState();
      expect(initialState.availableTokens).toBe(5);
      expect(initialState.queueLength).toBe(0);
      expect(initialState.maxRequests).toBe(5);
      expect(initialState.windowMs).toBe(1000);
    });

    it('should handle errors in tasks without breaking rate limiting', async () => {
      const limiter = new RateLimiter(2, 500);
      const results: string[] = [];

      const createTask = (id: number, shouldFail: boolean) => async () => {
        if (shouldFail) {
          throw new Error(`Task ${id} failed`);
        }
        results.push(`success-${id}`);
      };

      const tasks = [
        limiter.execute(createTask(1, false)),
        limiter.execute(createTask(2, true)),
        limiter.execute(createTask(3, false)),
        limiter.execute(createTask(4, false))
      ];

      const settled = await Promise.allSettled(tasks);

      expect(settled[0].status).toBe('fulfilled');
      expect(settled[1].status).toBe('rejected');
      expect(settled[2].status).toBe('fulfilled');
      expect(settled[3].status).toBe('fulfilled');
      expect(results).toEqual(['success-1', 'success-3', 'success-4']);
    });

    it('should refill tokens over time', async () => {
      const limiter = new RateLimiter(2, 500);

      // Use 2 tokens
      await limiter.execute(async () => {});
      await limiter.execute(async () => {});

      let state = limiter.getState();
      expect(state.availableTokens).toBe(0);

      // Wait for refill
      await new Promise(resolve => setTimeout(resolve, 550));

      state = limiter.getState();
      expect(state.availableTokens).toBeGreaterThan(0);
    });
  });

  describe('API Gateway - rateLimit', () => {
    it('should apply rate limiting to concurrent requests', async () => {
      const executionTimes: number[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          executionTimes.push(Date.now());
          await new Promise(resolve => setTimeout(resolve, 10));

          return {
            status: 200,
            data: { path: config.url },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const requests = Array.from({ length: 6 }, (_, i) => ({
        id: `req-${i + 1}`,
        requestOptions: { reqData: { path: `/api/${i + 1}` }, resReq: true }
      })) satisfies API_GATEWAY_REQUEST[];

      const startTime = Date.now();
      const results = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        rateLimit: {
          maxRequests: 3,
          windowMs: 1000
        }
      });
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(6);
      expect(results.every(r => r.success)).toBe(true);

      // Should take at least 1 second (rate limited)
      expect(totalTime).toBeGreaterThanOrEqual(1000);

      // First 3 should start quickly
      const firstThree = executionTimes.slice(0, 3);
      const firstBatch = Math.max(...firstThree) - Math.min(...firstThree);
      expect(firstBatch).toBeLessThan(100);
    });

    it('should combine rate limiting with concurrency limiting', async () => {
      const executionLog: Array<{ time: number; event: string }> = [];
      let currentConcurrent = 0;
      let maxConcurrent = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
          executionLog.push({ time: Date.now(), event: `start-${config.url}` });

          await new Promise(resolve => setTimeout(resolve, 50));

          currentConcurrent--;
          executionLog.push({ time: Date.now(), event: `end-${config.url}` });

          return {
            status: 200,
            data: { path: config.url },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const requests = Array.from({ length: 8 }, (_, i) => ({
        id: `req-${i + 1}`,
        requestOptions: { reqData: { path: `/api/${i + 1}` }, resReq: true }
      })) satisfies API_GATEWAY_REQUEST[];

      const results = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        maxConcurrentRequests: 3,  // Max 3 concurrent
        rateLimit: {
          maxRequests: 4,           // Max 4 per second
          windowMs: 1000
        }
      });

      expect(results).toHaveLength(8);
      expect(results.every(r => r.success)).toBe(true);

      // Concurrent requests should never exceed 3
      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    it('should not apply rate limiting when concurrentExecution is false', async () => {
      const executionTimes: number[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          executionTimes.push(Date.now());
          await new Promise(resolve => setTimeout(resolve, 10));

          return {
            status: 200,
            data: { path: config.url },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const requests = Array.from({ length: 3 }, (_, i) => ({
        id: `req-${i + 1}`,
        requestOptions: { reqData: { path: `/api/${i + 1}` }, resReq: true }
      })) satisfies API_GATEWAY_REQUEST[];

      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: false,
        rateLimit: {
          maxRequests: 1,
          windowMs: 1000
        }
      });

      // Sequential execution should not be affected by rate limit
      for (let i = 1; i < executionTimes.length; i++) {
        const gap = executionTimes[i] - executionTimes[i - 1];
        // Gaps should be small (just processing time)
        expect(gap).toBeLessThan(100);
      }
    });
  });

  describe('Workflow-level rateLimit', () => {
    it('should apply workflow-level rate limit to all phases', async () => {
      const phaseExecutionTimes: Record<string, number[]> = { p1: [], p2: [] };

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          const phaseKey = path.includes('p1') ? 'p1' : 'p2';
          phaseExecutionTimes[phaseKey].push(Date.now());

          await new Promise(resolve => setTimeout(resolve, 10));

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
          concurrentExecution: true,
          requests: Array.from({ length: 4 }, (_, i) => ({
            id: `p1-r${i + 1}`,
            requestOptions: { reqData: { path: `/p1/${i + 1}` }, resReq: true }
          }))
        },
        {
          id: 'phase-2',
          concurrentExecution: true,
          requests: Array.from({ length: 4 }, (_, i) => ({
            id: `p2-r${i + 1}`,
            requestOptions: { reqData: { path: `/p2/${i + 1}` }, resReq: true }
          }))
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const startTime = Date.now();
      const result = await stableWorkflow(phases, {
        workflowId: 'wf-rate-limited',
        commonRequestData: { hostname: 'api.example.com' },
        rateLimit: {
          maxRequests: 2,
          windowMs: 500
        }
      });
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);

      // Each phase has 4 requests with limit of 2 per 500ms
      // Each phase: first 2 immediate, next 2 after 500ms = ~500ms per phase
      // Phase 1: ~500ms, Phase 2: ~500ms = ~1 second total
      expect(totalTime).toBeGreaterThanOrEqual(1000);
    });

    it('should allow phase-level override of workflow rate limit', async () => {
      const phaseExecutionTimes: Record<string, number[]> = { p1: [], p2: [] };

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          const phaseKey = path.includes('p1') ? 'p1' : 'p2';
          phaseExecutionTimes[phaseKey].push(Date.now());

          await new Promise(resolve => setTimeout(resolve, 10));

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
          id: 'phase-1-strict',
          concurrentExecution: true,
          rateLimit: { maxRequests: 1, windowMs: 500 },  // Override: 1 per 500ms
          requests: Array.from({ length: 3 }, (_, i) => ({
            id: `p1-r${i + 1}`,
            requestOptions: { reqData: { path: `/p1/${i + 1}` }, resReq: true }
          }))
        },
        {
          id: 'phase-2-relaxed',
          concurrentExecution: true,
          rateLimit: { maxRequests: 5, windowMs: 500 },  // Override: 5 per 500ms
          requests: Array.from({ length: 3 }, (_, i) => ({
            id: `p2-r${i + 1}`,
            requestOptions: { reqData: { path: `/p2/${i + 1}` }, resReq: true }
          }))
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const startTime = Date.now();
      const result = await stableWorkflow(phases, {
        workflowId: 'wf-phase-rate-override',
        commonRequestData: { hostname: 'api.example.com' },
        rateLimit: { maxRequests: 2, windowMs: 500 }  // Workflow default
      });
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);

      // Phase 1: 3 requests at 1 per 500ms = ~1 second
      const p1Times = phaseExecutionTimes.p1;
      for (let i = 1; i < p1Times.length; i++) {
        const gap = p1Times[i] - p1Times[i - 1];
        expect(gap).toBeGreaterThanOrEqual(450);
      }

      // Phase 2: 3 requests at 5 per 500ms = should be quick
      const p2Times = phaseExecutionTimes.p2;
      const p2Spread = Math.max(...p2Times) - Math.min(...p2Times);
      expect(p2Spread).toBeLessThan(200);
    });

    it('should use workflow rate limit when phase does not specify one', async () => {
      const executionTimes: number[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          executionTimes.push(Date.now());
          await new Promise(resolve => setTimeout(resolve, 10));

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
          concurrentExecution: true,
          // No rateLimit - should use workflow level
          requests: Array.from({ length: 4 }, (_, i) => ({
            id: `r${i + 1}`,
            requestOptions: { reqData: { path: `/api/${i + 1}` }, resReq: true }
          }))
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const startTime = Date.now();
      const result = await stableWorkflow(phases, {
        workflowId: 'wf-default-rate-limit',
        commonRequestData: { hostname: 'api.example.com' },
        rateLimit: {
          maxRequests: 2,
          windowMs: 500
        }
      });
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      // 4 requests at 2 per 500ms: first 2 immediate, next 2 after 500ms window
      expect(totalTime).toBeGreaterThanOrEqual(500);
    });
  });

  describe('Mixed execution mode with rate limiting', () => {
    it('should apply rate limiting within concurrent groups in mixed mode', async () => {
      const phaseExecutionTimes: Record<string, number[]> = { p2: [], p3: [] };

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          const phaseKey = path.includes('p2') ? 'p2' : path.includes('p3') ? 'p3' : 'p1';
          
          if (phaseKey !== 'p1') {
            phaseExecutionTimes[phaseKey].push(Date.now());
          }

          await new Promise(resolve => setTimeout(resolve, 10));

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
          markConcurrentPhase: true,
          rateLimit: { maxRequests: 2, windowMs: 500 },
          requests: Array.from({ length: 4 }, (_, i) => ({
            id: `p2-r${i + 1}`,
            requestOptions: { reqData: { path: `/p2/${i + 1}` }, resReq: true }
          }))
        },
        {
          id: 'phase-3',
          markConcurrentPhase: true,
          rateLimit: { maxRequests: 2, windowMs: 500 },
          requests: Array.from({ length: 4 }, (_, i) => ({
            id: `p3-r${i + 1}`,
            requestOptions: { reqData: { path: `/p3/${i + 1}` }, resReq: true }
          }))
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-mixed-rate-limit',
        commonRequestData: { hostname: 'api.example.com' },
        enableMixedExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(3);

      // Each concurrent phase should be rate limited independently
      // Phase 2: 4 requests at 2 per 500ms
      const p2Times = phaseExecutionTimes.p2;
      expect(p2Times).toHaveLength(4);

      // Phase 3: 4 requests at 2 per 500ms
      const p3Times = phaseExecutionTimes.p3;
      expect(p3Times).toHaveLength(4);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle rate limit with request failures', async () => {
      const executionTimes: number[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          executionTimes.push(Date.now());
          await new Promise(resolve => setTimeout(resolve, 10));

          const path = config.url || '';
          if (path.includes('/api/2') || path.includes('/api/4')) {
            throw {
              response: { status: 500, data: 'Error' },
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

      const requests = Array.from({ length: 6 }, (_, i) => ({
        id: `req-${i + 1}`,
        requestOptions: { 
          reqData: { path: `/api/${i + 1}` }, 
          resReq: false, 
          attempts: 3,
          finalErrorAnalyzer: () => true // Return false on error instead of throwing
        }
      })) satisfies API_GATEWAY_REQUEST[];

      const results = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        rateLimit: {
          maxRequests: 3,
          windowMs: 1000
        }
      });

      expect(results).toHaveLength(6);
      expect(results.filter(r => r.success)).toHaveLength(4);
      expect(results.filter(r => !r.success)).toHaveLength(2);

      // Rate limiting should still be applied despite failures
      // Requests 2 and 4 fail and are retried 3 times each
      // Total executions: 1 + 3 + 1 + 3 + 1 + 1 = 10
      expect(executionTimes).toHaveLength(10);
    });

    it('should handle very small time windows', async () => {
      const limiter = new RateLimiter(2, 100); // 2 requests per 100ms
      let completed = 0;

      const task = async () => {
        completed++;
      };

      const startTime = Date.now();
      const tasks = Array.from({ length: 6 }, () => limiter.execute(task));
      await Promise.all(tasks);
      const totalTime = Date.now() - startTime;

      expect(completed).toBe(6);
      // Should take at least 200ms (3 windows of 100ms)
      expect(totalTime).toBeGreaterThanOrEqual(200);
    });

    it('should handle rate limit with retries', async () => {
      let attemptCount = 0;
      const executionTimes: number[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          attemptCount++;
          executionTimes.push(Date.now());
          await new Promise(resolve => setTimeout(resolve, 10));

          const path = config.url || '';
          // Fail first attempt for first 2 requests
          if (attemptCount <= 2) {
            throw {
              response: { status: 500, data: 'Error' },
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

      const requests = Array.from({ length: 2 }, (_, i) => ({
        id: `req-${i + 1}`,
        requestOptions: { 
          reqData: { path: `/api/${i + 1}` }, 
          resReq: true,
          attempts: 2,
          wait: 50
        }
      })) satisfies API_GATEWAY_REQUEST[];

      const results = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        rateLimit: {
          maxRequests: 2,
          windowMs: 500
        }
      });

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(attemptCount).toBe(4); // 2 failed + 2 successful
    });

    it('should handle zero or negative rate limit values gracefully', async () => {
      const requests = Array.from({ length: 3 }, (_, i) => ({
        id: `req-${i + 1}`,
        requestOptions: { reqData: { path: `/api/${i + 1}` }, resReq: true }
      })) satisfies API_GATEWAY_REQUEST[];

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      // Should ignore invalid rate limit
      const results = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        rateLimit: {
          maxRequests: 0,
          windowMs: 1000
        }
      });

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Performance and timing', () => {
    it('should maintain correct timing with varying request durations', async () => {
      const executionLog: Array<{ id: string; start: number; end: number }> = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          const id = path.split('/').pop() || '';
          const duration = parseInt(id) * 20; // Variable duration

          const start = Date.now();
          await new Promise(resolve => setTimeout(resolve, duration));
          const end = Date.now();

          executionLog.push({ id, start, end });

          return {
            status: 200,
            data: { path },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const requests = Array.from({ length: 4 }, (_, i) => ({
        id: `req-${i + 1}`,
        requestOptions: { reqData: { path: `/api/${i + 1}` }, resReq: true }
      })) satisfies API_GATEWAY_REQUEST[];

      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        rateLimit: {
          maxRequests: 2,
          windowMs: 500
        }
      });

      expect(executionLog).toHaveLength(4);

      // First 2 should start together
      const firstTwo = executionLog.slice(0, 2);
      const firstTwoSpread = Math.max(...firstTwo.map(e => e.start)) - 
                            Math.min(...firstTwo.map(e => e.start));
      expect(firstTwoSpread).toBeLessThan(50);
    });

    it('should scale correctly with multiple phases', async () => {
      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return {
            status: 200,
            data: { path: config.url },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const phases = Array.from({ length: 3 }, (_, i) => ({
        id: `phase-${i + 1}`,
        concurrentExecution: true,
        requests: Array.from({ length: 3 }, (_, j) => ({
          id: `p${i + 1}-r${j + 1}`,
          requestOptions: { reqData: { path: `/p${i + 1}/${j + 1}` }, resReq: true }
        }))
      })) satisfies STABLE_WORKFLOW_PHASE[];

      const startTime = Date.now();
      const result = await stableWorkflow(phases, {
        workflowId: 'wf-multi-phase-rate-limit',
        commonRequestData: { hostname: 'api.example.com' },
        rateLimit: {
          maxRequests: 2,
          windowMs: 500
        }
      });
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      // 3 phases * (3 requests at 2 per 500ms) = 3 phases * ~500ms = ~1.5 seconds
      expect(totalTime).toBeGreaterThanOrEqual(1500);
    });
  });
});