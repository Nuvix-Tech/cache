import { Cache } from '../src/cache';
import { Memory } from '../src/adapters/memory';
import { None } from '../src/adapters/none';

// Mock telemetry
const mockTelemetry = {
  createHistogram: jest.fn().mockReturnValue({
    record: jest.fn(),
  }),
};

describe('Cache', () => {
  let cache: Cache;
  let memoryAdapter: Memory;

  beforeEach(() => {
    memoryAdapter = new Memory();
    cache = new Cache(memoryAdapter);
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with provided adapter', () => {
      expect(cache).toBeInstanceOf(Cache);
      expect(cache.caseSensitive).toBe(false);
    });

    it('should set case sensitivity', () => {
      expect(cache.setCaseSensitivity(true)).toBe(true);
      expect(cache.caseSensitive).toBe(true);
      
      expect(cache.setCaseSensitivity(false)).toBe(false);
      expect(cache.caseSensitive).toBe(false);
    });

    it('should set telemetry adapter', () => {
      cache.setTelemetry(mockTelemetry as any);
      // Verify telemetry was set by checking if histogram was created
      expect(mockTelemetry.createHistogram).toHaveBeenCalledWith(
        'cache.operation.duration',
        's',
        null,
        expect.any(Object)
      );
    });
  });

  describe('Load Operation', () => {
    it('should load data when cache is valid', async () => {
      const testData = { message: 'Hello World' };
      await cache.save('test-key', testData);
      
      const result = await cache.load('test-key', 3600); // 1 hour TTL
      expect(result).toEqual(testData);
    });

    it('should return false when cache is expired', async () => {
      const testData = { message: 'Hello World' };
      await cache.save('test-key', testData);
      
      // Mock past timestamp to simulate expired cache
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 7200000); // 2 hours later
      
      const result = await cache.load('test-key', 3600); // 1 hour TTL
      expect(result).toBe(false);
      
      jest.restoreAllMocks();
    });

    it('should return false when key does not exist', async () => {
      const result = await cache.load('non-existent-key', 3600);
      expect(result).toBe(false);
    });

    it('should handle case insensitivity for keys', async () => {
      const testData = { message: 'Hello World' };
      cache.setCaseSensitivity(false);
      
      await cache.save('TEST-KEY', testData);
      const result = await cache.load('test-key', 3600);
      expect(result).toEqual(testData);
    });

    it('should handle case sensitivity for keys', async () => {
      const testData = { message: 'Hello World' };
      cache.setCaseSensitivity(true);
      
      await cache.save('TEST-KEY', testData);
      const result = await cache.load('test-key', 3600);
      expect(result).toBe(false);
    });

    it('should handle hash parameter', async () => {
      const testData = { message: 'Hello World' };
      await cache.save('test-key', testData, 'hash123');
      
      const result = await cache.load('test-key', 3600, 'hash123');
      expect(result).toEqual(testData);
    });
  });

  describe('Save Operation', () => {
    it('should save data successfully', async () => {
      const testData = { message: 'Hello World', count: 42 };
      const result = await cache.save('test-key', testData);
      expect(result).toEqual(testData);
    });

    it('should save with hash parameter', async () => {
      const testData = { message: 'Hello World' };
      const result = await cache.save('test-key', testData, 'hash123');
      expect(result).toEqual(testData);
    });

    it('should handle case insensitivity for save operation', async () => {
      cache.setCaseSensitivity(false);
      const testData = { message: 'Hello World' };
      
      await cache.save('TEST-KEY', testData);
      const result = await cache.load('test-key', 3600);
      expect(result).toEqual(testData);
    });

    it('should save different data types', async () => {
      // String
      await cache.save('string-key', 'Hello World');
      expect(await cache.load('string-key', 3600)).toBe('Hello World');

      // Number
      await cache.save('number-key', 42);
      expect(await cache.load('number-key', 3600)).toBe(42);

      // Array
      const arrayData = [1, 2, 3, 'test'];
      await cache.save('array-key', arrayData);
      expect(await cache.load('array-key', 3600)).toEqual(arrayData);

      // Object
      const objectData = { nested: { value: true } };
      await cache.save('object-key', objectData);
      expect(await cache.load('object-key', 3600)).toEqual(objectData);
    });
  });

  describe('List Operation', () => {
    it('should list keys matching pattern', async () => {
      await cache.save('user:1', { name: 'John' });
      await cache.save('user:2', { name: 'Jane' });
      await cache.save('product:1', { name: 'Widget' });
      
      const userKeys = await cache.list('user:');
      expect(userKeys).toEqual(expect.arrayContaining(['user:1', 'user:2']));
      expect(userKeys).not.toContain('product:1');
    });

    it('should return empty array when no keys match', async () => {
      const result = await cache.list('non-existent:');
      expect(result).toEqual([]);
    });

    it('should handle case insensitivity for list operation', async () => {
      cache.setCaseSensitivity(false);
      await cache.save('USER:1', { name: 'John' });
      
      const result = await cache.list('user:');
      expect(result).toContain('user:1');
    });
  });

  describe('Purge Operation', () => {
    it('should purge existing key', async () => {
      await cache.save('test-key', { message: 'Hello' });
      
      const purgeResult = await cache.purge('test-key');
      expect(purgeResult).toBe(true);
      
      const loadResult = await cache.load('test-key', 3600);
      expect(loadResult).toBe(false);
    });

    it('should return false when purging non-existent key', async () => {
      const result = await cache.purge('non-existent-key');
      expect(result).toBe(false);
    });

    it('should handle hash parameter in purge', async () => {
      await cache.save('test-key', { message: 'Hello' }, 'hash123');
      
      const purgeResult = await cache.purge('test-key', 'hash123');
      expect(purgeResult).toBe(true);
    });

    it('should handle case insensitivity for purge operation', async () => {
      cache.setCaseSensitivity(false);
      await cache.save('TEST-KEY', { message: 'Hello' });
      
      const result = await cache.purge('test-key');
      expect(result).toBe(true);
    });
  });

  describe('Flush Operation', () => {
    it('should flush all cache data', async () => {
      await cache.save('key1', 'value1');
      await cache.save('key2', 'value2');
      await cache.save('key3', 'value3');
      
      const flushResult = await cache.flush();
      expect(flushResult).toBe(true);
      
      // Verify all data is gone
      expect(await cache.load('key1', 3600)).toBe(false);
      expect(await cache.load('key2', 3600)).toBe(false);
      expect(await cache.load('key3', 3600)).toBe(false);
    });
  });

  describe('Ping Operation', () => {
    it('should return true for healthy connection', async () => {
      const result = await cache.ping();
      expect(result).toBe(true);
    });
  });

  describe('Size Operation', () => {
    it('should return correct cache size', async () => {
      const initialSize = await cache.getSize();
      
      await cache.save('key1', 'value1');
      await cache.save('key2', 'value2');
      
      const newSize = await cache.getSize();
      expect(newSize).toBe(initialSize + 2);
    });

    it('should return 0 after flush', async () => {
      await cache.save('key1', 'value1');
      await cache.flush();
      
      const size = await cache.getSize();
      expect(size).toBe(0);
    });
  });

  describe('Telemetry Integration', () => {
    it('should record metrics for operations when telemetry is set', async () => {
      const mockHistogram = {
        record: jest.fn(),
      };
      const mockTelemetryAdapter = {
        createHistogram: jest.fn().mockReturnValue(mockHistogram),
      };

      cache.setTelemetry(mockTelemetryAdapter as any);
      
      await cache.save('test-key', 'test-value');
      await cache.load('test-key', 3600);
      
      expect(mockHistogram.record).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          operation: 'save',
          adapter: 'memory'
        })
      );
      
      expect(mockHistogram.record).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          operation: 'load',
          adapter: 'memory'
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter errors gracefully', async () => {
      // Create a mock adapter that throws errors
      const errorAdapter = {
        load: jest.fn().mockRejectedValue(new Error('Load error')),
        save: jest.fn().mockRejectedValue(new Error('Save error')),
        list: jest.fn().mockRejectedValue(new Error('List error')),
        purge: jest.fn().mockRejectedValue(new Error('Purge error')),
        flush: jest.fn().mockRejectedValue(new Error('Flush error')),
        ping: jest.fn().mockRejectedValue(new Error('Ping error')),
        getSize: jest.fn().mockRejectedValue(new Error('Size error')),
        getName: jest.fn().mockReturnValue('error-adapter'),
      };
      
      const errorCache = new Cache(errorAdapter as any);
      
      // These should not throw, but handle errors gracefully
      await expect(errorCache.load('key', 3600)).rejects.toThrow('Load error');
      await expect(errorCache.save('key', 'value')).rejects.toThrow('Save error');
      await expect(errorCache.list('key')).rejects.toThrow('List error');
      await expect(errorCache.purge('key')).rejects.toThrow('Purge error');
      await expect(errorCache.flush()).rejects.toThrow('Flush error');
      await expect(errorCache.ping()).rejects.toThrow('Ping error');
      await expect(errorCache.getSize()).rejects.toThrow('Size error');
    });
  });

  describe('Integration with Different Adapters', () => {
    it('should work with None adapter', async () => {
      const noneAdapter = new None();
      const noneCache = new Cache(noneAdapter);
      
      // None adapter always returns false/empty
      expect(await noneCache.save('key', 'value')).toBe(false);
      expect(await noneCache.load('key', 3600)).toBe(false);
      expect(await noneCache.list('key')).toEqual([]);
      expect(await noneCache.purge('key')).toBe(true);
      expect(await noneCache.flush()).toBe(true);
      expect(await noneCache.ping()).toBe(true);
      expect(await noneCache.getSize()).toBe(0);
    });
  });
});
