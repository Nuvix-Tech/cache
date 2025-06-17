import { Redis } from "../src/adapters/redis";
import IORedis from "ioredis";
import { CacheOptions } from "../src/interfaces/adapter";

describe("Enhanced Redis Adapter", () => {
  let adapter: Redis;
  let redisClient: IORedis;

  beforeAll(async () => {
    try {
      redisClient = new IORedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });
      
      await redisClient.connect();
      
      adapter = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        namespace: 'test',
        defaultTTL: 3600,
        enableCompression: true,
        compressionThreshold: 100,
        keyPrefix: 'test:',
        tagPrefix: 'tag:',
        metadataPrefix: 'meta:'
      });
    } catch (error) {
      console.warn("Redis not available, skipping enhanced Redis adapter tests", error);
    }
  });

  beforeEach(async () => {
    if (redisClient?.status === 'ready') {
      await redisClient.flushdb();
    }
  });

  afterAll(async () => {
    if (redisClient?.status === 'ready') {
      await redisClient.quit();
    }
  });

  const skipIfNoRedis = () => {
    if (!redisClient || redisClient.status !== 'ready') {
      return test.skip;
    }
    return test;
  };

  describe("Constructor and Configuration", () => {
    skipIfNoRedis()("should initialize with options", () => {
      expect(adapter).toBeInstanceOf(Redis);
      expect(adapter.getNamespace()).toBe('test');
    });

    skipIfNoRedis()("should set and get namespace", () => {
      adapter.setNamespace('newnamespace');
      expect(adapter.getNamespace()).toBe('newnamespace');
      adapter.setNamespace('test'); // Reset for other tests
    });
  });

  describe("Enhanced Set/Get Operations", () => {
    skipIfNoRedis()("should set and get simple data", async () => {
      const testData = { name: 'John', age: 30 };
      
      const setResult = await adapter.set('user:123', testData);
      expect(setResult).toBe(true);

      const getData = await adapter.get('user:123');
      expect(getData).toEqual(testData);
    });

    skipIfNoRedis()("should handle TTL correctly", async () => {
      const testData = { temp: 'data' };
      
      await adapter.set('temp:key', testData, { ttl: 1 });
      
      let data = await adapter.get('temp:key');
      expect(data).toEqual(testData);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      data = await adapter.get('temp:key');
      expect(data).toBeNull();
    });

    skipIfNoRedis()("should handle compression for large data", async () => {
      const largeData = { 
        content: 'x'.repeat(200), // Larger than compressionThreshold
        metadata: { size: 'large' }
      };
      
      const setResult = await adapter.set('large:key', largeData, { compression: true });
      expect(setResult).toBe(true);

      const getData = await adapter.get('large:key');
      expect(getData).toEqual(largeData);
    });

    skipIfNoRedis()("should handle metadata", async () => {
      const testData = { value: 'test' };
      const metadata = { source: 'test', version: 1 };
      
      await adapter.set('meta:key', testData, { metadata });
      
      const result = await adapter.get('meta:key', { includeMetadata: true });
      expect(result).toMatchObject({
        data: testData,
        metadata,
        createdAt: expect.any(Number)
      });
    });
  });

  describe("Namespace Operations", () => {
    skipIfNoRedis()("should isolate data by namespace", async () => {
      const options1: CacheOptions = { namespace: 'namespace1' };
      const options2: CacheOptions = { namespace: 'namespace2' };
      
      await adapter.set('same-key', { data: 'namespace1' }, options1);
      await adapter.set('same-key', { data: 'namespace2' }, options2);
      
      const data1 = await adapter.get('same-key', options1);
      const data2 = await adapter.get('same-key', options2);
      
      expect(data1).toEqual({ data: 'namespace1' });
      expect(data2).toEqual({ data: 'namespace2' });
    });

    skipIfNoRedis()("should flush namespace", async () => {
      const options: CacheOptions = { namespace: 'flushtest' };
      
      await adapter.set('key1', 'value1', options);
      await adapter.set('key2', 'value2', options);
      await adapter.set('key3', 'value3', { namespace: 'other' });
      
      const flushed = await adapter.flushNamespace('flushtest');
      expect(flushed).toBe(true);
      
      expect(await adapter.get('key1', options)).toBeNull();
      expect(await adapter.get('key2', options)).toBeNull();
      expect(await adapter.get('key3', { namespace: 'other' })).toBe('value3');
    });

    skipIfNoRedis()("should get keys by namespace", async () => {
      const options: CacheOptions = { namespace: 'keytest' };
      
      await adapter.set('user:1', 'data1', options);
      await adapter.set('user:2', 'data2', options);
      await adapter.set('product:1', 'data3', options);
      
      const allKeys = await adapter.getKeysByNamespace('keytest');
      expect(allKeys.length).toBe(3);
      
      const userKeys = await adapter.getKeysByNamespace('keytest', 'user:*');
      expect(userKeys.length).toBe(2);
    });
  });

  describe("Tag Operations", () => {
    skipIfNoRedis()("should handle tags", async () => {
      await adapter.set('user:1', { name: 'John' }, { tags: ['users', 'active'] });
      await adapter.set('user:2', { name: 'Jane' }, { tags: ['users', 'premium'] });
      await adapter.set('product:1', { name: 'Widget' }, { tags: ['products'] });
      
      const userKeys = await adapter.getKeysByTags(['users']);
      expect(userKeys.length).toBe(2);
      
      const activeKeys = await adapter.getKeysByTags(['active']);
      expect(activeKeys.length).toBe(1);
    });

    skipIfNoRedis()("should flush by tags", async () => {
      await adapter.set('user:1', { name: 'John' }, { tags: ['users', 'test'] });
      await adapter.set('user:2', { name: 'Jane' }, { tags: ['users', 'test'] });
      await adapter.set('admin:1', { name: 'Admin' }, { tags: ['admin'] });
      
      const flushed = await adapter.flushByTags(['test']);
      expect(flushed).toBe(true);
      
      expect(await adapter.get('user:1')).toBeNull();
      expect(await adapter.get('user:2')).toBeNull();
      expect(await adapter.get('admin:1')).toEqual({ name: 'Admin' });
    });
  });

  describe("Batch Operations", () => {
    skipIfNoRedis()("should handle mget/mset", async () => {
      const entries = {
        'batch:1': { id: 1, name: 'First' },
        'batch:2': { id: 2, name: 'Second' },
        'batch:3': { id: 3, name: 'Third' }
      };
      
      const setResult = await adapter.mset(entries, { ttl: 3600 });
      expect(setResult).toBe(true);
      
      const keys = Object.keys(entries);
      const values = await adapter.mget(keys);
      
      expect(values).toHaveLength(3);
      expect(values[0]).toEqual({ id: 1, name: 'First' });
      expect(values[1]).toEqual({ id: 2, name: 'Second' });
      expect(values[2]).toEqual({ id: 3, name: 'Third' });
    });

    skipIfNoRedis()("should handle mdel", async () => {
      await adapter.set('del:1', 'value1');
      await adapter.set('del:2', 'value2');
      await adapter.set('del:3', 'value3');
      
      const deletedCount = await adapter.mdel(['del:1', 'del:2']);
      expect(deletedCount).toBe(2);
      
      expect(await adapter.get('del:1')).toBeNull();
      expect(await adapter.get('del:2')).toBeNull();
      expect(await adapter.get('del:3')).toBe('value3');
    });
  });

  describe("Utility Operations", () => {
    skipIfNoRedis()("should check existence", async () => {
      await adapter.set('exists:key', 'value');
      
      expect(await adapter.exists('exists:key')).toBe(true);
      expect(await adapter.exists('nonexistent:key')).toBe(false);
    });

    skipIfNoRedis()("should handle TTL operations", async () => {
      await adapter.set('ttl:key', 'value', { ttl: 3600 });
      
      const ttl = await adapter.ttl('ttl:key');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(3600);
      
      const expireResult = await adapter.expire('ttl:key', 7200);
      expect(expireResult).toBe(true);
      
      const newTtl = await adapter.ttl('ttl:key');
      expect(newTtl).toBeGreaterThan(3600);
    });

    skipIfNoRedis()("should handle atomic operations", async () => {
      await adapter.set('counter', 0);
      
      const incResult = await adapter.increment('counter', 5);
      expect(incResult).toBe(5);
      
      const decResult = await adapter.decrement('counter', 2);
      expect(decResult).toBe(3);
      
      const finalValue = await adapter.get('counter');
      expect(finalValue).toBe(3);
    });
  });

  describe("Statistics", () => {
    skipIfNoRedis()("should return stats", async () => {
      await adapter.set('stats:1', 'value1');
      await adapter.set('stats:2', 'value2');
      await adapter.get('stats:1'); // hit
      await adapter.get('nonexistent'); // miss
      
      const stats = await adapter.getStats();
      expect(stats).toMatchObject({
        hits: expect.any(Number),
        misses: expect.any(Number),
        sets: expect.any(Number),
        deletes: expect.any(Number),
        errors: expect.any(Number),
        keyCount: expect.any(Number)
      });
      
      expect(stats.keyCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Pipeline Operations", () => {
    skipIfNoRedis()("should handle pipeline operations", async () => {
      const pipeline = adapter.pipeline();
      
      pipeline
        .set('pipe:1', 'value1', { ttl: 300 })
        .set('pipe:2', 'value2', { ttl: 600 })
        .get('pipe:1')
        .del('nonexistent');
      
      const results = await pipeline.exec();
      expect(results).toHaveLength(4);
      
      // Verify data was set
      expect(await adapter.get('pipe:1')).toBe('value1');
      expect(await adapter.get('pipe:2')).toBe('value2');
    });
  });

  describe("Legacy Compatibility", () => {
    skipIfNoRedis()("should support legacy load/save methods", async () => {
      const testData = { legacy: 'data' };
      
      const saveResult = await adapter.save('legacy:key', testData);
      expect(saveResult).toBe(true);
      
      const loadResult = await adapter.load('legacy:key', 3600);
      expect(loadResult).toEqual(testData);
    });

    skipIfNoRedis()("should support hash operations", async () => {
      const testData = { hash: 'value' };
      
      await adapter.save('hash:key', testData, 'field1');
      await adapter.save('hash:key', { other: 'data' }, 'field2');
      
      const data1 = await adapter.load('hash:key', 3600, 'field1');
      const data2 = await adapter.load('hash:key', 3600, 'field2');
      
      expect(data1).toEqual(testData);
      expect(data2).toEqual({ other: 'data' });
      
      const fields = await adapter.list('hash:key');
      expect(fields).toContain('field1');
      expect(fields).toContain('field2');
    });
  });

  describe("Error Handling", () => {
    skipIfNoRedis()("should handle compression errors gracefully", async () => {
      // Test with circular reference which will fail JSON.stringify
      const circularData: any = { name: 'test' };
      circularData.self = circularData;
      
      await expect(adapter.set('circular', circularData)).resolves.toBe(false);
    });

    skipIfNoRedis()("should handle key length limits", async () => {
      const longKey = 'x'.repeat(300); // Exceeds maxKeyLength
      
      await expect(adapter.set(longKey, 'value')).rejects.toThrow();
    });

    skipIfNoRedis()("should handle value size limits", async () => {
      const largeValue = 'x'.repeat(600 * 1024); // Exceeds maxValueSize
      
      await expect(adapter.set('large', largeValue)).rejects.toThrow();
    });
  });
});
