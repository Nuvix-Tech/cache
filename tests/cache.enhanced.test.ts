import { Cache } from "../src/cache";
import { Redis } from "../src/adapters/redis";
import { Memory } from "../src/adapters/memory";
import IORedis from "ioredis";
import { CacheOptions } from "../src/interfaces/adapter";

// Mock telemetry
const mockTelemetry = {
  createHistogram: jest.fn().mockReturnValue({
    record: jest.fn(),
  }),
};

describe("Enhanced Cache", () => {
  let cache: Cache;
  let memoryAdapter: Memory;
  let redisAdapter: Redis;
  let redisClient: IORedis;

  beforeAll(async () => {
    try {
      redisClient = new IORedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        lazyConnect: true
      });
      await redisClient.connect();
      
      redisAdapter = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        namespace: 'test-cache',
        defaultTTL: 3600,
        enableCompression: true
      });
    } catch (error) {
      console.warn("Redis not available for enhanced cache tests");
    }
  });

  beforeEach(async () => {
    memoryAdapter = new Memory();
    if (redisClient?.status === 'ready') {
      await redisClient.flushdb();
    }
  });

  afterAll(async () => {
    if (redisClient?.status === 'ready') {
      await redisClient.quit();
    }
  });

  describe("Constructor and Configuration", () => {
    it("should initialize with memory adapter", () => {
      cache = new Cache(memoryAdapter);
      expect(cache).toBeInstanceOf(Cache);
      expect(cache.caseSensitive).toBe(false);
      expect(cache.getDefaultNamespace()).toBe('default');
    });

    it("should initialize with enhanced Redis adapter", () => {
      if (!redisAdapter) {
        return test.skip("Redis not available");
      }
      
      cache = new Cache(redisAdapter);
      expect(cache).toBeInstanceOf(Cache);
    });

    it("should set and get default namespace", () => {
      cache = new Cache(memoryAdapter);
      cache.setDefaultNamespace('myapp');
      expect(cache.getDefaultNamespace()).toBe('myapp');
    });

    it("should set telemetry", () => {
      cache = new Cache(memoryAdapter);
      cache.setTelemetry(mockTelemetry as any);
      expect(mockTelemetry.createHistogram).toHaveBeenCalled();
    });
  });

  describe("Enhanced API with Memory Adapter", () => {
    beforeEach(() => {
      cache = new Cache(memoryAdapter);
    });

    it("should throw error for enhanced methods with basic adapter", async () => {
      await expect(cache.set('key', 'value')).rejects.toThrow('Enhanced methods require an EnhancedAdapter');
      await expect(cache.get('key')).rejects.toThrow('Enhanced methods require an EnhancedAdapter');
      await expect(cache.mget(['key'])).rejects.toThrow('Enhanced methods require an EnhancedAdapter');
      await expect(cache.mset({ key: 'value' })).rejects.toThrow('Enhanced methods require an EnhancedAdapter');
    });
  });

  describe("Enhanced API with Redis Adapter", () => {
    beforeEach(() => {
      if (!redisAdapter) {
        return;
      }
      cache = new Cache(redisAdapter);
      cache.setDefaultNamespace('enhanced-test');
    });

    const skipIfNoRedis = () => {
      if (!redisAdapter || !redisClient || redisClient.status !== 'ready') {
        return test.skip;
      }
      return test;
    };

    describe("Basic Set/Get Operations", () => {
      skipIfNoRedis()("should set and get data", async () => {
        const testData = { name: 'John', age: 30 };
        
        const setResult = await cache.set('user:123', testData);
        expect(setResult).toBe(true);

        const getData = await cache.get('user:123');
        expect(getData).toEqual(testData);
      });

      skipIfNoRedis()("should handle case sensitivity", async () => {
        const testData = { value: 'test' };
        
        await cache.set('CaseTest', testData);
        
        // Default case insensitive
        let result = await cache.get('casetest');
        expect(result).toEqual(testData);
        
        // Enable case sensitivity
        cache.setCaseSensitivity(true);
        result = await cache.get('casetest');
        expect(result).toBeNull();
        
        result = await cache.get('CaseTest');
        expect(result).toEqual(testData);
      });

      skipIfNoRedis()("should handle TTL options", async () => {
        const testData = { temp: 'data' };
        
        await cache.set('temp:key', testData, { ttl: 1 });
        
        let data = await cache.get('temp:key');
        expect(data).toEqual(testData);

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        data = await cache.get('temp:key');
        expect(data).toBeNull();
      });
    });

    describe("Namespace Operations", () => {
      skipIfNoRedis()("should handle namespace isolation", async () => {
        await cache.set('same-key', { ns: 'default' });
        await cache.set('same-key', { ns: 'custom' }, { namespace: 'custom' });
        
        const defaultData = await cache.get('same-key');
        const customData = await cache.get('same-key', { namespace: 'custom' });
        
        expect(defaultData).toEqual({ ns: 'default' });
        expect(customData).toEqual({ ns: 'custom' });
      });

      skipIfNoRedis()("should flush namespace", async () => {
        await cache.set('key1', 'value1', { namespace: 'flush-test' });
        await cache.set('key2', 'value2', { namespace: 'flush-test' });
        await cache.set('key3', 'value3', { namespace: 'other' });
        
        const result = await cache.flushNamespace('flush-test');
        expect(result).toBe(true);
        
        expect(await cache.get('key1', { namespace: 'flush-test' })).toBeNull();
        expect(await cache.get('key2', { namespace: 'flush-test' })).toBeNull();
        expect(await cache.get('key3', { namespace: 'other' })).toBe('value3');
      });

      skipIfNoRedis()("should get keys by namespace", async () => {
        await cache.set('user:1', 'data1', { namespace: 'users' });
        await cache.set('user:2', 'data2', { namespace: 'users' });
        await cache.set('product:1', 'data3', { namespace: 'products' });
        
        const userKeys = await cache.getKeysByNamespace('users');
        expect(userKeys.length).toBe(2);
        
        const productKeys = await cache.getKeysByNamespace('products');
        expect(productKeys.length).toBe(1);
      });
    });

    describe("Tag Operations", () => {
      skipIfNoRedis()("should handle tags", async () => {
        await cache.set('user:1', { name: 'John' }, { tags: ['users', 'active'] });
        await cache.set('user:2', { name: 'Jane' }, { tags: ['users', 'premium'] });
        await cache.set('product:1', { name: 'Widget' }, { tags: ['products'] });
        
        const userKeys = await cache.getKeysByTags(['users']);
        expect(userKeys.length).toBe(2);
        
        const activeKeys = await cache.getKeysByTags(['active']);
        expect(activeKeys.length).toBe(1);
      });

      skipIfNoRedis()("should flush by tags", async () => {
        await cache.set('item:1', 'data1', { tags: ['temp', 'test'] });
        await cache.set('item:2', 'data2', { tags: ['temp'] });
        await cache.set('item:3', 'data3', { tags: ['permanent'] });
        
        const result = await cache.flushByTags(['temp']);
        expect(result).toBe(true);
        
        expect(await cache.get('item:1')).toBeNull();
        expect(await cache.get('item:2')).toBeNull();
        expect(await cache.get('item:3')).toBe('data3');
      });
    });

    describe("Batch Operations", () => {
      skipIfNoRedis()("should handle mget/mset", async () => {
        const entries = {
          'batch:1': { id: 1, name: 'First' },
          'batch:2': { id: 2, name: 'Second' },
          'batch:3': { id: 3, name: 'Third' }
        };
        
        const setResult = await cache.mset(entries, { ttl: 3600 });
        expect(setResult).toBe(true);
        
        const keys = Object.keys(entries);
        const values = await cache.mget(keys);
        
        expect(values).toHaveLength(3);
        expect(values[0]).toEqual({ id: 1, name: 'First' });
        expect(values[1]).toEqual({ id: 2, name: 'Second' });
        expect(values[2]).toEqual({ id: 3, name: 'Third' });
      });

      skipIfNoRedis()("should handle delete operations", async () => {
        await cache.set('del:1', 'value1');
        await cache.set('del:2', 'value2');
        await cache.set('del:3', 'value3');
        
        // Single delete
        const singleResult = await cache.delete('del:1');
        expect(singleResult).toBe(true);
        
        // Multiple delete
        const multiResult = await cache.deleteMany(['del:2', 'nonexistent']);
        expect(multiResult).toBe(1); // Only one existed
        
        expect(await cache.get('del:1')).toBeNull();
        expect(await cache.get('del:2')).toBeNull();
        expect(await cache.get('del:3')).toBe('value3');
      });
    });

    describe("Utility Operations", () => {
      skipIfNoRedis()("should check existence", async () => {
        await cache.set('exists:key', 'value');
        
        expect(await cache.exists('exists:key')).toBe(true);
        expect(await cache.exists('nonexistent:key')).toBe(false);
      });

      skipIfNoRedis()("should handle TTL operations", async () => {
        await cache.set('ttl:key', 'value', { ttl: 3600 });
        
        const ttl = await cache.ttl('ttl:key');
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(3600);
        
        const expireResult = await cache.expire('ttl:key', 7200);
        expect(expireResult).toBe(true);
        
        const newTtl = await cache.ttl('ttl:key');
        expect(newTtl).toBeGreaterThan(3600);
      });

      skipIfNoRedis()("should handle atomic operations", async () => {
        await cache.set('counter', 0);
        
        const incResult = await cache.increment('counter', 5);
        expect(incResult).toBe(5);
        
        const decResult = await cache.decrement('counter', 2);
        expect(decResult).toBe(3);
        
        const finalValue = await cache.get('counter');
        expect(finalValue).toBe(3);
      });
    });

    describe("Statistics", () => {
      skipIfNoRedis()("should return cache stats", async () => {
        await cache.set('stats:1', 'value1');
        await cache.set('stats:2', 'value2');
        await cache.get('stats:1'); // hit
        await cache.get('nonexistent'); // miss
        
        const stats = await cache.getStats();
        expect(stats).toMatchObject({
          hits: expect.any(Number),
          misses: expect.any(Number),
          sets: expect.any(Number),
          deletes: expect.any(Number),
          errors: expect.any(Number),
          keyCount: expect.any(Number)
        });
      });
    });

    describe("Pipeline Operations", () => {
      skipIfNoRedis()("should handle pipeline", async () => {
        const pipeline = cache.pipeline();
        expect(pipeline).toBeDefined();
        
        if (pipeline) {
          pipeline
            .set('pipe:1', 'value1', { ttl: 300 })
            .set('pipe:2', 'value2')
            .get('pipe:1')
            .del('nonexistent');
          
          const results = await pipeline.exec();
          expect(results).toHaveLength(4);
        }
      });
    });
  });

  describe("Legacy API Compatibility", () => {
    beforeEach(() => {
      cache = new Cache(memoryAdapter);
    });

    it("should support legacy save/load methods", async () => {
      const testData = { legacy: 'data' };
      
      const saveResult = await cache.save('legacy:key', testData);
      expect(saveResult).toEqual(testData);
      
      const loadResult = await cache.load('legacy:key', 3600);
      expect(loadResult).toEqual(testData);
    });

    it("should support hash operations", async () => {
      const testData = { hash: 'value' };
      
      await cache.save('hash:key', testData, 'field1');
      await cache.save('hash:key', { other: 'data' }, 'field2');
      
      const data1 = await cache.load('hash:key', 3600, 'field1');
      const data2 = await cache.load('hash:key', 3600, 'field2');
      
      expect(data1).toEqual(testData);
      expect(data2).toEqual({ other: 'data' });
    });

    it("should handle list operations", async () => {
      await cache.save('list:key', { data: 'value1' }, 'field1');
      await cache.save('list:key', { data: 'value2' }, 'field2');
      
      const fields = await cache.list('list:key');
      expect(fields).toContain('field1');
      expect(fields).toContain('field2');
    });

    it("should handle purge operations", async () => {
      await cache.save('purge:key', { data: 'value' });
      
      const purgeResult = await cache.purge('purge:key');
      expect(purgeResult).toBe(true);
      
      const loadResult = await cache.load('purge:key', 3600);
      expect(loadResult).toBe(false);
    });

    it("should handle flush operations", async () => {
      await cache.save('flush:key1', { data: 'value1' });
      await cache.save('flush:key2', { data: 'value2' });
      
      const flushResult = await cache.flush();
      expect(flushResult).toBe(true);
      
      expect(await cache.load('flush:key1', 3600)).toBe(false);
      expect(await cache.load('flush:key2', 3600)).toBe(false);
    });

    it("should handle ping and getSize", async () => {
      const pingResult = await cache.ping();
      expect(pingResult).toBe(true);
      
      await cache.save('size:key', { data: 'value' });
      const size = await cache.getSize();
      expect(size).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      cache = new Cache(memoryAdapter);
    });

    it("should handle telemetry recording on operations", async () => {
      const mockHistogram = {
        record: jest.fn(),
      };
      const mockTelemetryLocal = {
        createHistogram: jest.fn().mockReturnValue(mockHistogram),
      };
      
      cache.setTelemetry(mockTelemetryLocal as any);
      
      await cache.save('telemetry:key', { data: 'value' });
      await cache.load('telemetry:key', 3600);
      
      expect(mockHistogram.record).toHaveBeenCalledTimes(2);
    });

    it("should handle case sensitivity correctly", async () => {
      const testData = { value: 'test' };
      
      // Case insensitive (default)
      await cache.save('CaseTest', testData);
      let result = await cache.load('casetest', 3600);
      expect(result).toEqual(testData);
      
      // Case sensitive
      cache.setCaseSensitivity(true);
      await cache.save('CaseSensitive', testData);
      result = await cache.load('casesensitive', 3600);
      expect(result).toBe(false);
      
      result = await cache.load('CaseSensitive', 3600);
      expect(result).toEqual(testData);
    });
  });
});
