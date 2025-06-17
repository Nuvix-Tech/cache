import { Redis } from '../src/adapters/redis';
import { type RedisClientType } from 'redis';
import { getRedisClient } from './setup';

describe('Redis Adapter', () => {
  let adapter: Redis;
  let redisClient: RedisClientType;

  beforeAll(async () => {
    try {
      redisClient = await getRedisClient();
      adapter = new Redis(redisClient);
    } catch (error) {
      console.warn('Redis not available, skipping Redis adapter tests');
    }
  });

  beforeEach(async () => {
    if (redisClient) {
      // Clean the test database before each test
      await redisClient.flushDb();
    }
  });

  // Helper function to skip tests if Redis is not available
  const skipIfNoRedis = () => {
    // if (!redisClient || !adapter) {
    //   return test.skip;
    // }
    return test;
  };

  describe('Constructor', () => {
    skipIfNoRedis()('should initialize with Redis client', () => {
      expect(adapter).toBeInstanceOf(Redis);
      expect(adapter.getName()).toBe('redis');
    });
  });

  describe('Save Operation', () => {
    skipIfNoRedis()('should save data successfully', async () => {
      const testData = { message: 'Hello World', count: 42 };
      
      const result = await adapter.save('test-key', testData);
      
      expect(result).toEqual(testData);
      
      // Verify data was actually saved in Redis
      const savedData = await redisClient.hGet('test-key', 'test-key');
      expect(savedData).toBeTruthy();
      
      const parsed = JSON.parse(savedData!);
      expect(parsed.data).toEqual(testData);
      expect(parsed.time).toBeCloseTo(Math.floor(Date.now() / 1000), 1);
    });

    skipIfNoRedis()('should save with custom hash', async () => {
      const testData = { message: 'With hash' };
      
      const result = await adapter.save('test-key', testData, 'custom-hash');
      
      expect(result).toEqual(testData);
      
      // Verify data was saved with custom hash
      const savedData = await redisClient.hGet('test-key', 'custom-hash');
      expect(savedData).toBeTruthy();
      
      const parsed = JSON.parse(savedData!);
      expect(parsed.data).toEqual(testData);
    });

    skipIfNoRedis()('should include timestamp in saved data', async () => {
      const testData = { message: 'Timestamped' };
      const beforeSave = Math.floor(Date.now() / 1000);
      
      await adapter.save('test-key', testData);
      
      const savedData = await redisClient.hGet('test-key', 'test-key');
      const parsed = JSON.parse(savedData!);
      
      expect(parsed.time).toBeGreaterThanOrEqual(beforeSave);
      expect(parsed.time).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
      expect(parsed.data).toEqual(testData);
    });

    skipIfNoRedis()('should return false for invalid inputs', async () => {
      expect(await adapter.save('', 'value')).toBe(false);
      expect(await adapter.save('key', '')).toBe(false);
      expect(await adapter.save('key', null)).toBe(false);
      expect(await adapter.save('key', undefined)).toBe(false);
    });

    skipIfNoRedis()('should save different data types', async () => {
      // Object
      const objectData = { name: 'John', age: 30 };
      expect(await adapter.save('object-key', objectData)).toEqual(objectData);

      // Array
      const arrayData = [1, 2, 3, 'test'];
      expect(await adapter.save('array-key', arrayData)).toEqual(arrayData);

      // String
      expect(await adapter.save('string-key', 'Hello')).toBe('Hello');

      // Number
      expect(await adapter.save('number-key', 42)).toBe(42);

      // Boolean
      expect(await adapter.save('boolean-key', true)).toBe(true);
    });
  });

  describe('Load Operation', () => {
    skipIfNoRedis()('should load valid cached data', async () => {
      const testData = { message: 'Cached data' };
      
      // First save the data
      await adapter.save('test-key', testData);

      const result = await adapter.load('test-key', 3600);
      expect(result).toEqual(testData);
    });

    skipIfNoRedis()('should load with custom hash', async () => {
      const testData = { message: 'Custom hash data' };
      
      // First save the data with custom hash
      await adapter.save('test-key', testData, 'custom-hash');

      const result = await adapter.load('test-key', 3600, 'custom-hash');
      expect(result).toEqual(testData);
    });

    skipIfNoRedis()('should return false for expired data', async () => {
      const expiredCacheEntry = {
        time: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        data: { message: 'Expired data' }
      };
      
      // Manually insert expired data
      await redisClient.hSet('test-key', 'test-key', JSON.stringify(expiredCacheEntry));

      const result = await adapter.load('test-key', 3600); // 1 hour TTL
      expect(result).toBe(false);
    });

    skipIfNoRedis()('should return false for non-existent data', async () => {
      const result = await adapter.load('non-existent', 3600);
      expect(result).toBe(false);
    });

    skipIfNoRedis()('should handle invalid JSON gracefully', async () => {
      // Insert invalid JSON
      await redisClient.hSet('test-key', 'test-key', 'invalid-json{');

      const result = await adapter.load('test-key', 3600);
      expect(result).toBe(false);
    });

    skipIfNoRedis()('should respect TTL correctly', async () => {
      const baseTime = Math.floor(Date.now() / 1000);
      
      // Fresh data (within TTL)
      const freshCacheEntry = {
        time: baseTime - 1800, // 30 minutes ago
        data: { message: 'Fresh data' }
      };
      
      await redisClient.hSet('fresh-key', 'fresh-key', JSON.stringify(freshCacheEntry));

      const freshResult = await adapter.load('fresh-key', 3600); // 1 hour TTL
      expect(freshResult).toEqual({ message: 'Fresh data' });

      // Expired data (outside TTL)
      const expiredCacheEntry = {
        time: baseTime - 7200, // 2 hours ago
        data: { message: 'Expired data' }
      };
      
      await redisClient.hSet('expired-key', 'expired-key', JSON.stringify(expiredCacheEntry));

      const expiredResult = await adapter.load('expired-key', 3600); // 1 hour TTL
      expect(expiredResult).toBe(false);
    });
  });

  describe('List Operation', () => {
    skipIfNoRedis()('should return list of hash keys', async () => {
      // Create some hash entries
      await redisClient.hSet('test-key', 'hash1', JSON.stringify({ data: 'value1', time: Date.now() }));
      await redisClient.hSet('test-key', 'hash2', JSON.stringify({ data: 'value2', time: Date.now() }));
      await redisClient.hSet('test-key', 'hash3', JSON.stringify({ data: 'value3', time: Date.now() }));

      const result = await adapter.list('test-key');
      expect(result).toEqual(expect.arrayContaining(['hash1', 'hash2', 'hash3']));
      expect(result).toHaveLength(3);
    });

    skipIfNoRedis()('should return empty array when no keys exist', async () => {
      const result = await adapter.list('empty-key');
      expect(result).toEqual([]);
    });
  });

  describe('Purge Operation', () => {
    skipIfNoRedis()('should purge specific hash', async () => {
      // Create hash entry
      await redisClient.hSet('test-key', 'hash123', JSON.stringify({ data: 'value', time: Date.now() }));

      const result = await adapter.purge('test-key', 'hash123');
      expect(result).toBe(true);
      
      // Verify it was deleted
      const remaining = await redisClient.hGet('test-key', 'hash123');
      expect(remaining).toBeNull();
    });

    skipIfNoRedis()('should purge entire key when no hash specified', async () => {
      // Create some data
      await redisClient.hSet('test-key', 'hash1', JSON.stringify({ data: 'value1', time: Date.now() }));
      await redisClient.hSet('test-key', 'hash2', JSON.stringify({ data: 'value2', time: Date.now() }));

      const result = await adapter.purge('test-key');
      expect(result).toBe(true);
      
      // Verify key was deleted
      const exists = await redisClient.exists('test-key');
      expect(exists).toBe(0);
    });

    skipIfNoRedis()('should return false when nothing was deleted', async () => {
      const result = await adapter.purge('test-key', 'non-existent-hash');
      expect(result).toBe(false);
    });
  });

  describe('Flush Operation', () => {
    skipIfNoRedis()('should flush all data successfully', async () => {
      // Add some test data
      await redisClient.set('test1', 'value1');
      await redisClient.set('test2', 'value2');

      const result = await adapter.flush();
      expect(result).toBe(true);
      
      // Verify data was flushed
      const size = await redisClient.dbSize();
      expect(size).toBe(0);
    });
  });

  describe('Ping Operation', () => {
    skipIfNoRedis()('should return true for successful ping', async () => {
      const result = await adapter.ping();
      expect(result).toBe(true);
    });
  });

  describe('Size Operation', () => {
    skipIfNoRedis()('should return database size', async () => {
      // Add some test data
      await redisClient.set('test1', 'value1');
      await redisClient.set('test2', 'value2');

      const result = await adapter.getSize();
      expect(result).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getName Operation', () => {
    skipIfNoRedis()('should return adapter name', () => {
      expect(adapter.getName()).toBe('redis');
      expect(adapter.getName('any-key')).toBe('redis');
    });
  });

  describe('Integration Scenarios', () => {
    skipIfNoRedis()('should handle complete cache lifecycle', async () => {
      const testData = { user: 'john', role: 'admin' };
      
      // Save data
      const saveResult = await adapter.save('user:123', testData);
      expect(saveResult).toEqual(testData);
      
      // Load data
      const loadResult = await adapter.load('user:123', 3600);
      expect(loadResult).toEqual(testData);
      
      // List keys
      const listResult = await adapter.list('user:123');
      expect(listResult).toContain('user:123');
      
      // Purge data
      const purgeResult = await adapter.purge('user:123');
      expect(purgeResult).toBe(true);
      
      // Verify data is gone
      const loadAfterPurge = await adapter.load('user:123', 3600);
      expect(loadAfterPurge).toBe(false);
    });

    skipIfNoRedis()('should handle hash-based operations', async () => {
      const userData = { name: 'John', age: 30 };
      const sessionData = { token: 'abc123', expires: Date.now() + 3600000 };
      
      // Save multiple hash entries under same key
      await adapter.save('user:123', userData, 'profile');
      await adapter.save('user:123', sessionData, 'session');
      
      // Load specific hashes
      const profileResult = await adapter.load('user:123', 3600, 'profile');
      const sessionResult = await adapter.load('user:123', 3600, 'session');
      
      expect(profileResult).toEqual(userData);
      expect(sessionResult).toEqual(sessionData);
      
      // List all hashes
      const hashes = await adapter.list('user:123');
      expect(hashes).toContain('profile');
      expect(hashes).toContain('session');
      
      // Purge specific hash
      const purgeResult = await adapter.purge('user:123', 'session');
      expect(purgeResult).toBe(true);
      
      // Verify selective deletion
      const profileAfterPurge = await adapter.load('user:123', 3600, 'profile');
      const sessionAfterPurge = await adapter.load('user:123', 3600, 'session');
      
      expect(profileAfterPurge).toEqual(userData);
      expect(sessionAfterPurge).toBe(false);
    });
  });
});
