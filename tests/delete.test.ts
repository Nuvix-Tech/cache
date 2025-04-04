import { Cache } from "../src/manager";
import { createTestCache, sleep } from "./setup";
import { RedisAdapter } from "../src/adapters/redis";

describe("Delete Functionality Tests", () => {
  let cache: Cache;
  let redis: RedisAdapter;

  beforeAll(async () => {
    cache = createTestCache();
    redis = cache["adapter"] as RedisAdapter;
  });

  afterAll(async () => {
    await redis.close();
  });

  beforeEach(async () => {
    await cache.clear();
  });

  describe("Basic Delete Operations", () => {
    it("should delete a single key without hash", async () => {
      // Set up
      const key = "delete-test-key";
      const value = { data: "test-value" };
      await cache.set(key, value);

      // Verify setup
      const initialValue = await cache.get(key);
      expect(initialValue).toEqual(value);

      // Delete
      const deleteResult = await cache.delete(key);
      expect(deleteResult).toBe(true);

      // Verify deletion
      const afterDelete = await cache.get(key);
      expect(afterDelete).toBeNull();
    });

    it("should return false when deleting non-existent key", async () => {
      const key = "non-existent-key";
      const deleteResult = await cache.delete(key);
      expect(deleteResult).toBe(false);
    });

    it("should delete a specific key with hash", async () => {
      // Set up
      const key = "delete-hash-key";
      const hash = "delete-hash";
      const value = { data: "test-value" };
      await cache.set(key, value, undefined, hash);

      // Verify setup
      const initialValue = await cache.get(key, hash);
      expect(initialValue).toEqual(value);

      // Delete
      const deleteResult = await cache.delete(key, hash);
      expect(deleteResult).toBe(true);

      // Verify deletion
      const afterDelete = await cache.get(key, hash);
      expect(afterDelete).toBeNull();
    });

    it("should not delete key without hash when deleting with hash", async () => {
      // Set up
      const key = "shared-key";
      const noHashValue = { data: "no-hash-value" };
      const hashValue = { data: "hash-value" };
      const hash = "test-hash";

      await cache.set(key, noHashValue); // No hash
      await cache.set(key, hashValue, undefined, hash); // With hash

      // Verify setup
      const initialNoHash = await cache.get(key);
      const initialHashed = await cache.get(key, hash);
      expect(initialNoHash).toEqual(noHashValue);
      expect(initialHashed).toEqual(hashValue);

      // Delete only the hashed version
      const deleteResult = await cache.delete(key, hash);
      expect(deleteResult).toBe(true);

      // Verify only hashed version is deleted
      const afterDeleteNoHash = await cache.get(key);
      const afterDeleteHashed = await cache.get(key, hash);
      expect(afterDeleteNoHash).toEqual(noHashValue); // Should still exist
      expect(afterDeleteHashed).toBeNull(); // Should be deleted
    });

    it("should not delete key with hash when deleting without hash", async () => {
      // Set up
      const key = "shared-key-2";
      const noHashValue = { data: "no-hash-value" };
      const hashValue = { data: "hash-value" };
      const hash = "test-hash";

      await cache.set(key, noHashValue); // No hash
      await cache.set(key, hashValue, undefined, hash); // With hash

      // Verify setup
      const initialNoHash = await cache.get(key);
      const initialHashed = await cache.get(key, hash);
      expect(initialNoHash).toEqual(noHashValue);
      expect(initialHashed).toEqual(hashValue);

      // Delete only the non-hashed version
      const deleteResult = await cache.delete(key);
      expect(deleteResult).toBe(true);

      // Verify only non-hashed version is deleted
      const afterDeleteNoHash = await cache.get(key);
      const afterDeleteHashed = await cache.get(key, hash);
      expect(afterDeleteNoHash).toBeNull(); // Should be deleted
      expect(afterDeleteHashed).toEqual(hashValue); // Should still exist
    });
  });

  describe("Batch Delete Operations", () => {
    it("should delete multiple keys without hash", async () => {
      // Set up
      const keys = ["batch-key-1", "batch-key-2", "batch-key-3"];
      for (const key of keys) {
        await cache.set(key, { key });
      }

      // Verify setup
      for (const key of keys) {
        const value = await cache.get(key);
        expect(value).toEqual({ key });
      }

      // Delete
      const deleteResult = await cache.deleteMany(keys);
      expect(deleteResult).toBe(true);

      // Verify deletion
      for (const key of keys) {
        const afterDelete = await cache.get(key);
        expect(afterDelete).toBeNull();
      }
    });

    it("should delete multiple keys with hash", async () => {
      // Set up
      const keys = ["batch-hash-key-1", "batch-hash-key-2", "batch-hash-key-3"];
      const hash = "batch-hash";
      for (const key of keys) {
        await cache.set(key, { key }, undefined, hash);
      }

      // Verify setup
      for (const key of keys) {
        const value = await cache.get(key, hash);
        expect(value).toEqual({ key });
      }

      // Delete
      const deleteResult = await cache.deleteMany(keys, hash);
      expect(deleteResult).toBe(true);

      // Verify deletion
      for (const key of keys) {
        const afterDelete = await cache.get(key, hash);
        expect(afterDelete).toBeNull();
      }
    });

    it("should handle mixed success in batch delete", async () => {
      // Set up existing and non-existing keys
      const existingKeys = ["existing-1", "existing-2"];
      const nonExistingKeys = ["non-existing-1", "non-existing-2"];
      const allKeys = [...existingKeys, ...nonExistingKeys];

      for (const key of existingKeys) {
        await cache.set(key, { key });
      }

      // Delete mix of existing and non-existing
      const deleteResult = await cache.deleteMany(allKeys);

      // With our updated implementation, this should return true
      // even though some keys don't exist
      expect(deleteResult).toBe(true);

      // All keys should now be deleted/non-existent
      for (const key of allKeys) {
        const afterDelete = await cache.get(key);
        expect(afterDelete).toBeNull();
      }
    });

    it("should not delete keys with hash when batch deleting without hash", async () => {
      // Set up
      const keys = ["mixed-key-1", "mixed-key-2"];
      const hash = "test-hash";

      // Set both hashed and non-hashed versions
      for (const key of keys) {
        await cache.set(key, { type: "no-hash", key });
        await cache.set(key, { type: "hash", key }, undefined, hash);
      }

      // Delete only the non-hashed versions
      const deleteResult = await cache.deleteMany(keys);
      expect(deleteResult).toBe(true);

      // Verify only non-hashed versions are deleted
      for (const key of keys) {
        const noHashValue = await cache.get(key);
        const hashedValue = await cache.get(key, hash);
        expect(noHashValue).toBeNull(); // Should be deleted
        expect(hashedValue).toEqual({ type: "hash", key }); // Should still exist
      }
    });
  });

  describe("Delete Implementation Details", () => {
    it("should correctly form Redis keys with and without hash", async () => {
      // This is testing the internal implementation to ensure keys are properly formed

      // Direct Redis operations to inspect the raw keys
      const key = "delete-impl-key";
      const hash = "impl-hash";
      const value = { data: "test-value" };

      // Clean up any existing keys to start with a clean state
      await cache.delete(key);
      await cache.delete(key, hash);

      // Access the Redis adapter directly
      const redisAdapter = cache["adapter"] as RedisAdapter;

      // Set values with and without hash
      await cache.set(key, { type: "no-hash" });
      await cache.set(key, { type: "hash" }, undefined, hash);

      // Get direct Redis keys from the adapter
      const rawKeys = await redisAdapter.keys("*");
      console.log("Actual Redis keys directly from adapter:", rawKeys);

      // Exact key formats that should be in Redis
      const fullKeyNoHash = redisAdapter["getKey"](key);
      const fullKeyWithHash = redisAdapter["getKey"](key, hash);

      console.log("Expected key formats:", {
        fullKeyNoHash,
        fullKeyWithHash,
      });

      // Expect to find keys with the correct format
      expect(rawKeys).toContain(fullKeyNoHash);
      expect(rawKeys).toContain(fullKeyWithHash);

      // Delete using the cache manager
      await cache.delete(key); // Should delete only the no-hash key

      // Check what keys remain in Redis
      const keysAfterFirstDelete = await redisAdapter.keys("*");
      console.log("Keys after first delete:", keysAfterFirstDelete);
      expect(keysAfterFirstDelete).not.toContain(fullKeyNoHash);
      expect(keysAfterFirstDelete).toContain(fullKeyWithHash);

      // Delete the hashed key
      await cache.delete(key, hash);

      // Verify all keys are gone
      const keysAfterSecondDelete = await redisAdapter.keys("*");
      console.log("Keys after second delete:", keysAfterSecondDelete);
      expect(keysAfterSecondDelete).not.toContain(fullKeyNoHash);
      expect(keysAfterSecondDelete).not.toContain(fullKeyWithHash);
    });

    it("should correctly normalize keys for delete operations", async () => {
      // Test case sensitivity handling
      Cache.setCaseSensitivity(false); // Default - case insensitive

      const mixedCaseKey = "Delete-Case-Test";
      const lowerCaseKey = "delete-case-test";
      const mixedCaseHash = "Hash-Test";
      const lowerCaseHash = "hash-test";

      // Set with mixed case
      await cache.set(mixedCaseKey, { data: "test" }, undefined, mixedCaseHash);

      // Delete with lowercase
      const deleteResult = await cache.delete(lowerCaseKey, lowerCaseHash);
      expect(deleteResult).toBe(true);

      // Verify deletion worked
      const afterDelete = await cache.get(mixedCaseKey, mixedCaseHash);
      expect(afterDelete).toBeNull();

      // Now test with case sensitivity on
      Cache.setCaseSensitivity(true);

      // Set with mixed case again
      await cache.set(mixedCaseKey, { data: "test" }, undefined, mixedCaseHash);

      // Try to delete with lowercase (should not work)
      const sensitiveDeleteResult = await cache.delete(
        lowerCaseKey,
        lowerCaseHash,
      );
      expect(sensitiveDeleteResult).toBe(false); // Delete should fail

      // Verify the value still exists
      const afterSensitiveDelete = await cache.get(mixedCaseKey, mixedCaseHash);
      expect(afterSensitiveDelete).toEqual({ data: "test" });

      // Delete with exactly matching case
      const correctCaseDeleteResult = await cache.delete(
        mixedCaseKey,
        mixedCaseHash,
      );
      expect(correctCaseDeleteResult).toBe(true);

      // Verify deletion worked
      const afterCorrectDelete = await cache.get(mixedCaseKey, mixedCaseHash);
      expect(afterCorrectDelete).toBeNull();

      // Reset case sensitivity for other tests
      Cache.setCaseSensitivity(false);
    });
  });

  describe("Race Conditions and Edge Cases", () => {
    it("should handle concurrent deletes of the same key", async () => {
      // Set up
      const key = "concurrent-delete-key";
      await cache.set(key, { data: "test" });

      // Perform multiple deletes concurrently
      const results = await Promise.all([
        cache.delete(key),
        cache.delete(key),
        cache.delete(key),
      ]);

      // First delete should succeed, others might or might not depending on timing
      expect(results.some((result) => result === true)).toBe(true);

      // Key should definitely be gone
      const afterDelete = await cache.get(key);
      expect(afterDelete).toBeNull();
    });

    it("should handle special characters in keys when deleting", async () => {
      const specialKeys = [
        "key:with:colons",
        "key with spaces",
        "key_with_underscores",
        "key.with.dots",
        "key#with#symbols!@#$",
        "中文键", // Unicode characters
        "🔑", // Emoji
      ];

      // Set up
      for (const key of specialKeys) {
        await cache.set(key, { key });
      }

      // Delete and verify each key
      for (const key of specialKeys) {
        const deleteResult = await cache.delete(key);
        expect(deleteResult).toBe(true);

        const afterDelete = await cache.get(key);
        expect(afterDelete).toBeNull();
      }
    });

    it("should handle delete operations with very long keys or hashes", async () => {
      const longKey = "a".repeat(250);
      const longHash = "b".repeat(250);
      await cache.set(longKey, { data: "long-key-test" }, undefined, longHash);

      const deleteResult = await cache.delete(longKey, longHash);
      expect(deleteResult).toBe(true);

      const afterDelete = await cache.get(longKey, longHash);
      expect(afterDelete).toBeNull();
    });
  });
});
