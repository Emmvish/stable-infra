import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { stableRequest } from '../src/core/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Trial Mode - Failure Simulation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should simulate failures based on reqFailureProbability', async () => {
    // With 100% failure probability, should always fail
    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/test'
      },
      attempts: 3,
      wait: 10,
      trialMode: {
        enabled: true,
        reqFailureProbability: 1.0
      }
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    // axios should not be called in trial mode
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('should succeed when reqFailureProbability is 0', async () => {
    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/test'
      },
      resReq: true,
      attempts: 1,
      trialMode: {
        enabled: true,
        reqFailureProbability: 0
      }
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ trialMode: { enabled: true, reqFailureProbability: 0 } });
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('should return error result for invalid reqFailureProbability', async () => {
    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/test'
      },
      trialMode: {
        enabled: true,
        reqFailureProbability: 1.5 // Invalid: > 1
      }
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('request failure probability must be between 0 and 1');
  });

  it('should throw error for invalid reqFailureProbability when throwOnFailedErrorAnalysis is true', async () => {
    await expect(
      stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/test'
        },
        trialMode: {
          enabled: true,
          reqFailureProbability: 1.5 // Invalid: > 1
        },
        throwOnFailedErrorAnalysis: true
      })
    ).rejects.toThrow('request failure probability must be between 0 and 1');
  });

  it('should return error result for invalid retryFailureProbability', async () => {
    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/test'
      },
      trialMode: {
        enabled: true,
        reqFailureProbability: 0.5,
        retryFailureProbability: -0.1 // Invalid: < 0
      }
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('retry failure probability must be between 0 and 1');
  });

  it('should throw error for invalid retryFailureProbability when throwOnFailedErrorAnalysis is true', async () => {
    await expect(
      stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/test'
        },
        trialMode: {
          enabled: true,
          reqFailureProbability: 0.5,
          retryFailureProbability: -0.1 // Invalid: < 0
        },
        throwOnFailedErrorAnalysis: true
      })
    ).rejects.toThrow('retry failure probability must be between 0 and 1');
  });

  it('should call error handlers during trial mode failures', async () => {
    const errorHandler = jest.fn();

    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/test'
      },
      attempts: 2,
      wait: 10,
      logAllErrors: true,
      handleErrors: errorHandler,
      trialMode: {
        enabled: true,
        reqFailureProbability: 1.0
      }
    });

    expect(result.success).toBe(false);
    expect(errorHandler).toHaveBeenCalledTimes(2);
  });
});