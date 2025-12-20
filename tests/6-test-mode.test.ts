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
    await expect(
      stableRequest({
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
      })
    ).rejects.toThrow();

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

    expect(result).toEqual({ trialMode: { enabled: true, reqFailureProbability: 0 } });
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('should throw error for invalid reqFailureProbability', async () => {
    await expect(
      stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/test'
        },
        trialMode: {
          enabled: true,
          reqFailureProbability: 1.5 // Invalid: > 1
        }
      })
    ).rejects.toThrow('request failure probability must be between 0 and 1');
  });

  it('should throw error for invalid retryFailureProbability', async () => {
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
        }
      })
    ).rejects.toThrow('retry failure probability must be between 0 and 1');
  });

  it('should call error handlers during trial mode failures', async () => {
    const errorHandler = jest.fn();

    await expect(
      stableRequest({
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
      })
    ).rejects.toThrow();

    expect(errorHandler).toHaveBeenCalledTimes(2);
  });
});