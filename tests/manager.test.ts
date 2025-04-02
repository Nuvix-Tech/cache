import { Cache } from "../src/manager";
import { createTestCache } from "./setup";

describe("Cache Manager", () => {
  let cache: Cache;

  beforeEach(() => {
    cache = createTestCache();
  });

  describe("Basic Operations", () => {
    it("should set and get values", async () => {
      const key = "test-key";
      const value = { data: "test-value" };

      await cache.set(key, value);
      const result = await cache.get(key);

      expect(result).toEqual(value);
    });

    it("should handle different data types", async () => {
      const key = "test-key";
      const value = {
        string: "test",
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { nested: "value" },
      };

      await cache.set(key, value);
      const result = await cache.get(key);

      expect(result).toEqual(value);
    });

    it("should handle non-existent keys", async () => {
      const result = await cache.get("non-existent");
      expect(result).toBeNull();
    });

    it("should delete values", async () => {
      const key = "test-key";
      const value = { data: "test-value" };

      await cache.set(key, value);
      await cache.delete(key);
      const result = await cache.get(key);

      expect(result).toBeNull();
    });

    it("should clear all values", async () => {
      const key1 = "test-key-1";
      const key2 = "test-key-2";
      const value = { data: "test-value" };

      await cache.set(key1, value);
      await cache.set(key2, value);
      await cache.clear();

      const result1 = await cache.get(key1);
      const result2 = await cache.get(key2);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe("Hash Operations", () => {
    it("should handle hash-based operations", async () => {
      const key = "test-key";
      const hash = "test-hash";
      const value = { data: "test-value" };

      // Set with hash
      await cache.set(key, value, undefined, hash);
      
      // Get with hash
      const result = await cache.get(key, hash);
      expect(result).toEqual(value);

      // Get without hash should return null
      const noHashResult = await cache.get(key);
      expect(noHashResult).toBeNull();

      // Delete with hash
      await cache.delete(key, hash);
      const deletedResult = await cache.get(key, hash);
      expect(deletedResult).toBeNull();
    });

    it("should handle batch operations with hashes", async () => {
      const hash = "test-hash";
      const data = {
        "key1": { data: "value1" },
        "key2": { data: "value2" },
        "key3": { data: "value3" }
      };

      // Set multiple values with hash
      await cache.mset(data, hash);

      // Get multiple values with hash
      const results = await cache.mget(Object.keys(data), hash);
      expect(results).toEqual(Object.values(data));

      // Get without hash should return nulls
      const noHashResults = await cache.mget(Object.keys(data));
      expect(noHashResults).toEqual([null, null, null]);

      // Delete multiple keys with hash
      await cache.deleteMany(Object.keys(data), hash);
      const deletedResults = await cache.mget(Object.keys(data), hash);
      expect(deletedResults).toEqual([null, null, null]);
    });

    it("should handle pattern matching with hashes", async () => {
      const hash = "test-hash";
      const data = {
        "user:1": { name: "John" },
        "user:2": { name: "Jane" },
        "post:1": { title: "Hello" }
      };

      await cache.mset(data, hash);

      // Find all user keys with hash
      const userKeys = await cache.keys("user:*", hash);
      expect(userKeys.sort()).toEqual([
        "test-cache:user:1:test-hash",
        "test-cache:user:2:test-hash"
      ]);

      // Find all post keys with hash
      const postKeys = await cache.keys("post:*", hash);
      expect(postKeys.sort()).toEqual([
        "test-cache:post:1:test-hash"
      ]);

      // Pattern matching without hash should return empty
      const noHashKeys = await cache.keys("user:*");
      expect(noHashKeys).toEqual([]);
    });

    it("should handle TTL with hashes", async () => {
      const key = "test-key";
      const hash = "test-hash";
      const value = { data: "test-value" };

      await cache.set(key, value, 1, hash); // 1 second TTL

      // Value should exist immediately
      const immediateResult = await cache.get(key, hash);
      expect(immediateResult).toEqual(value);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds

      // Value should be gone
      const expiredResult = await cache.get(key, hash);
      expect(expiredResult).toBeNull();
    }, 10000); // 10 second timeout

    it("should handle extending TTL with hashes", async () => {
      const key = "test-key";
      const hash = "test-hash";
      const value = { data: "test-value" };

      await cache.set(key, value, 1, hash); // 1 second TTL

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));

      // Extend TTL
      await cache.extendTTL(key, 2, hash);

      // Wait for original TTL
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Value should still exist
      const result = await cache.get(key, hash);
      expect(result).toEqual(value);

      // Wait for extended TTL
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for 3 seconds

      // Value should be gone
      const expiredResult = await cache.get(key, hash);
      expect(expiredResult).toBeNull();
    }, 10000); // 10 second timeout
  });

  describe("Case Sensitivity", () => {
    beforeEach(() => {
      Cache.setCaseSensitivity(false); // Reset to default
    });

    afterEach(() => {
      Cache.setCaseSensitivity(false); // Reset for other tests
    });

    it("should handle case-insensitive keys by default", async () => {
      const key1 = "Test-Key";
      const key2 = "test-key";
      const value = { data: "test-value" };

      await cache.set(key1, value);
      const result = await cache.get(key2);

      expect(result).toEqual(value);
    });

    it("should respect case sensitivity when enabled", async () => {
      Cache.setCaseSensitivity(true);
      await cache.clear(); // Clear cache before test

      const key1 = "Test-Key";
      const key2 = "test-key";
      const value = { data: "test-value" };

      await cache.set(key1, value);
      const result = await cache.get(key2);

      expect(result).toBeNull();
    });
  });

  describe("Event Emission", () => {
    it("should emit hit events", async () => {
      const key = "test-key";
      const value = { data: "test-value" };
      const hitSpy = jest.fn();

      cache.on("hit", hitSpy);
      await cache.set(key, value);
      await cache.get(key);

      expect(hitSpy).toHaveBeenCalledWith(key);
      cache.off("hit", hitSpy);
    });

    it("should emit miss events", async () => {
      const key = "non-existent";
      const missSpy = jest.fn();

      cache.on("miss", missSpy);
      await cache.get(key);

      expect(missSpy).toHaveBeenCalledWith(key);
      cache.off("miss", missSpy);
    });

    it("should emit set events", async () => {
      const key = "test-key";
      const value = { data: "test-value" };
      const setSpy = jest.fn();

      cache.on("set", setSpy);
      await cache.set(key, value);

      expect(setSpy).toHaveBeenCalledWith(key, value);
    });

    it("should emit delete events", async () => {
      const key = "test-key";
      const value = { data: "test-value" };
      const deleteSpy = jest.fn();

      cache.on("delete", deleteSpy);
      await cache.set(key, value);
      await cache.delete(key);

      expect(deleteSpy).toHaveBeenCalledWith(key);
    });

    it("should emit error events", async () => {
      const key = "error-key";
      const invalidValue = { circular: {} };
      (invalidValue as any).circular = invalidValue;
      const errorSpy = jest.fn();

      cache.on("error", errorSpy);
      try {
        await cache.set(key, invalidValue);
      } catch (error) {
        // Expected error
      }

      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
      cache.off("error", errorSpy);
    });
  });

  describe("Statistics", () => {
    it("should track hits and misses", async () => {
      const key = "test-key";
      const value = { data: "test-value" };

      await cache.set(key, value);
      await cache.get(key); // Hit
      await cache.get("non-existent"); // Miss
      await cache.get(key); // Hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle connection issues gracefully", async () => {
      const isAlive = await cache.ping();
      expect(isAlive).toBe(true);
    });

    it("should handle invalid JSON data", async () => {
      const key = "test-key";
      const invalidData = { circular: {} };
      invalidData.circular = invalidData; // Create circular reference

      await expect(cache.set(key, invalidData)).rejects.toThrow();
      const result = await cache.get(key);
      expect(result).toBeNull();
    });

    it("should handle batch operations with invalid data", async () => {
      const data = {
        "key1": { valid: "data" },
        "key2": { circular: {} }
      };
      data.key2.circular = data.key2; // Create circular reference

      await expect(cache.mset(data)).rejects.toThrow();
      const result = await cache.mget(Object.keys(data));
      expect(result).toEqual([{ valid: "data" }, null]);
    });
  });
});
