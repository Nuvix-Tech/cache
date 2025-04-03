import { Cache } from "../src/manager";
import { RedisAdapter } from "../src/adapters/redis";
import { performance } from "perf_hooks";

describe("Cache Performance Tests", () => {
  let cache: Cache;
  let redis: RedisAdapter;

  beforeAll(async () => {
    redis = new RedisAdapter({
      host: "localhost",
      port: 6379,
      namespace: "cache",
    });
    cache = new Cache(redis);
  });

  afterAll(async () => {
    await redis.close();
  });

  beforeEach(async () => {
    await cache.clear();
  });

  describe("Single Operation Performance", () => {
    it("should handle large object serialization efficiently", async () => {
      const largeObject = {
        data: Array(10000)
          .fill(0)
          .map(() => ({ key: "value" })),
        timestamp: Date.now(),
      };

      const start = performance.now();
      await cache.set("large-object", largeObject);
      const setDuration = performance.now() - start;

      const getStart = performance.now();
      const result = await cache.get("large-object");
      const getDuration = performance.now() - getStart;

      expect(result).toEqual(largeObject);
      expect(setDuration).toBeLessThan(500); // Allow up to 500ms for large object serialization
      expect(getDuration).toBeLessThan(200); // Allow up to 200ms for large object deserialization
    });

    it("should handle high-frequency operations efficiently", async () => {
      const operations = 1000;
      const start = performance.now();

      for (let i = 0; i < operations; i++) {
        await cache.set(`key-${i}`, { value: i });
      }

      const setDuration = performance.now() - start;
      const avgSetTime = setDuration / operations;

      expect(avgSetTime).toBeLessThan(5); // Average set time should be less than 5ms
    });
  });

  describe("Batch Operation Performance", () => {
    it("should handle batch operations efficiently", async () => {
      const batchSize = 100;
      const data = Array.from({ length: batchSize }, (_, i) => ({
        key: `batch-key-${i}`,
        value: { data: `value-${i}`, timestamp: Date.now() },
      }));

      // Test mset performance
      const msetStart = performance.now();
      const msetData = data.reduce(
        (acc, { key, value }) => {
          acc[key] = value;
          return acc;
        },
        {} as Record<string, unknown>,
      );
      await cache.mset(msetData);
      const msetDuration = performance.now() - msetStart;

      // Test mget performance
      const mgetStart = performance.now();
      const keys = data.map(({ key }) => key);
      const results = await cache.mget(keys);
      const mgetDuration = performance.now() - mgetStart;

      expect(results.length).toBe(batchSize);
      expect(msetDuration).toBeLessThan(200); // Should complete within 200ms
      expect(mgetDuration).toBeLessThan(100); // Should complete within 100ms
    });

    it("should handle parallel operations efficiently", async () => {
      const operations = 50;
      const start = performance.now();

      const promises = Array.from({ length: operations }, (_, i) =>
        cache.set(`parallel-key-${i}`, { value: i }),
      );

      await Promise.all(promises);
      const duration = performance.now() - start;
      const avgTime = duration / operations;

      expect(avgTime).toBeLessThan(10); // Average time should be less than 10ms
    });
  });

  describe("Compression Performance", () => {
    it("should compress and decompress efficiently", async () => {
      const largeString = "x".repeat(10000);
      const start = performance.now();

      await cache.set("compressed", largeString);
      const setDuration = performance.now() - start;

      const getStart = performance.now();
      const result = await cache.get<string>("compressed");
      const getDuration = performance.now() - getStart;

      expect(result).toBe(largeString);
      expect(setDuration).toBeLessThan(50); // Should complete within 50ms
      expect(getDuration).toBeLessThan(30); // Should complete within 30ms
    });
  });

  describe("Error Recovery Performance", () => {
    it("should handle retries efficiently", async () => {
      const start = performance.now();
      let attempts = 0;

      // Simulate temporary Redis connection issues
      const originalSet = redis.set.bind(redis);
      redis.set = async (key: string, value: unknown) => {
        attempts++;
        if (attempts <= 2) {
          throw new Error("Temporary connection issue");
        }
        return originalSet(key, value);
      };

      await cache.set("retry-test", { value: "test" });
      const duration = performance.now() - start;

      expect(attempts).toBe(3); // Should retry twice
      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });
  });
});
