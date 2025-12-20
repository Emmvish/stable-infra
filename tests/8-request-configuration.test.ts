import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { stableRequest } from '../src/core/index.js';
import { REQUEST_METHODS, VALID_REQUEST_PROTOCOLS } from '../src/enums/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Request Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should build correct URL with hostname, port, protocol, and path', async () => {
    mockedAxios.request.mockResolvedValue({
      status: 200,
      data: {},
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        port: 8080,
        protocol: VALID_REQUEST_PROTOCOLS.HTTP,
        path: '/api/v1/users'
      }
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://api.example.com:8080',
        url: '/api/v1/users'
      })
    );
  });

  it('should use HTTPS and port 443 by default', async () => {
    mockedAxios.request.mockResolvedValue({
      status: 200,
      data: {},
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/test'
      }
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://api.example.com:443'
      })
    );
  });

  it('should handle query parameters correctly', async () => {
    mockedAxios.request.mockResolvedValue({
      status: 200,
      data: {},
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/search',
        query: {
          q: 'test query',
          limit: 10,
          page: 2
        }
      }
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          q: 'test query',
          limit: 10,
          page: 2
        }
      })
    );
  });

  it('should handle request body for POST requests', async () => {
    mockedAxios.request.mockResolvedValue({
      status: 201,
      data: { id: 123 },
      statusText: 'Created',
      headers: {},
      config: {} as any
    });

    const requestBody = {
      name: 'John Doe',
      email: 'john@example.com'
    };

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/users',
        method: REQUEST_METHODS.POST,
        body: requestBody
      }
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        data: requestBody
      })
    );
  });

  it('should include custom headers', async () => {
    mockedAxios.request.mockResolvedValue({
      status: 200,
      data: {},
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/protected',
        headers: {
          'Authorization': 'Bearer token123',
          'X-API-Key': 'secret-key',
          'Content-Type': 'application/json'
        }
      }
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          'Authorization': 'Bearer token123',
          'X-API-Key': 'secret-key',
          'Content-Type': 'application/json'
        }
      })
    );
  });

  it('should set custom timeout', async () => {
    mockedAxios.request.mockResolvedValue({
      status: 200,
      data: {},
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/slow',
        timeout: 30000
      }
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 30000
      })
    );
  });

  it('should use default timeout of 15000ms when not specified', async () => {
    mockedAxios.request.mockResolvedValue({
      status: 200,
      data: {},
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/test'
      }
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 15000
      })
    );
  });

  it('should support AbortSignal for request cancellation', async () => {
    const controller = new AbortController();
    
    mockedAxios.request.mockResolvedValue({
      status: 200,
      data: {},
      statusText: 'OK',
      headers: {},
      config: {} as any
    });

    await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        path: '/test',
        signal: controller.signal
      }
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: controller.signal
      })
    );
  });
});