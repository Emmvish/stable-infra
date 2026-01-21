import { describe, it, expect } from '@jest/globals';
import { 
  delay, 
  getNewDelayTime, 
  safelyStringify,
  safelyExecuteUnknownFunction
} from '../src/utilities/index.js';
import { RETRY_STRATEGIES, RequestOrFunction } from '../src/enums/index.js';

describe('Utility Functions', () => {
  describe('delay', () => {
    it('should delay for specified milliseconds', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(95);
      expect(elapsed).toBeLessThan(200);
    });

    it('should cap delay at 4 seconds', async () => {
      const start = Date.now();
      await delay(100000, 4000); // 4 seconds
      const elapsed = Date.now() - start;
      
      // Should be capped at 4 seconds
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe('getNewDelayTime', () => {
    it('should return constant delay for FIXED strategy', () => {
      expect(getNewDelayTime(RETRY_STRATEGIES.FIXED, 1000, 1)).toBe(1000);
      expect(getNewDelayTime(RETRY_STRATEGIES.FIXED, 1000, 2)).toBe(1000);
      expect(getNewDelayTime(RETRY_STRATEGIES.FIXED, 1000, 5)).toBe(1000);
    });

    it('should return linearly increasing delay for LINEAR strategy', () => {
      expect(getNewDelayTime(RETRY_STRATEGIES.LINEAR, 1000, 1)).toBe(1000);
      expect(getNewDelayTime(RETRY_STRATEGIES.LINEAR, 1000, 2)).toBe(2000);
      expect(getNewDelayTime(RETRY_STRATEGIES.LINEAR, 1000, 3)).toBe(3000);
    });

    it('should return exponentially increasing delay for EXPONENTIAL strategy', () => {
      expect(getNewDelayTime(RETRY_STRATEGIES.EXPONENTIAL, 1000, 1)).toBe(1000);
      expect(getNewDelayTime(RETRY_STRATEGIES.EXPONENTIAL, 1000, 2)).toBe(2000);
      expect(getNewDelayTime(RETRY_STRATEGIES.EXPONENTIAL, 1000, 3)).toBe(4000);
      expect(getNewDelayTime(RETRY_STRATEGIES.EXPONENTIAL, 1000, 4)).toBe(8000);
    });

    it('should use base delay as default for unknown strategy', () => {
      expect(getNewDelayTime('unknown' as any, 1000, 1)).toBe(1000);
    });
  });

  describe('safelyStringify', () => {
    it('should stringify simple objects', () => {
      const obj = { name: 'test', value: 123 };
      const result = safelyStringify(obj);
      
      expect(result).toBe('{"name":"test","value":123}');
    });

    it('should truncate long strings with maxLength', () => {
      const longObj = { data: 'a'.repeat(2000) };
      const result = safelyStringify(longObj, 100);
      
      expect(result.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(result).toContain('...');
    });

    it('should handle circular references gracefully', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;
      
      const result = safelyStringify(circular);
      
      expect(result).toBe('[Unserializable data]');
    });

    it('should use default maxLength of 1000 when negative value provided', () => {
      const obj = { data: 'a'.repeat(2000) };
      const result = safelyStringify(obj, -100);
      
      expect(result.length).toBeLessThanOrEqual(1003);
    });
  });

  describe('safelyExecuteUnknownFunction', () => {
    it('should execute synchronous functions', async () => {
      const syncFn = (a: number, b: number) => a + b;
      const result = await safelyExecuteUnknownFunction(syncFn, 5, 3);
      
      expect(result).toBe(8);
    });

    it('should execute async functions', async () => {
      const asyncFn = async (a: number, b: number) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return a * b;
      };
      
      const result = await safelyExecuteUnknownFunction(asyncFn, 5, 3);
      
      expect(result).toBe(15);
    });

    it('should handle functions that throw errors', async () => {
      const throwingFn = () => {
        throw new Error('Test error');
      };
      
      await expect(
        safelyExecuteUnknownFunction(throwingFn)
      ).rejects.toThrow('Test error');
    });
  });
});