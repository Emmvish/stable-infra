import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosRequestConfig } from 'axios';
import { 
    stableRequest,
    stableApiGateway, 
    stableWorkflow, 
    CacheManager,
    resetGlobalCacheManager
} from '../src/index.js';
import { API_GATEWAY_REQUEST, STABLE_WORKFLOW_PHASE } from '../src/types/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Caching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetGlobalCacheManager();
  });

  describe('CacheManager class', () => {
    it('should cache and retrieve response', () => {
      const cache = new CacheManager({
        enabled: true,
        ttl: 60000
      });

      const reqConfig: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data'
      };

      const data = { id: 1, name: 'Test' };
      cache.set(reqConfig, data, 200, 'OK', {});

      const cached = cache.get(reqConfig);
      expect(cached).not.toBeNull();
      expect(cached?.data).toEqual(data);
      expect(cached?.status).toBe(200);
    });

    it('should not cache when disabled', () => {
      const cache = new CacheManager({
        enabled: false
      });

      const reqConfig: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data'
      };

      cache.set(reqConfig, { data: 'test' }, 200, 'OK', {});
      const cached = cache.get(reqConfig);
      
      expect(cached).toBeNull();
    });

    it('should respect TTL and expire entries', async () => {
      const cache = new CacheManager({
        enabled: true,
        ttl: 100 // 100ms
      });

      const reqConfig: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data'
      };

      cache.set(reqConfig, { data: 'test' }, 200, 'OK', {});
      
      // Should be cached
      let cached = cache.get(reqConfig);
      expect(cached).not.toBeNull();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      cached = cache.get(reqConfig);
      expect(cached).toBeNull();
    });

    it('should respect cache-control max-age header', () => {
      const cache = new CacheManager({
        enabled: true,
        ttl: 60000,
        respectCacheControl: true
      });

      const reqConfig: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data'
      };

      // Cache with max-age=5 seconds
      cache.set(reqConfig, { data: 'test' }, 200, 'OK', {
        'cache-control': 'max-age=5'
      });

      const cached = cache.get(reqConfig);
      expect(cached).not.toBeNull();
      
      // Expiration should be ~5 seconds, not 60 seconds
      const ttl = cached!.expiresAt - cached!.timestamp;
      expect(ttl).toBeCloseTo(5000, -2); // Within 100ms
    });

    it('should not cache when cache-control is no-cache', () => {
      const cache = new CacheManager({
        enabled: true,
        respectCacheControl: true
      });

      const reqConfig: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data'
      };

      cache.set(reqConfig, { data: 'test' }, 200, 'OK', {
        'cache-control': 'no-cache'
      });

      const cached = cache.get(reqConfig);
      expect(cached).toBeNull();
    });

    it('should not cache when cache-control is no-store', () => {
      const cache = new CacheManager({
        enabled: true,
        respectCacheControl: true
      });

      const reqConfig: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data'
      };

      cache.set(reqConfig, { data: 'test' }, 200, 'OK', {
        'cache-control': 'no-store'
      });

      const cached = cache.get(reqConfig);
      expect(cached).toBeNull();
    });

    it('should respect Expires header', () => {
      const cache = new CacheManager({
        enabled: true,
        respectCacheControl: true
      });

      const reqConfig: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data'
      };

      const futureDate = new Date(Date.now() + 10000).toUTCString();
      cache.set(reqConfig, { data: 'test' }, 200, 'OK', {
        'expires': futureDate
      });

      const cached = cache.get(reqConfig);
      expect(cached).not.toBeNull();
      
      const ttl = cached!.expiresAt - cached!.timestamp;
      expect(ttl).toBeGreaterThan(9000);
      expect(ttl).toBeLessThan(11000);
    });

    it('should not cache POST requests by default', () => {
      const cache = new CacheManager({
        enabled: true
      });

      const reqConfig: AxiosRequestConfig = {
        method: 'POST',
        url: 'https://api.example.com/data',
        data: { name: 'test' }
      };

      cache.set(reqConfig, { success: true }, 201, 'Created', {});
      const cached = cache.get(reqConfig);
      
      expect(cached).toBeNull();
    });

    it('should not cache PUT, PATCH, DELETE requests by default', () => {
      const cache = new CacheManager({
        enabled: true
      });

      const methods = ['PUT', 'PATCH', 'DELETE'];
      
      methods.forEach(method => {
        const reqConfig: AxiosRequestConfig = {
          method,
          url: 'https://api.example.com/data'
        };

        cache.set(reqConfig, { success: true }, 200, 'OK', {});
        const cached = cache.get(reqConfig);
        
        expect(cached).toBeNull();
      });
    });

    it('should cache only specified status codes', () => {
      const cache = new CacheManager({
        enabled: true,
        cacheableStatusCodes: [200, 404]
      });

      const reqConfig1: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data'
      };

      const reqConfig2: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/other'
      };

      // Cache 200 - should work
      cache.set(reqConfig1, { data: 'test' }, 200, 'OK', {});
      expect(cache.get(reqConfig1)).not.toBeNull();

      // Try to cache 500 - should not cache
      cache.set(reqConfig2, { error: 'Server Error' }, 500, 'Error', {});
      expect(cache.get(reqConfig2)).toBeNull();
    });

    it('should implement LRU eviction when cache is full', () => {
      const cache = new CacheManager({
        enabled: true,
        maxSize: 3
      });

      // Add 4 entries
      for (let i = 1; i <= 4; i++) {
        const reqConfig: AxiosRequestConfig = {
          method: 'GET',
          url: `https://api.example.com/data/${i}`
        };
        cache.set(reqConfig, { id: i }, 200, 'OK', {});
      }

      // First entry should be evicted
      const first = cache.get({
        method: 'GET',
        url: 'https://api.example.com/data/1'
      });
      expect(first).toBeNull();

      // Others should exist
      const second = cache.get({
        method: 'GET',
        url: 'https://api.example.com/data/2'
      });
      expect(second).not.toBeNull();
    });

    it('should update LRU order on cache access', () => {
      const cache = new CacheManager({
        enabled: true,
        maxSize: 3
      });

      // Add 3 entries
      for (let i = 1; i <= 3; i++) {
        cache.set(
          { method: 'GET', url: `/data/${i}` },
          { id: i },
          200,
          'OK',
          {}
        );
      }

      // Access entry 1 (moves it to end of LRU)
      cache.get({ method: 'GET', url: '/data/1' });

      // Add 4th entry - should evict entry 2 (oldest)
      cache.set(
        { method: 'GET', url: '/data/4' },
        { id: 4 },
        200,
        'OK',
        {}
      );

      expect(cache.get({ method: 'GET', url: '/data/1' })).not.toBeNull();
      expect(cache.get({ method: 'GET', url: '/data/2' })).toBeNull();
      expect(cache.get({ method: 'GET', url: '/data/3' })).not.toBeNull();
      expect(cache.get({ method: 'GET', url: '/data/4' })).not.toBeNull();
    });

    it('should generate consistent cache keys', () => {
      const cache = new CacheManager({
        enabled: true
      });

      const reqConfig1: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data',
        params: { id: 1, sort: 'asc' }
      };

      const reqConfig2: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data',
        params: { id: 1, sort: 'asc' }
      };

      cache.set(reqConfig1, { data: 'test' }, 200, 'OK', {});
      
      // Should retrieve with different but equivalent config
      const cached = cache.get(reqConfig2);
      expect(cached).not.toBeNull();
      expect(cached?.data).toEqual({ data: 'test' });
    });

    it('should differentiate cache keys by query params', () => {
      const cache = new CacheManager({
        enabled: true
      });

      const reqConfig1: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data',
        params: { id: 1 }
      };

      const reqConfig2: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data',
        params: { id: 2 }
      };

      cache.set(reqConfig1, { data: 'first' }, 200, 'OK', {});
      cache.set(reqConfig2, { data: 'second' }, 200, 'OK', {});

      expect(cache.get(reqConfig1)?.data).toEqual({ data: 'first' });
      expect(cache.get(reqConfig2)?.data).toEqual({ data: 'second' });
    });

    it('should include relevant headers in cache key', () => {
      const cache = new CacheManager({
        enabled: true
      });

      const reqConfig1: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: { 'authorization': 'Bearer token1' }
      };

      const reqConfig2: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: { 'authorization': 'Bearer token2' }
      };

      cache.set(reqConfig1, { data: 'user1' }, 200, 'OK', {});
      cache.set(reqConfig2, { data: 'user2' }, 200, 'OK', {});

      expect(cache.get(reqConfig1)?.data).toEqual({ data: 'user1' });
      expect(cache.get(reqConfig2)?.data).toEqual({ data: 'user2' });
    });

    it('should use custom key generator if provided', () => {
      const cache = new CacheManager({
        enabled: true,
        keyGenerator: (config) => {
          // Simple key based only on URL
          return config.url || 'default';
        }
      });

      const reqConfig1: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data',
        params: { id: 1 }
      };

      const reqConfig2: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/data',
        params: { id: 2 } // Different params, same URL
      };

      cache.set(reqConfig1, { data: 'first' }, 200, 'OK', {});
      
      // Should return cached because custom key only uses URL
      const cached = cache.get(reqConfig2);
      expect(cached).not.toBeNull();
      expect(cached?.data).toEqual({ data: 'first' });
    });

    it('should clear all cache entries', () => {
      const cache = new CacheManager({
        enabled: true
      });

      for (let i = 1; i <= 3; i++) {
        cache.set(
          { method: 'GET', url: `/data/${i}` },
          { id: i },
          200,
          'OK',
          {}
        );
      }

      expect(cache.getStats().size).toBe(3);

      cache.clear();
      expect(cache.getStats().size).toBe(0);
    });

    it('should delete specific cached entry', () => {
      const cache = new CacheManager({
        enabled: true
      });

      const reqConfig: AxiosRequestConfig = {
        method: 'GET',
        url: '/data/1'
      };

      cache.set(reqConfig, { id: 1 }, 200, 'OK', {});
      expect(cache.get(reqConfig)).not.toBeNull();

      const deleted = cache.delete(reqConfig);
      expect(deleted).toBe(true);
      expect(cache.get(reqConfig)).toBeNull();
    });

    it('should prune expired entries', async () => {
      const cache = new CacheManager({
        enabled: true,
        ttl: 50
      });

      // Add entries
      for (let i = 1; i <= 3; i++) {
        cache.set(
          { method: 'GET', url: `/data/${i}` },
          { id: i },
          200,
          'OK',
          {}
        );
      }

      expect(cache.getStats().size).toBe(3);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const prunedCount = cache.prune();
      expect(prunedCount).toBe(3);
      expect(cache.getStats().size).toBe(0);
    });

    it('should provide accurate cache statistics', async () => {
      const cache = new CacheManager({
        enabled: true,
        ttl: 100,
        maxSize: 10
      });

      // Add some entries
      cache.set({ url: '/1' }, {}, 200, 'OK', {});
      await new Promise(resolve => setTimeout(resolve, 10));
      cache.set({ url: '/2' }, {}, 200, 'OK', {});

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.validEntries).toBe(2);
      expect(stats.expiredEntries).toBe(0);
      expect(stats.maxSize).toBe(10);
      expect(stats.oldestEntry).toBeLessThan(stats.newestEntry!);
    });

    it('should track expired entries in stats', async () => {
      const cache = new CacheManager({
        enabled: true,
        ttl: 50
      });

      cache.set({ url: '/1' }, {}, 200, 'OK', {});
      cache.set({ url: '/2' }, {}, 200, 'OK', {});

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.validEntries).toBe(0);
      expect(stats.expiredEntries).toBe(2);
    });
  });

  describe('stableRequest - cache option', () => {
    it('should cache successful responses', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async () => {
          requestCount++;
          return {
            status: 200,
            data: { id: 1, name: 'Test' },
            statusText: 'OK',
            headers: {},
            config: {} as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      // First request - should hit API
      const result1 = await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data'
        },
        resReq: true,
        cache: {
          enabled: true,
          ttl: 60000
        }
      });

      expect(result1).toEqual({ id: 1, name: 'Test' });
      expect(requestCount).toBe(1);

      // Second request - should use cache
      const result2 = await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data'
        },
        resReq: true,
        cache: {
          enabled: true,
          ttl: 60000
        }
      });

      expect(result2).toEqual({ id: 1, name: 'Test' });
      expect(requestCount).toBe(1); // No additional request
    });

    it('should not cache when cache is disabled', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async () => {
          requestCount++;
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {},
            config: {} as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const result1 = await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data'
        },
        resReq: true,
        cache: {
          enabled: false
        }
      });

      const result2 = await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data'
        },
        resReq: true,
        cache: {
          enabled: false
        }
      });

      expect(requestCount).toBe(2); // Both hit API
      expect(result1).toEqual({ count: 1 });
      expect(result2).toEqual({ count: 2 });
    });

    it('should respect cache-control headers when enabled', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async () => {
          requestCount++;
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {
              'cache-control': 'max-age=1' // 1 second
            },
            config: {} as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      // First request
      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data'
        },
        resReq: true,
        cache: {
          enabled: true,
          ttl: 60000,
          respectCacheControl: true
        }
      });

      expect(requestCount).toBe(1);

      // Immediate second request - should use cache
      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data'
        },
        resReq: true,
        cache: {
          enabled: true,
          ttl: 60000,
          respectCacheControl: true
        }
      });

      expect(requestCount).toBe(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Third request - should hit API
      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data'
        },
        resReq: true,
        cache: {
          enabled: true,
          ttl: 60000,
          respectCacheControl: true
        }
      });

      expect(requestCount).toBe(2);
    });

    it('should ignore cache-control when respectCacheControl is false', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async () => {
          requestCount++;
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {
              'cache-control': 'no-cache'
            },
            config: {} as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      // First request
      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data'
        },
        resReq: true,
        cache: {
          enabled: true,
          ttl: 60000,
          respectCacheControl: false // Ignore cache-control
        }
      });

      // Second request - should use cache despite no-cache header
      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data'
        },
        resReq: true,
        cache: {
          enabled: true,
          ttl: 60000,
          respectCacheControl: false
        }
      });

      expect(requestCount).toBe(1); // Cached despite no-cache
    });

    it('should not cache failed requests', async () => {
      mockedAxios.request
        .mockRejectedValueOnce({
          response: { status: 500, data: 'Error' },
          message: 'Server Error'
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true },
          statusText: 'OK',
          headers: {},
          config: {} as any
        });

      // First request fails
      try {
        await stableRequest({
          reqData: {
            hostname: 'api.example.com',
            path: '/data'
          },
          resReq: true,
          attempts: 1,
          cache: {
            enabled: true
          }
        });
      } catch (e) {
        // Expected to fail
      }

      // Second request should not use cache (first was error)
      const result = await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data'
        },
        resReq: true,
        cache: {
          enabled: true
        }
      });

      expect(result).toEqual({ success: true });
      expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    });

    it('should cache different URLs separately', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          requestCount++;
          return {
            status: 200,
            data: { path: config.url },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      await stableRequest({
        reqData: { hostname: 'api.example.com', path: '/data1' },
        resReq: true,
        cache: { enabled: true }
      });

      await stableRequest({
        reqData: { hostname: 'api.example.com', path: '/data2' },
        resReq: true,
        cache: { enabled: true }
      });

      // Both should hit API (different URLs)
      expect(requestCount).toBe(2);

      await stableRequest({
        reqData: { hostname: 'api.example.com', path: '/data1' },
        resReq: true,
        cache: { enabled: true }
      });

      // Should use cache for /data1
      expect(requestCount).toBe(2);
    });

    it('should handle retry logic with caching', async () => {
      mockedAxios.request
        .mockRejectedValueOnce({
          response: { status: 500 },
          message: 'Error'
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true },
          statusText: 'OK',
          headers: {},
          config: {} as any
        });

      // Request with retries
      const result1 = await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data'
        },
        resReq: true,
        attempts: 2,
        wait: 10,
        cache: {
          enabled: true,
          ttl: 60000
        }
      });

      expect(result1).toEqual({ success: true });
      expect(mockedAxios.request).toHaveBeenCalledTimes(2); // Failed once, succeeded on retry

      // Second request should use cache
      const result2 = await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data'
        },
        resReq: true,
        cache: {
          enabled: true,
          ttl: 60000
        }
      });

      expect(result2).toEqual({ success: true });
      expect(mockedAxios.request).toHaveBeenCalledTimes(2); // No additional call
    });

    it('should skip retries when response is from cache', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async () => {
          requestCount++;
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {},
            config: {} as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      // First request
      await stableRequest({
        reqData: { hostname: 'api.example.com', path: '/data' },
        resReq: true,
        attempts: 3,
        wait: 10,
        cache: { enabled: true }
      });

      expect(requestCount).toBe(1);

      // Second request - cached, no retry logic executed
      await stableRequest({
        reqData: { hostname: 'api.example.com', path: '/data' },
        resReq: true,
        attempts: 3,
        wait: 10,
        cache: { enabled: true }
      });

      expect(requestCount).toBe(1); // No retries for cached response
    });

    it('should return true for cached response when resReq is false', async () => {
      mockedAxios.request.mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      // First request
      const result1 = await stableRequest({
        reqData: { hostname: 'api.example.com', path: '/data' },
        resReq: false,
        cache: { enabled: true }
      });

      expect(result1).toBe(true);

      // Second request from cache
      const result2 = await stableRequest({
        reqData: { hostname: 'api.example.com', path: '/data' },
        resReq: false,
        cache: { enabled: true }
      });

      expect(result2).toBe(true);
      expect(mockedAxios.request).toHaveBeenCalledTimes(1);
    });

    it('should cache response with query parameters', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async () => {
          requestCount++;
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {},
            config: {} as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data',
          query: { id: 1, filter: 'active' }
        },
        resReq: true,
        cache: { enabled: true }
      });

      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data',
          query: { id: 1, filter: 'active' }
        },
        resReq: true,
        cache: { enabled: true }
      });

      expect(requestCount).toBe(1); // Second request cached
    });

    it('should not cache with different query parameters', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async () => {
          requestCount++;
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {},
            config: {} as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data',
          query: { id: 1 }
        },
        resReq: true,
        cache: { enabled: true }
      });

      await stableRequest({
        reqData: {
          hostname: 'api.example.com',
          path: '/data',
          query: { id: 2 }
        },
        resReq: true,
        cache: { enabled: true }
      });

      expect(requestCount).toBe(2); // Different query params
    });
  });

  describe('API Gateway - commonCache configuration', () => {
    it('should apply cache config to all requests', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          requestCount++;
          const path = config.url || '';
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
        { id: 'req-2', requestOptions: { reqData: { path: '/api/2' }, resReq: true } }
      ] satisfies API_GATEWAY_REQUEST[];

      // First batch
      const results1 = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: {
          enabled: true,
          ttl: 60000
        }
      });

      expect(results1).toHaveLength(2);
      expect(requestCount).toBe(2);

      // Second batch - same requests should use cache
      const results2 = await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: {
          enabled: true,
          ttl: 60000
        }
      });

      expect(results2).toHaveLength(2);
      expect(requestCount).toBe(2); // No additional requests
      expect(results2.every(r => r.success)).toBe(true);
    });

    it('should allow per-request cache override', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          requestCount++;
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const requests = [
        { 
          id: 'req-1', 
          requestOptions: { 
            reqData: { path: '/cached' }, 
            resReq: true,
            cache: { enabled: true, ttl: 60000 }
          } 
        },
        { 
          id: 'req-2', 
          requestOptions: { 
            reqData: { path: '/uncached' }, 
            resReq: true,
            cache: { enabled: false }
          } 
        }
      ] satisfies API_GATEWAY_REQUEST[];

      // First batch
      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' }
      });

      expect(requestCount).toBe(2);

      // Second batch
      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' }
      });

      expect(requestCount).toBe(3); // req-1 cached, req-2 not cached
    });

    it('should work with request groups', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          requestCount++;
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const requests = [
        { 
          id: 'critical-1',
          groupId: 'critical',
          requestOptions: { reqData: { path: '/critical' }, resReq: true } 
        },
        { 
          id: 'standard-1',
          groupId: 'standard',
          requestOptions: { reqData: { path: '/standard' }, resReq: true } 
        }
      ] satisfies API_GATEWAY_REQUEST[];

      // First batch
      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        requestGroups: [
          {
            id: 'critical',
            commonConfig: {
              commonCache: { enabled: true, ttl: 60000 }
            }
          },
          {
            id: 'standard',
            commonConfig: {
              commonCache: { enabled: false }
            }
          }
        ]
      });

      expect(requestCount).toBe(2);

      // Second batch
      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        requestGroups: [
          {
            id: 'critical',
            commonConfig: {
              commonCache: { enabled: true, ttl: 60000 }
            }
          },
          {
            id: 'standard',
            commonConfig: {
              commonCache: { enabled: false }
            }
          }
        ]
      });

      expect(requestCount).toBe(3); // critical cached, standard not cached
    });

    it('should respect group-level cache over global cache', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async () => {
          requestCount++;
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {},
            config: {} as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const requests = [
        {
          id: 'grouped-req',
          groupId: 'special',
          requestOptions: { reqData: { path: '/data' }, resReq: true }
        }
      ] satisfies API_GATEWAY_REQUEST[];

      // First call
      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: { enabled: false }, // Global: disabled
        requestGroups: [
          {
            id: 'special',
            commonConfig: {
              commonCache: { enabled: true, ttl: 60000 } // Group: enabled
            }
          }
        ]
      });

      // Second call
      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: { enabled: false },
        requestGroups: [
          {
            id: 'special',
            commonConfig: {
              commonCache: { enabled: true, ttl: 60000 }
            }
          }
        ]
      });

      expect(requestCount).toBe(1); // Group cache enabled, should cache
    });

    it('should cache responses across concurrent requests', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          requestCount++;
          await new Promise(resolve => setTimeout(resolve, 50));
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

      // First batch - concurrent
      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        commonCache: { enabled: true, ttl: 60000 }
      });

      expect(requestCount).toBe(5);

      // Second batch - should all use cache
      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: true,
        commonCache: { enabled: true, ttl: 60000 }
      });

      expect(requestCount).toBe(5); // All cached
    });

    it('should cache responses in sequential execution', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          requestCount++;
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

      // First batch - sequential
      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: false,
        commonCache: { enabled: true, ttl: 60000 }
      });

      expect(requestCount).toBe(3);

      // Second batch
      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        concurrentExecution: false,
        commonCache: { enabled: true, ttl: 60000 }
      });

      expect(requestCount).toBe(3); // All cached
    });

    it('should not block subsequent requests when one is cached', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          requestCount++;
          return {
            status: 200,
            data: { path: config.url },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      // Prime cache for req-1
      await stableApiGateway(
        [{ id: 'req-1', requestOptions: { reqData: { path: '/cached' }, resReq: true } }],
        {
          commonRequestData: { hostname: 'api.example.com' },
          commonCache: { enabled: true }
        }
      );

      expect(requestCount).toBe(1);

      // Mix cached and non-cached
      const results = await stableApiGateway(
        [
          { id: 'req-1', requestOptions: { reqData: { path: '/cached' }, resReq: true } },
          { id: 'req-2', requestOptions: { reqData: { path: '/new' }, resReq: true } }
        ],
        {
          commonRequestData: { hostname: 'api.example.com' },
          commonCache: { enabled: true }
        }
      );

      expect(requestCount).toBe(2); // Only req-2 hit API
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Workflow-level cache configuration', () => {
    it('should apply workflow-level cache to all phases', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          requestCount++;
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const phases = [
        {
          id: 'phase-1',
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ]
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      // First workflow
      await stableWorkflow(phases, {
        workflowId: 'wf-cached',
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: {
          enabled: true,
          ttl: 60000
        }
      });

      expect(requestCount).toBe(2);

      // Second workflow - should use cache
      await stableWorkflow(phases, {
        workflowId: 'wf-cached-2',
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: {
          enabled: true,
          ttl: 60000
        }
      });

      expect(requestCount).toBe(2); // No additional requests
    });

    it('should allow phase-level commonConfig cache override', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          requestCount++;
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const phases = [
        {
          id: 'phase-1-cached',
          commonConfig: {
            commonCache: { enabled: true, ttl: 60000 }
          },
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ]
        },
        {
          id: 'phase-2-not-cached',
          commonConfig: {
            commonCache: { enabled: false }
          },
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      // First workflow
      await stableWorkflow(phases, {
        workflowId: 'wf-mixed-cache',
        commonRequestData: { hostname: 'api.example.com' }
      });

      expect(requestCount).toBe(2);

      // Second workflow
      await stableWorkflow(phases, {
        workflowId: 'wf-mixed-cache-2',
        commonRequestData: { hostname: 'api.example.com' }
      });

      expect(requestCount).toBe(3); // p1 cached, p2 not cached
    });

    it('should cache across sequential workflow phases', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          requestCount++;
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
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/data' }, resReq: true } }
          ]
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/data' }, resReq: true } } // Same path
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-sequential-cache',
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: { enabled: true, ttl: 60000 }
      });

      expect(result.success).toBe(true);
      expect(requestCount).toBe(1); // Phase 2 uses cache from phase 1
    });

    it('should cache across concurrent workflow phases', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          requestCount++;
          await new Promise(resolve => setTimeout(resolve, 50));
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {},
            config: config as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const phases = [
        {
          id: 'phase-1',
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/data' }, resReq: true } }
          ]
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/data' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const result = await stableWorkflow(phases, {
        workflowId: 'wf-concurrent-cache',
        commonRequestData: { hostname: 'api.example.com' },
        concurrentPhaseExecution: true,
        commonCache: { enabled: true, ttl: 60000 }
      });

      expect(result.success).toBe(true);
      // In concurrent execution, both phases may start simultaneously
      // so both might hit API before cache is populated
      expect(requestCount).toBeGreaterThanOrEqual(1);
      expect(requestCount).toBeLessThanOrEqual(2);
    });

    it('should work with mixed phase execution mode', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          requestCount++;
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
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true } }
          ]
        },
        {
          id: 'phase-2',
          markConcurrentPhase: true,
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true } }
          ]
        },
        {
          id: 'phase-3',
          markConcurrentPhase: true,
          requests: [
            { id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true } }
          ]
        },
        {
          id: 'phase-4',
          requests: [
            { id: 'r4', requestOptions: { reqData: { path: '/p4' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      // First workflow
      await stableWorkflow(phases, {
        workflowId: 'wf-mixed-cache',
        commonRequestData: { hostname: 'api.example.com' },
        enableMixedExecution: true,
        commonCache: { enabled: true, ttl: 60000 }
      });

      expect(requestCount).toBe(4);

      // Second workflow
      await stableWorkflow(phases, {
        workflowId: 'wf-mixed-cache-2',
        commonRequestData: { hostname: 'api.example.com' },
        enableMixedExecution: true,
        commonCache: { enabled: true, ttl: 60000 }
      });

      expect(requestCount).toBe(4); // All cached
    });

    it('should handle phase failure with caching', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async (config: AxiosRequestConfig) => {
          requestCount++;
          const path = config.url || '';
          
          if (path.includes('p2')) {
            throw {
              response: { status: 500, data: 'Error' },
              message: 'Phase 2 failed'
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

      const phases = [
        {
          id: 'phase-1',
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/p1' }, resReq: true, attempts: 1 } }
          ]
        },
        {
          id: 'phase-2',
          requests: [
            { id: 'r2', requestOptions: { reqData: { path: '/p2' }, resReq: true, attempts: 1 } }
          ]
        },
        {
          id: 'phase-3',
          requests: [
            { id: 'r3', requestOptions: { reqData: { path: '/p3' }, resReq: true, attempts: 1 } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      // First workflow
      const result1 = await stableWorkflow(phases, {
        workflowId: 'wf-failure-cache',
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: { enabled: true }
      });

      expect(result1.success).toBe(false);
      expect(requestCount).toBe(3);

      // Second workflow - p1 and p3 should use cache, p2 should fail again
      const result2 = await stableWorkflow(phases, {
        workflowId: 'wf-failure-cache-2',
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: { enabled: true }
      });

      expect(result2.success).toBe(false);
      expect(requestCount).toBe(4); // Only p2 hit API again
    });

    it('should share cache between workflows', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async () => {
          requestCount++;
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {},
            config: {} as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const phases1 = [
        {
          id: 'phase-1',
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/shared' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      const phases2 = [
        {
          id: 'phase-a',
          requests: [
            { id: 'ra', requestOptions: { reqData: { path: '/shared' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      // First workflow
      await stableWorkflow(phases1, {
        workflowId: 'wf-1',
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: { enabled: true }
      });

      expect(requestCount).toBe(1);

      // Different workflow, same request
      await stableWorkflow(phases2, {
        workflowId: 'wf-2',
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: { enabled: true }
      });

      expect(requestCount).toBe(1); // Cache shared across workflows
    });
  });

  describe('Cache expiration and TTL', () => {
    it('should expire cache after TTL in stableRequest', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async () => {
          requestCount++;
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {},
            config: {} as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      // First request
      await stableRequest({
        reqData: { hostname: 'api.example.com', path: '/data' },
        resReq: true,
        cache: { enabled: true, ttl: 100 } // 100ms
      });

      expect(requestCount).toBe(1);

      // Second request immediately - should use cache
      await stableRequest({
        reqData: { hostname: 'api.example.com', path: '/data' },
        resReq: true,
        cache: { enabled: true, ttl: 100 }
      });

      expect(requestCount).toBe(1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Third request - should hit API
      await stableRequest({
        reqData: { hostname: 'api.example.com', path: '/data' },
        resReq: true,
        cache: { enabled: true, ttl: 100 }
      });

      expect(requestCount).toBe(2);
    });

    it('should expire cache after TTL in API Gateway', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async () => {
          requestCount++;
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {},
            config: {} as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const requests = [
        { id: 'req-1', requestOptions: { reqData: { path: '/data' }, resReq: true } }
      ] satisfies API_GATEWAY_REQUEST[];

      // First call
      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: { enabled: true, ttl: 100 }
      });

      expect(requestCount).toBe(1);

      // Second call immediately
      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: { enabled: true, ttl: 100 }
      });

      expect(requestCount).toBe(1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Third call
      await stableApiGateway(requests, {
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: { enabled: true, ttl: 100 }
      });

      expect(requestCount).toBe(2);
    });

    it('should expire cache after TTL in workflow', async () => {
      let requestCount = 0;

      mockedAxios.request.mockImplementation(
        (async () => {
          requestCount++;
          return {
            status: 200,
            data: { count: requestCount },
            statusText: 'OK',
            headers: {},
            config: {} as any
          };
        }) as unknown as jest.MockedFunction<typeof mockedAxios.request>
      );

      const phases = [
        {
          id: 'phase-1',
          requests: [
            { id: 'r1', requestOptions: { reqData: { path: '/data' }, resReq: true } }
          ]
        }
      ] satisfies STABLE_WORKFLOW_PHASE[];

      // First workflow
      await stableWorkflow(phases, {
        workflowId: 'wf-1',
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: { enabled: true, ttl: 100 }
      });

      expect(requestCount).toBe(1);

      // Second workflow immediately
      await stableWorkflow(phases, {
        workflowId: 'wf-2',
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: { enabled: true, ttl: 100 }
      });

      expect(requestCount).toBe(1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Third workflow
      await stableWorkflow(phases, {
        workflowId: 'wf-3',
        commonRequestData: { hostname: 'api.example.com' },
        commonCache: { enabled: true, ttl: 100 }
      });

      expect(requestCount).toBe(2);
    });
  });
});

      