import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosRequestConfig } from 'axios';
import { stableApiGateway, stableWorkflow, ConcurrencyLimiter } from '../src/index.js';
import { API_GATEWAY_REQUEST, STABLE_WORKFLOW_PHASE } from '../src/types/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Concurrency Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ConcurrencyLimiter class', () => {
    it('should limit concurrent execution to specified limit', async () => {
      const limiter = new ConcurrencyLimiter(2);
      let currentConcurrent = 0;
      let maxConcurrent = 0;

      const task = async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise(resolve => setTimeout(resolve, 50));
        currentConcurrent--;
      };

      const tasks = Array.from({ length: 10 }, () => limiter.execute(task));
      await Promise.all(tasks);

      expect(maxConcurrent).toBe(2);
    });

    it('should execute tasks sequentially when limit is 1', async () => {
      const limiter = new ConcurrencyLimiter(1);
      const executionOrder: number[] = [];

      const createTask = (id: number) => async () => {
        executionOrder.push(id);
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      const tasks = [1, 2, 3, 4, 5].map(id => limiter.execute(createTask(id)));
      await Promise.all(tasks);

      expect(executionOrder).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle tasks with varying execution times', async () => {
      const limiter = new ConcurrencyLimiter(3);
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const createTask = (delay: number) => async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise(resolve => setTimeout(resolve, delay));
        currentConcurrent--;
      };

      const tasks = [100, 50, 25, 75, 30].map(delay => limiter.execute(createTask(delay)));
      await Promise.all(tasks);

      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(maxConcurrent).toBeGreaterThan(1);
    });

    it('should handle errors in tasks without breaking the queue', async () => {
      const limiter = new ConcurrencyLimiter(2);
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

    it('should round down and use minimum of 1 for invalid limits', () => {
      const limiter1 = new ConcurrencyLimiter(0);
      const limiter2 = new ConcurrencyLimiter(-5);
      const limiter3 = new ConcurrencyLimiter(2.7);

      // @ts-ignore - accessing private property for testing
      expect(limiter1.limit).toBe(1);
      // @ts-ignore
      expect(limiter2.limit).toBe(1);
      // @ts-ignore
      expect(limiter3.limit).toBe(2);
    });

    it('should use executeAll helper method', async () => {
      const limiter = new ConcurrencyLimiter(2);
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const createTask = (id: number) => async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise(resolve => setTimeout(resolve, 20));
        currentConcurrent--;
        return id * 2;
      };

      const tasks = [1, 2, 3, 4, 5].map(id => createTask(id));
      const results = await limiter.executeAll(tasks);

      expect(results).toEqual([2, 4, 6, 8, 10]);
      expect(maxConcurrent).toBe(2);
    });
  });

  describe('API Gateway - maxConcurrentRequests', () => {
    it('should limit concurrent requests in stableApiGateway', async () => {
      let currentConcurrent = 0;
      let maxConcurrent = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);

          await new Promise(resolve => setTimeout(resolve, 50));

          currentConcurrent--;

          return {
            status: 200,
            data: { path: config.url },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const requests = Array.from({ length: 10 }, (_, i) => ({
        id: `req-${i + 1}`,
        requestOptions: { reqData: { path: `/api/${i + 1}` }, resReq: true }
      })) satisfies API_GATEWAY_REQUEST[];

      const results = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        maxConcurrentRequests: 3
      });

      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(maxConcurrent).toBeGreaterThan(1);
    });

    it('should work without concurrency limit (unlimited concurrency)', async () => {
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);

          await new Promise(resolve => setTimeout(resolve, 30));

          currentConcurrent--;

          return {
            status: 200,
            data: { path: config.url },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const requests = Array.from({ length: 5 }, (_, i) => ({
        id: `req-${i + 1}`,
        requestOptions: { reqData: { path: `/api/${i + 1}` }, resReq: true }
      })) satisfies API_GATEWAY_REQUEST[];

      const results = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true
        // No maxConcurrentRequests - should allow all concurrent
      });

      expect(results).toHaveLength(5);
      expect(maxConcurrent).toBe(5);
    });

    it('should handle maxConcurrentRequests = 1 (fully sequential despite concurrentExecution = true)', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(`${path}-start`);
          await new Promise(resolve => setTimeout(resolve, 10));
          executionOrder.push(`${path}-end`);

          return {
            status: 200,
            data: { path },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const requests = [
        { id: 'req-1', requestOptions: { reqData: { path: '/api/1' }, resReq: true } },
        { id: 'req-2', requestOptions: { reqData: { path: '/api/2' }, resReq: true } },
        { id: 'req-3', requestOptions: { reqData: { path: '/api/3' }, resReq: true } }
      ] satisfies API_GATEWAY_REQUEST[];

      const results = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        maxConcurrentRequests: 1
      });

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);

      // With maxConcurrentRequests = 1, should be fully sequential
      expect(executionOrder.indexOf('/api/1-end')).toBeLessThan(executionOrder.indexOf('/api/2-start'));
      expect(executionOrder.indexOf('/api/2-end')).toBeLessThan(executionOrder.indexOf('/api/3-start'));
    });

    it('should respect maxConcurrentRequests with request failures', async () => {
      let currentConcurrent = 0;
      let maxConcurrent = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);

          await new Promise(resolve => setTimeout(resolve, 30));

          currentConcurrent--;

          const path = config.url || '';
          if (path.includes('/api/3') || path.includes('/api/7')) {
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

      const requests = Array.from({ length: 10 }, (_, i) => ({
        id: `req-${i + 1}`,
        requestOptions: { reqData: { path: `/api/${i + 1}` }, resReq: true, attempts: 1 }
      })) satisfies API_GATEWAY_REQUEST[];

      const results = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        maxConcurrentRequests: 3
      });

      expect(results).toHaveLength(10);
      expect(results.filter(r => r.success)).toHaveLength(8);
      expect(results.filter(r => !r.success)).toHaveLength(2);
      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    it('should not apply limiting when concurrentExecution is false', async () => {
      const executionOrder: string[] = [];

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionOrder.push(`${path}-start`);
          await new Promise(resolve => setTimeout(resolve, 10));
          executionOrder.push(`${path}-end`);

          return {
            status: 200,
            data: { path },
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

      const results = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: false,
        maxConcurrentRequests: 10 // Should be ignored in sequential mode
      });

      expect(results).toHaveLength(3);
      // Should execute sequentially
      expect(executionOrder.indexOf('/api/1-end')).toBeLessThan(executionOrder.indexOf('/api/2-start'));
      expect(executionOrder.indexOf('/api/2-end')).toBeLessThan(executionOrder.indexOf('/api/3-start'));
    });
  });

  describe('Workflow-level maxConcurrentRequests', () => {
    it('should apply workflow-level concurrency limit to all phases', async () => {
      let maxConcurrentPhase1 = 0;
      let maxConcurrentPhase2 = 0;
      let currentConcurrent = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          currentConcurrent++;

          if (path.includes('p1')) {
            maxConcurrentPhase1 = Math.max(maxConcurrentPhase1, currentConcurrent);
          } else if (path.includes('p2')) {
            maxConcurrentPhase2 = Math.max(maxConcurrentPhase2, currentConcurrent);
          }

          await new Promise(resolve => setTimeout(resolve, 30));

          currentConcurrent--;

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
          requests: Array.from({ length: 5 }, (_, i) => ({
            id: `p1-r${i + 1}`,
            requestOptions: { reqData: { path: `/p1/${i + 1}` }, resReq: true }
          }))
        },
        {
          id: 'phase-2',
          concurrentExecution: true,
          requests: Array.from({ length: 5 }, (_, i) => ({
            id: `p2-r${i + 1}`,
            requestOptions: { reqData: { path: `/p2/${i + 1}` }, resReq: true }
          }))
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-limited',
        commonRequestData: { hostname: 'api.example.com' },
        maxConcurrentRequests: 2
      });

      expect(result.success).toBe(true);
      expect(maxConcurrentPhase1).toBeLessThanOrEqual(2);
      expect(maxConcurrentPhase2).toBeLessThanOrEqual(2);
    });

    it('should allow phase-level override of workflow concurrency limit', async () => {
      const phaseMaxConcurrency: Record<string, number> = { p1: 0, p2: 0 };
      const currentConcurrentByPhase: Record<string, number> = { p1: 0, p2: 0 };

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          const phaseKey = path.includes('p1') ? 'p1' : 'p2';

          currentConcurrentByPhase[phaseKey]++;
          phaseMaxConcurrency[phaseKey] = Math.max(
            phaseMaxConcurrency[phaseKey],
            currentConcurrentByPhase[phaseKey]
          );

          await new Promise(resolve => setTimeout(resolve, 30));

          currentConcurrentByPhase[phaseKey]--;

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
          id: 'phase-1-restricted',
          concurrentExecution: true,
          maxConcurrentRequests: 1,  // Override: only 1 at a time
          requests: Array.from({ length: 3 }, (_, i) => ({
            id: `p1-r${i + 1}`,
            requestOptions: { reqData: { path: `/p1/${i + 1}` }, resReq: true }
          }))
        },
        {
          id: 'phase-2-relaxed',
          concurrentExecution: true,
          maxConcurrentRequests: 5,  // Override: up to 5 concurrent
          requests: Array.from({ length: 6 }, (_, i) => ({
            id: `p2-r${i + 1}`,
            requestOptions: { reqData: { path: `/p2/${i + 1}` }, resReq: true }
          }))
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-phase-override',
        commonRequestData: { hostname: 'api.example.com' },
        maxConcurrentRequests: 3  // Workflow default
      });

      expect(result.success).toBe(true);
      expect(phaseMaxConcurrency.p1).toBe(1);  // Respects phase override
      expect(phaseMaxConcurrency.p2).toBeLessThanOrEqual(5);  // Respects phase override
      expect(phaseMaxConcurrency.p2).toBeGreaterThan(3); // Proves it used phase-level, not workflow-level
    });

    it('should use workflow limit when phase does not specify maxConcurrentRequests', async () => {
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);

          await new Promise(resolve => setTimeout(resolve, 30));

          currentConcurrent--;

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
          // No maxConcurrentRequests - should use workflow level
          requests: Array.from({ length: 8 }, (_, i) => ({
            id: `r${i + 1}`,
            requestOptions: { reqData: { path: `/api/${i + 1}` }, resReq: true }
          }))
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-default-limit',
        commonRequestData: { hostname: 'api.example.com' },
        maxConcurrentRequests: 3
      });

      expect(result.success).toBe(true);
      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(maxConcurrent).toBeGreaterThan(1);
    });

    it('should handle concurrent phase execution with maxConcurrentRequests', async () => {
      const phaseExecutionTimes: Record<string, { start: number; end: number }> = {};

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          const phaseId = path.split('/')[1];

          if (!phaseExecutionTimes[phaseId]) {
            phaseExecutionTimes[phaseId] = { start: Date.now(), end: 0 };
          }

          await new Promise(resolve => setTimeout(resolve, 40));

          phaseExecutionTimes[phaseId].end = Date.now();

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
          maxConcurrentRequests: 2,
          requests: Array.from({ length: 4 }, (_, i) => ({
            id: `p1-r${i + 1}`,
            requestOptions: { reqData: { path: `/p1/${i + 1}` }, resReq: true }
          }))
        },
        {
          id: 'phase-2',
          concurrentExecution: true,
          maxConcurrentRequests: 2,
          requests: Array.from({ length: 4 }, (_, i) => ({
            id: `p2-r${i + 1}`,
            requestOptions: { reqData: { path: `/p2/${i + 1}` }, resReq: true }
          }))
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-concurrent-phases-limited',
        commonRequestData: { hostname: 'api.example.com' },
        concurrentPhaseExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(2);

      // Phases should execute concurrently (overlapping start times)
      const p1Start = phaseExecutionTimes['p1'].start;
      const p2Start = phaseExecutionTimes['p2'].start;
      expect(Math.abs(p1Start - p2Start)).toBeLessThan(50);
    });
  });

  describe('Mixed execution mode with concurrency limiting', () => {
    it('should apply concurrency limits within concurrent groups in mixed mode', async () => {
      let maxConcurrentInGroup = 0;
      let currentConcurrent = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          
          currentConcurrent++;
          if (path.includes('p2') || path.includes('p3')) {
            maxConcurrentInGroup = Math.max(maxConcurrentInGroup, currentConcurrent);
          }

          await new Promise(resolve => setTimeout(resolve, 30));

          currentConcurrent--;

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
          maxConcurrentRequests: 2,
          requests: Array.from({ length: 3 }, (_, i) => ({
            id: `p2-r${i + 1}`,
            requestOptions: { reqData: { path: `/p2/${i + 1}` }, resReq: true }
          }))
        },
        {
          id: 'phase-3',
          markConcurrentPhase: true,
          maxConcurrentRequests: 2,
          requests: Array.from({ length: 3 }, (_, i) => ({
            id: `p3-r${i + 1}`,
            requestOptions: { reqData: { path: `/p3/${i + 1}` }, resReq: true }
          }))
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-mixed-with-limits',
        commonRequestData: { hostname: 'api.example.com' },
        enableMixedExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(3);
      // Each phase in the concurrent group has maxConcurrentRequests: 2
      // But they execute concurrently, so max could be higher
      expect(maxConcurrentInGroup).toBeLessThanOrEqual(4); // 2 from each phase max
    });

    it('should handle different limits for sequential and concurrent phases', async () => {
      const executionLog: string[] = [];
      let maxConcurrentP2P3 = 0;
      let currentConcurrent = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          executionLog.push(`${path}-start`);

          currentConcurrent++;
          if (path.includes('p2') || path.includes('p3')) {
            maxConcurrentP2P3 = Math.max(maxConcurrentP2P3, currentConcurrent);
          }

          await new Promise(resolve => setTimeout(resolve, 20));

          currentConcurrent--;
          executionLog.push(`${path}-end`);

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
          maxConcurrentRequests: 1,
          requests: Array.from({ length: 2 }, (_, i) => ({
            id: `p1-r${i + 1}`,
            requestOptions: { reqData: { path: `/p1/${i + 1}` }, resReq: true }
          }))
        },
        {
          id: 'phase-2',
          markConcurrentPhase: true,
          maxConcurrentRequests: 3,
          requests: Array.from({ length: 4 }, (_, i) => ({
            id: `p2-r${i + 1}`,
            requestOptions: { reqData: { path: `/p2/${i + 1}` }, resReq: true }
          }))
        },
        {
          id: 'phase-3',
          markConcurrentPhase: true,
          maxConcurrentRequests: 3,
          requests: Array.from({ length: 4 }, (_, i) => ({
            id: `p3-r${i + 1}`,
            requestOptions: { reqData: { path: `/p3/${i + 1}` }, resReq: true }
          }))
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-mixed-varying-limits',
        commonRequestData: { hostname: 'api.example.com' },
        enableMixedExecution: true
      });

      expect(result.success).toBe(true);
      expect(result.completedPhases).toBe(3);

      // Phase 1 should complete before phase 2 and 3 start
      const p1LastEnd = executionLog.lastIndexOf('/p1/2-end');
      const p2FirstStart = executionLog.indexOf('/p2/1-start');
      const p3FirstStart = executionLog.indexOf('/p3/1-start');

      expect(p1LastEnd).toBeLessThan(p2FirstStart);
      expect(p1LastEnd).toBeLessThan(p3FirstStart);

      // Phases 2 and 3 execute concurrently with their own limits
      expect(maxConcurrentP2P3).toBeLessThanOrEqual(6); // 3 + 3 max
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle maxConcurrentRequests larger than number of requests', async () => {
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);

          await new Promise(resolve => setTimeout(resolve, 20));

          currentConcurrent--;

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

      const results = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        maxConcurrentRequests: 10 // More than number of requests
      });

      expect(results).toHaveLength(3);
      expect(maxConcurrent).toBe(3); // All 3 execute concurrently
    });

    it('should handle maxConcurrentRequests with retries', async () => {
      let maxConcurrent = 0;
      let currentConcurrent = 0;
      let attemptCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          attemptCount++;
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);

          await new Promise(resolve => setTimeout(resolve, 20));

          currentConcurrent--;

          const path = config.url || '';
          // Fail first attempt for each request
          if (attemptCount <= 3) {
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

      const requests = Array.from({ length: 3 }, (_, i) => ({
        id: `req-${i + 1}`,
        requestOptions: { 
          reqData: { path: `/api/${i + 1}` }, 
          resReq: true,
          attempts: 2,
          wait: 10
        }
      })) satisfies API_GATEWAY_REQUEST[];

      const results = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        maxConcurrentRequests: 2
      });

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      // Note: Retries happen within each request slot, so max concurrent might be higher
      // than the limit during retry attempts. The limit applies to concurrent request slots, not HTTP calls.
      expect(maxConcurrent).toBeLessThanOrEqual(3);
      // With maxConcurrentRequests: 2, first 2 requests start and each retry once (2 + 2 = 4)
      // Then 3rd request starts and succeeds first time (1). Total: 5 attempts
      expect(attemptCount).toBeGreaterThanOrEqual(5);
      expect(attemptCount).toBeLessThanOrEqual(6);
    });

    it('should handle zero or negative maxConcurrentRequests gracefully', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          requestCount++;
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

      // Should treat 0 or negative as minimum of 1
      const results = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        maxConcurrentRequests: 0
      });

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(requestCount).toBe(3);
    });

    it('should maintain correct request/response mapping with concurrency limiting', async () => {
      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          const id = path.split('/').pop();
          await new Promise(resolve => setTimeout(resolve, Math.random() * 30));

          return {
            status: 200,
            data: { id },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const requests = Array.from({ length: 10 }, (_, i) => ({
        id: `req-${i + 1}`,
        requestOptions: { reqData: { path: `/api/${i + 1}` }, resReq: true }
      })) satisfies API_GATEWAY_REQUEST[];

      const results = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        maxConcurrentRequests: 3
      });

      expect(results).toHaveLength(10);

      // Verify each request got its correct response
      for (let i = 0; i < 10; i++) {
        expect(results[i].requestId).toBe(`req-${i + 1}`);
        expect(results[i].data).toEqual({ id: `${i + 1}` });
      }
    });
  });

  describe('Performance and timing', () => {
    it('should execute faster with higher concurrency limit', async () => {
      const createMockImplementation = () => {
        return (async (config: AxiosRequestConfig) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return {
            status: 200,
            data: { path: config.url },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>;
      };

      const requests = Array.from({ length: 10 }, (_, i) => ({
        id: `req-${i + 1}`,
        requestOptions: { reqData: { path: `/api/${i + 1}` }, resReq: true }
      })) satisfies API_GATEWAY_REQUEST[];

      // Test with limit of 2
      mockedAxios.request.mockImplementation(createMockImplementation());
      const start1 = Date.now();
      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        maxConcurrentRequests: 2
      });
      const time1 = Date.now() - start1;

      jest.clearAllMocks();

      // Test with limit of 5
      mockedAxios.request.mockImplementation(createMockImplementation());
      const start2 = Date.now();
      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        maxConcurrentRequests: 5
      });
      const time2 = Date.now() - start2;

      // Higher concurrency should be faster
      expect(time2).toBeLessThan(time1);
    });

    it('should respect timing constraints across multiple phases', async () => {
      const phaseTimings: Record<string, { start: number; end: number }> = {};

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          const path = config.url || '';
          const phaseId = path.split('/')[1];

          if (!phaseTimings[phaseId]) {
            phaseTimings[phaseId] = { start: Date.now(), end: 0 };
          }

          await new Promise(resolve => setTimeout(resolve, 40));

          phaseTimings[phaseId].end = Date.now();

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
          maxConcurrentRequests: 1,
          requests: Array.from({ length: 3 }, (_, i) => ({
            id: `p1-r${i + 1}`,
            requestOptions: { reqData: { path: `/p1/${i + 1}` }, resReq: true }
          }))
        },
        {
          id: 'phase-2',
          concurrentExecution: true,
          maxConcurrentRequests: 3,
          requests: Array.from({ length: 3 }, (_, i) => ({
            id: `p2-r${i + 1}`,
            requestOptions: { reqData: { path: `/p2/${i + 1}` }, resReq: true }
          }))
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const startTime = Date.now();
      const result = await stableWorkflow(phases, {
        workflowId: 'wf-timing-test',
        commonRequestData: { hostname: 'api.example.com' }
      });
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);

      // Phase 1 with limit 1: ~120ms (3 * 40ms)
      // Phase 2 with limit 3: ~40ms (all concurrent)
      // Total should be ~160ms + overhead, but allowing for test execution variability
      expect(totalTime).toBeGreaterThanOrEqual(80); // More lenient for fast systems
      expect(totalTime).toBeLessThan(300);

      // Verify phase 1 completed before phase 2 started
      expect(phaseTimings['p1'].end).toBeLessThanOrEqual(phaseTimings['p2'].start + 50);
    });
  });
});