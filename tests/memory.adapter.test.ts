import { Memory } from '../src/adapters/memory';

describe('Memory Adapter', () => {
  let adapter: Memory;

  beforeEach(() => {
    adapter = new Memory();
  });

  describe('Constructor', () => {
    it('should initialize with empty store', () => {
      expect(adapter).toBeInstanceOf(Memory);
      expect(adapter.getName()).toBe('memory');
    });
  });

  describe('Save and Load Operations', () => {
    it('should save and load data successfully', async () => {
      const testData = { message: 'Hello World', count: 42 };
      const saveResult = await adapter.save('test-key', testData);
      expect(saveResult).toEqual(testData);

      const loadResult = await adapter.load('test-key', 3600);
      expect(loadResult).toEqual(testData);
    });

    it('should return false for non-existent keys', async () => {
      const result = await adapter.load('non-existent', 3600);
      expect(result).toBe(false);
    });

    it('should return false for expired cache', async () => {
      const testData = { message: 'Expired data' };
      await adapter.save('expired-key', testData);

      // Mock time to simulate expiration
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 7200000); // 2 hours later

      const result = await adapter.load('expired-key', 3600); // 1 hour TTL
      expect(result).toBe(false);

      Date.now = originalNow;
    });

    it('should handle different data types', async () => {
      // String
      await adapter.save('string-key', 'Hello World');
      expect(await adapter.load('string-key', 3600)).toBe('Hello World');

      // Number
      await adapter.save('number-key', 42);
      expect(await adapter.load('number-key', 3600)).toBe(42);

      // Boolean
      await adapter.save('boolean-key', true);
      expect(await adapter.load('boolean-key', 3600)).toBe(true);

      // Array
      const arrayData = [1, 2, 3, 'test'];
      await adapter.save('array-key', arrayData);
      expect(await adapter.load('array-key', 3600)).toEqual(arrayData);

      // Object
      const objectData = { nested: { value: true, count: 5 } };
      await adapter.save('object-key', objectData);
      expect(await adapter.load('object-key', 3600)).toEqual(objectData);

      // Null
      await adapter.save('null-key', null);
      expect(await adapter.load('null-key', 3600)).toBeNull();
    });

    it('should return false when saving invalid data', async () => {
      expect(await adapter.save('', 'value')).toBe(false);
      expect(await adapter.save('key', '')).toBe(false);
      expect(await adapter.save('key', null)).toBe(false);
      expect(await adapter.save('key', undefined)).toBe(false);
    });

    it('should handle hash parameter (ignored in memory adapter)', async () => {
      const testData = { message: 'With hash' };
      const saveResult = await adapter.save('test-key', testData, 'hash123');
      expect(saveResult).toEqual(testData);

      const loadResult = await adapter.load('test-key', 3600, 'hash123');
      expect(loadResult).toEqual(testData);
    });
  });

  describe('List Operation', () => {
    it('should list keys matching prefix', async () => {
      await adapter.save('user:1', { name: 'John' });
      await adapter.save('user:2', { name: 'Jane' });
      await adapter.save('user:3', { name: 'Bob' });
      await adapter.save('product:1', { name: 'Widget' });
      await adapter.save('category:1', { name: 'Electronics' });

      const userKeys = await adapter.list('user:');
      expect(userKeys).toHaveLength(3);
      expect(userKeys).toEqual(expect.arrayContaining(['user:1', 'user:2', 'user:3']));
      expect(userKeys).not.toContain('product:1');
      expect(userKeys).not.toContain('category:1');
    });

    it('should return empty array when no keys match', async () => {
      await adapter.save('user:1', { name: 'John' });
      
      const result = await adapter.list('product:');
      expect(result).toEqual([]);
    });

    it('should return all keys when prefix is empty', async () => {
      await adapter.save('key1', 'value1');
      await adapter.save('key2', 'value2');
      
      const allKeys = await adapter.list('');
      expect(allKeys).toHaveLength(2);
      expect(allKeys).toEqual(expect.arrayContaining(['key1', 'key2']));
    });

    it('should handle partial matches', async () => {
      await adapter.save('test', 'value1');
      await adapter.save('testing', 'value2');
      await adapter.save('test:1', 'value3');
      
      const testKeys = await adapter.list('test');
      expect(testKeys).toHaveLength(3);
      expect(testKeys).toEqual(expect.arrayContaining(['test', 'testing', 'test:1']));
    });
  });

  describe('Purge Operation', () => {
    it('should purge existing key', async () => {
      await adapter.save('test-key', { message: 'Hello' });
      
      const purgeResult = await adapter.purge('test-key');
      expect(purgeResult).toBe(true);
      
      const loadResult = await adapter.load('test-key', 3600);
      expect(loadResult).toBe(false);
    });

    it('should return false when purging non-existent key', async () => {
      const result = await adapter.purge('non-existent-key');
      expect(result).toBe(false);
    });

    it('should handle empty key', async () => {
      const result = await adapter.purge('');
      expect(result).toBe(false);
    });

    it('should handle hash parameter (ignored in memory adapter)', async () => {
      await adapter.save('test-key', { message: 'Hello' });
      
      const purgeResult = await adapter.purge('test-key', 'hash123');
      expect(purgeResult).toBe(true);
      
      const loadResult = await adapter.load('test-key', 3600);
      expect(loadResult).toBe(false);
    });
  });

  describe('Flush Operation', () => {
    it('should clear all data', async () => {
      await adapter.save('key1', 'value1');
      await adapter.save('key2', 'value2');
      await adapter.save('key3', 'value3');
      
      const flushResult = await adapter.flush();
      expect(flushResult).toBe(true);
      
      expect(await adapter.load('key1', 3600)).toBe(false);
      expect(await adapter.load('key2', 3600)).toBe(false);
      expect(await adapter.load('key3', 3600)).toBe(false);
      expect(await adapter.getSize()).toBe(0);
    });

    it('should work on empty store', async () => {
      const result = await adapter.flush();
      expect(result).toBe(true);
      expect(await adapter.getSize()).toBe(0);
    });
  });

  describe('Ping Operation', () => {
    it('should always return true', async () => {
      const result = await adapter.ping();
      expect(result).toBe(true);
    });
  });

  describe('Size Operation', () => {
    it('should return correct size', async () => {
      expect(await adapter.getSize()).toBe(0);
      
      await adapter.save('key1', 'value1');
      expect(await adapter.getSize()).toBe(1);
      
      await adapter.save('key2', 'value2');
      expect(await adapter.getSize()).toBe(2);
      
      await adapter.purge('key1');
      expect(await adapter.getSize()).toBe(1);
      
      await adapter.flush();
      expect(await adapter.getSize()).toBe(0);
    });
  });

  describe('getName Operation', () => {
    it('should return adapter name', () => {
      expect(adapter.getName()).toBe('memory');
      expect(adapter.getName('any-key')).toBe('memory');
    });
  });

  describe('TTL Behavior', () => {
    it('should respect TTL when loading data', async () => {
      const testData = { message: 'TTL test' };
      await adapter.save('ttl-key', testData);

      // Should be valid immediately
      expect(await adapter.load('ttl-key', 3600)).toEqual(testData);

      // Mock time advancement (less than TTL)
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 1800000); // 30 minutes later
      
      expect(await adapter.load('ttl-key', 3600)).toEqual(testData);

      // Mock time advancement (more than TTL)
      Date.now = jest.fn(() => originalNow() + 7200000); // 2 hours later
      
      expect(await adapter.load('ttl-key', 3600)).toBe(false);

      Date.now = originalNow;
    });

    it('should handle zero TTL', async () => {
      const testData = { message: 'Zero TTL' };
      await adapter.save('zero-ttl-key', testData);

      const result = await adapter.load('zero-ttl-key', 0);
      expect(result).toBe(false);
    });

    it('should handle negative TTL', async () => {
      const testData = { message: 'Negative TTL' };
      await adapter.save('negative-ttl-key', testData);

      const result = await adapter.load('negative-ttl-key', -100);
      expect(result).toBe(false);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous operations', async () => {
      const operations: Promise<any>[] = [];
      
      // Create multiple save operations
      for (let i = 0; i < 10; i++) {
        operations.push(adapter.save(`key${i}`, `value${i}`));
      }
      
      await Promise.all(operations);
      
      // Verify all data was saved
      for (let i = 0; i < 10; i++) {
        expect(await adapter.load(`key${i}`, 3600)).toBe(`value${i}`);
      }
      
      expect(await adapter.getSize()).toBe(10);
    });

    it('should handle mixed operations', async () => {
      await adapter.save('key1', 'value1');
      await adapter.save('key2', 'value2');
      
      const operations = [
        adapter.load('key1', 3600),
        adapter.save('key3', 'value3'),
        adapter.list('key'),
        adapter.purge('key2'),
        adapter.getSize(),
      ];
      
      const results = await Promise.all(operations);
      
      expect(results[0]).toBe('value1'); // load
      expect(results[1]).toBe('value3'); // save
      expect(results[2]).toEqual(expect.arrayContaining(['key1', 'key3'])); // list
      expect(results[3]).toBe(true); // purge
      expect(results[4]).toBe(2); // size (key1 and key3)
    });
  });
});
