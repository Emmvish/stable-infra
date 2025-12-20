import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { stableRequest } from '../src/core/index.js';
import { RETRY_STRATEGIES } from '../src/enums/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Retry Strategies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use FIXED strategy with constant delays', async () => {
    const startTime = Date.now();
    
    mockedAxios.request
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/data'
      },
      attempts: 3,
      wait: 100,
      retryStrategy: RETRY_STRATEGIES.FIXED
    });

    const elapsed = Date.now() - startTime;
    
    // Fixed: 100ms + 100ms = 200ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(180);
    expect(elapsed).toBeLessThan(400);
  });

  it('should use LINEAR strategy with increasing delays', async () => {
    const startTime = Date.now();
    
    mockedAxios.request
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/data'
      },
      attempts: 3,
      wait: 100,
      retryStrategy: RETRY_STRATEGIES.LINEAR
    });

    const elapsed = Date.now() - startTime;
    
    // Linear: 1*100 + 2*100 = 300ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(280);
    expect(elapsed).toBeLessThan(500);
  });

  it('should use EXPONENTIAL strategy with exponentially increasing delays', async () => {
    const startTime = Date.now();
    
    mockedAxios.request
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/data'
      },
      attempts: 3,
      wait: 100,
      maxAllowedWait: 10000,
      retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
    });

    const elapsed = Date.now() - startTime;
    
    // Exponential: 100*2^0 + 100*2^1 = 100 + 200 = 300ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(280);
    expect(elapsed).toBeLessThan(500);
  });
});