import { Cache } from "../src/cache";
import { Memory } from "../src/adapters/memory";
import { None } from "../src/adapters/none";
import { Redis } from "../src/adapters/redis";
import { Adapter } from "../src/interfaces/adapter";

// Mock Redis client for testing
const mockRedisClient = {
  hGet: jest.fn(),
  hSet: jest.fn(),
  hKeys: jest.fn(),
  hDel: jest.fn(),
  del: jest.fn(),
  flushAll: jest.fn(),
  ping: jest.fn(),
  dbSize: jest.fn(),
} as any;

describe("Cache Integration Tests", () => {
  describe("Adapter Interchangeability", () => {
    const testCases = [
      {
        name: "Memory Adapter",
        createAdapter: () => new Memory(),
        expectedBehavior: "full functionality",
      },
      {
        name: "None Adapter",
        createAdapter: () => new None(),
        expectedBehavior: "no-op functionality",
      },
      {
        name: "Redis Adapter",
        createAdapter: () => {
          // Setup basic mocks for Redis adapter
          (mockRedisClient.hSet as jest.Mock).mockResolvedValue(1);
          (mockRedisClient.hGet as jest.Mock).mockResolvedValue(null);
          (mockRedisClient.hKeys as jest.Mock).mockResolvedValue([]);
          (mockRedisClient.hDel as jest.Mock).mockResolvedValue(0);
          (mockRedisClient.del as jest.Mock).mockResolvedValue(0);
          (mockRedisClient.flushAll as jest.Mock).mockResolvedValue("OK");
          (mockRedisClient.ping as jest.Mock).mockResolvedValue("PONG");
          (mockRedisClient.dbSize as jest.Mock).mockResolvedValue(0);

          return new Redis(mockRedisClient);
        },
        expectedBehavior: "redis functionality",
      },
    ];

    testCases.forEach(({ name, createAdapter, expectedBehavior }) => {
      describe(name, () => {
        let cache: Cache;
        let adapter: Adapter;

        beforeEach(() => {
          jest.clearAllMocks();
          adapter = createAdapter();
          cache = new Cache(adapter);
        });

        it("should initialize correctly", () => {
          expect(cache).toBeInstanceOf(Cache);
          expect(cache.caseSensitive).toBe(false);
        });

        it("should handle basic cache operations", async () => {
          const testData = { message: "test", id: 123 };

          if (expectedBehavior === "full functionality") {
            // Memory adapter should work normally
            const saveResult = await cache.save("test-key", testData);
            expect(saveResult).toEqual(testData);

            const loadResult = await cache.load("test-key", 3600);
            expect(loadResult).toEqual(testData);

            const listResult = await cache.list("test");
            expect(listResult).toContain("test-key");

            const purgeResult = await cache.purge("test-key");
            expect(purgeResult).toBe(true);
          } else if (expectedBehavior === "no-op functionality") {
            // None adapter should return expected no-op values
            expect(await cache.save("test-key", testData)).toBe(false);
            expect(await cache.load("test-key", 3600)).toBe(false);
            expect(await cache.list("test")).toEqual([]);
            expect(await cache.purge("test-key")).toBe(true);
          } else if (expectedBehavior === "redis functionality") {
            // Redis adapter with mocks
            expect(await cache.save("test-key", testData)).toEqual(testData);
            expect(await cache.load("test-key", 3600)).toBe(false); // Mock returns null
            expect(await cache.list("test")).toEqual([]);
            expect(await cache.purge("test-key")).toBe(false); // Mock returns 0
          }
        });

        it("should handle ping operation", async () => {
          const pingResult = await cache.ping();
          expect(pingResult).toBe(true);
        });

        it("should handle flush operation", async () => {
          const flushResult = await cache.flush();
          expect(flushResult).toBe(true);
        });

        it("should handle size operation", async () => {
          const size = await cache.getSize();
          expect(typeof size).toBe("number");
          expect(size).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });

  describe("Adapter Switching", () => {
    it("should work when switching adapters", async () => {
      // Start with Memory adapter
      let memoryAdapter = new Memory();
      let cache = new Cache(memoryAdapter);

      await cache.save("memory-key", "memory-value");
      expect(await cache.load("memory-key", 3600)).toBe("memory-value");

      // Switch to None adapter
      let noneAdapter = new None();
      cache = new Cache(noneAdapter);

      expect(await cache.save("none-key", "none-value")).toBe(false);
      expect(await cache.load("none-key", 3600)).toBe(false);

      // Switch back to Memory adapter (different instance)
      memoryAdapter = new Memory();
      cache = new Cache(memoryAdapter);

      // Previous data is gone (different instance)
      expect(await cache.load("memory-key", 3600)).toBe(false);

      // But new operations work
      await cache.save("new-memory-key", "new-memory-value");
      expect(await cache.load("new-memory-key", 3600)).toBe("new-memory-value");
    });
  });

  describe("Case Sensitivity Integration", () => {
    const adapters = [
      { name: "Memory", create: () => new Memory() },
      { name: "None", create: () => new None() },
    ];

    adapters.forEach(({ name, create }) => {
      describe(`${name} Adapter`, () => {
        let cache: Cache;

        beforeEach(() => {
          cache = new Cache(create());
        });

        it("should handle case insensitive operations", async () => {
          cache.setCaseSensitivity(false);

          if (name === "Memory") {
            await cache.save("TEST-KEY", "test-value");
            expect(await cache.load("test-key", 3600)).toBe("test-value");
            expect(await cache.load("Test-Key", 3600)).toBe("test-value");

            const keys = await cache.list("test");
            expect(keys).toContain("test-key");

            expect(await cache.purge("TEST-KEY")).toBe(true);
          }
          // None adapter behavior is consistent regardless of case sensitivity
        });

        it("should handle case sensitive operations", async () => {
          cache.setCaseSensitivity(true);

          if (name === "Memory") {
            await cache.save("TEST-KEY", "test-value");
            expect(await cache.load("test-key", 3600)).toBe(false);
            expect(await cache.load("TEST-KEY", 3600)).toBe("test-value");

            const upperKeys = await cache.list("TEST");
            expect(upperKeys).toContain("TEST-KEY");

            const lowerKeys = await cache.list("test");
            expect(lowerKeys).not.toContain("TEST-KEY");
          }
          // None adapter behavior is consistent regardless of case sensitivity
        });
      });
    });
  });

  describe("Performance and Concurrency", () => {
    it("should handle concurrent operations with Memory adapter", async () => {
      const cache = new Cache(new Memory());
      const operations: Promise<any>[] = [];

      // Create concurrent save operations
      for (let i = 0; i < 50; i++) {
        operations.push(cache.save(`key${i}`, `value${i}`));
      }

      await Promise.all(operations);

      // Verify all data was saved
      for (let i = 0; i < 50; i++) {
        expect(await cache.load(`key${i}`, 3600)).toBe(`value${i}`);
      }

      expect(await cache.getSize()).toBe(50);
    });

    it("should handle mixed concurrent operations", async () => {
      const cache = new Cache(new Memory());

      // Pre-populate some data
      await cache.save("existing-key", "existing-value");

      const operations = [
        cache.save("new-key-1", "new-value-1"),
        cache.save("new-key-2", "new-value-2"),
        cache.load("existing-key", 3600),
        cache.load("non-existent", 3600),
        cache.list("new"),
        cache.getSize(),
        cache.ping(),
      ];

      const results = await Promise.all(operations);

      expect(results[0]).toBe("new-value-1"); // save
      expect(results[1]).toBe("new-value-2"); // save
      expect(results[2]).toBe("existing-value"); // load existing
      expect(results[3]).toBe(false); // load non-existent
      expect(results[4]).toEqual(
        expect.arrayContaining(["new-key-1", "new-key-2"]),
      ); // list
      expect(results[5]).toBe(3); // size
      expect(results[6]).toBe(true); // ping
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle adapter failures gracefully", async () => {
      // Create a faulty adapter that throws errors
      const faultyAdapter: Adapter = {
        load: jest.fn().mockRejectedValue(new Error("Load failed")),
        save: jest.fn().mockRejectedValue(new Error("Save failed")),
        list: jest.fn().mockRejectedValue(new Error("List failed")),
        purge: jest.fn().mockRejectedValue(new Error("Purge failed")),
        flush: jest.fn().mockRejectedValue(new Error("Flush failed")),
        ping: jest.fn().mockRejectedValue(new Error("Ping failed")),
        getSize: jest.fn().mockRejectedValue(new Error("Size failed")),
        getName: jest.fn().mockReturnValue("faulty"),
      };

      const cache = new Cache(faultyAdapter);

      await expect(cache.load("key", 3600)).rejects.toThrow("Load failed");
      await expect(cache.save("key", "value")).rejects.toThrow("Save failed");
      await expect(cache.list("key")).rejects.toThrow("List failed");
      await expect(cache.purge("key")).rejects.toThrow("Purge failed");
      await expect(cache.flush()).rejects.toThrow("Flush failed");
      await expect(cache.ping()).rejects.toThrow("Ping failed");
      await expect(cache.getSize()).rejects.toThrow("Size failed");
    });

    it("should handle edge case inputs", async () => {
      const cache = new Cache(new Memory());

      // Empty strings
      expect(await cache.save("", "value")).toBe(false);
      expect(await cache.load("", 3600)).toBe(false);

      // Null/undefined values
      expect(await cache.save("key", null)).toBe(false);
      expect(await cache.save("key", undefined)).toBe(false);

      // Very long keys
      const longKey = "x".repeat(10000);
      await cache.save(longKey, "value");
      expect(await cache.load(longKey, 3600)).toBe("value");

      // Complex nested objects
      const complexObject = {
        users: [
          {
            id: 1,
            name: "John",
            settings: { theme: "dark", notifications: true },
          },
          {
            id: 2,
            name: "Jane",
            settings: { theme: "light", notifications: false },
          },
        ],
        metadata: {
          version: "1.0.0",
          created: new Date().toISOString(),
          tags: ["production", "cache", "test"],
        },
      };

      await cache.save("complex-key", complexObject);
      expect(await cache.load("complex-key", 3600)).toEqual(complexObject);
    });
  });

  describe("TTL Integration", () => {
    it("should respect TTL across different operations", async () => {
      const cache = new Cache(new Memory());

      await cache.save("ttl-key", "ttl-value");

      // Should be valid with long TTL
      expect(await cache.load("ttl-key", 3600)).toBe("ttl-value");

      // Mock time advancement to simulate expiration
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 7200000); // 2 hours later

      // Should be expired with short TTL
      expect(await cache.load("ttl-key", 3600)).toBe(false);

      Date.now = originalNow;
    });
  });

  describe("Hash Parameter Integration", () => {
    it("should handle hash parameters consistently", async () => {
      const cache = new Cache(new Memory());

      await cache.save("multi-hash", "value1", "hash1");
      await cache.save("multi-hash", "value2", "hash2");

      expect(await cache.load("multi-hash", 3600, "hash1")).toBe("value1");
      expect(await cache.load("multi-hash", 3600, "hash2")).toBe("value2");

      // Different hash should not interfere
      expect(await cache.load("multi-hash", 3600, "hash3")).toBe(false);

      // Purge specific hash
      expect(await cache.purge("multi-hash", "hash1")).toBe(true);
      expect(await cache.load("multi-hash", 3600, "hash1")).toBe(false);
      expect(await cache.load("multi-hash", 3600, "hash2")).toBe("value2");
    });
  });

  describe("Telemetry Integration", () => {
    it("should record metrics for all adapter operations", async () => {
      const mockHistogram = {
        record: jest.fn(),
      };
      const mockTelemetryAdapter = {
        createHistogram: jest.fn().mockReturnValue(mockHistogram),
      };

      const cache = new Cache(new Memory());
      cache.setTelemetry(mockTelemetryAdapter as any);

      // Perform various operations
      await cache.save("test-key", "test-value");
      await cache.load("test-key", 3600);
      await cache.list("test");
      await cache.purge("test-key");
      await cache.flush();
      await cache.getSize();

      // Verify metrics were recorded for each operation
      const expectedOperations = [
        "save",
        "load",
        "list",
        "purge",
        "flush",
        "size",
      ];

      expectedOperations.forEach((operation) => {
        expect(mockHistogram.record).toHaveBeenCalledWith(
          expect.any(Number),
          expect.objectContaining({
            operation,
            adapter: "memory",
          }),
        );
      });
    });
  });
});
