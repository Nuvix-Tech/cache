import { None } from "../src/adapters/none";

describe("None Adapter", () => {
  let adapter: None;

  beforeEach(() => {
    adapter = new None();
  });

  describe("Constructor", () => {
    it("should initialize successfully", () => {
      expect(adapter).toBeInstanceOf(None);
      expect(adapter.getName()).toBe("none");
    });
  });

  describe("Save Operation", () => {
    it("should always return false", async () => {
      expect(await adapter.save("key", "value")).toBe(false);
      expect(await adapter.save("test-key", { data: "test" })).toBe(false);
      expect(await adapter.save("number-key", 42)).toBe(false);
      expect(await adapter.save("array-key", [1, 2, 3])).toBe(false);
    });

    it("should return false with hash parameter", async () => {
      expect(await adapter.save("key", "value", "hash123")).toBe(false);
    });

    it("should return false with empty/invalid inputs", async () => {
      expect(await adapter.save("", "value")).toBe(false);
      expect(await adapter.save("key", "")).toBe(false);
      expect(await adapter.save("key", null)).toBe(false);
      expect(await adapter.save("key", undefined)).toBe(false);
    });
  });

  describe("Load Operation", () => {
    it("should always return false", async () => {
      expect(await adapter.load("key", 3600)).toBe(false);
      expect(await adapter.load("test-key", 1800)).toBe(false);
      expect(await adapter.load("non-existent", 0)).toBe(false);
    });

    it("should return false with hash parameter", async () => {
      expect(await adapter.load("key", 3600, "hash123")).toBe(false);
    });

    it("should return false regardless of TTL value", async () => {
      expect(await adapter.load("key", -1)).toBe(false);
      expect(await adapter.load("key", 0)).toBe(false);
      expect(await adapter.load("key", 1)).toBe(false);
      expect(await adapter.load("key", 999999)).toBe(false);
    });
  });

  describe("List Operation", () => {
    it("should always return empty array", async () => {
      expect(await adapter.list("key")).toEqual([]);
      expect(await adapter.list("user:")).toEqual([]);
      expect(await adapter.list("")).toEqual([]);
      expect(await adapter.list("*")).toEqual([]);
    });
  });

  describe("Purge Operation", () => {
    it("should always return true", async () => {
      expect(await adapter.purge("key")).toBe(true);
      expect(await adapter.purge("non-existent")).toBe(true);
      expect(await adapter.purge("")).toBe(true);
    });

    it("should return true with hash parameter", async () => {
      expect(await adapter.purge("key", "hash123")).toBe(true);
    });
  });

  describe("Flush Operation", () => {
    it("should always return true", async () => {
      expect(await adapter.flush()).toBe(true);
    });
  });

  describe("Ping Operation", () => {
    it("should always return true", async () => {
      expect(await adapter.ping()).toBe(true);
    });
  });

  describe("Size Operation", () => {
    it("should always return 0", async () => {
      expect(await adapter.getSize()).toBe(0);
    });
  });

  describe("getName Operation", () => {
    it('should return "none"', () => {
      expect(adapter.getName()).toBe("none");
      expect(adapter.getName("any-key")).toBe("none");
      expect(adapter.getName("")).toBe("none");
    });
  });

  describe("Adapter Interface Compliance", () => {
    it("should implement all required methods", () => {
      expect(typeof adapter.load).toBe("function");
      expect(typeof adapter.save).toBe("function");
      expect(typeof adapter.list).toBe("function");
      expect(typeof adapter.purge).toBe("function");
      expect(typeof adapter.flush).toBe("function");
      expect(typeof adapter.ping).toBe("function");
      expect(typeof adapter.getSize).toBe("function");
      expect(typeof adapter.getName).toBe("function");
    });

    it("should have correct method signatures", async () => {
      // Test that all methods are async and return promises
      expect(adapter.load("key", 3600)).toBeInstanceOf(Promise);
      expect(adapter.save("key", "value")).toBeInstanceOf(Promise);
      expect(adapter.list("key")).toBeInstanceOf(Promise);
      expect(adapter.purge("key")).toBeInstanceOf(Promise);
      expect(adapter.flush()).toBeInstanceOf(Promise);
      expect(adapter.ping()).toBeInstanceOf(Promise);
      expect(adapter.getSize()).toBeInstanceOf(Promise);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle multiple simultaneous operations", async () => {
      const operations = [
        adapter.load("key1", 3600),
        adapter.save("key2", "value"),
        adapter.list("prefix:"),
        adapter.purge("key3"),
        adapter.flush(),
        adapter.ping(),
        adapter.getSize(),
      ];

      const results = await Promise.all(operations);

      expect(results[0]).toBe(false); // load
      expect(results[1]).toBe(false); // save
      expect(results[2]).toEqual([]); // list
      expect(results[3]).toBe(true); // purge
      expect(results[4]).toBe(true); // flush
      expect(results[5]).toBe(true); // ping
      expect(results[6]).toBe(0); // getSize
    });

    it("should maintain consistent behavior under load", async () => {
      const promises: Promise<any>[] = [];

      // Create many operations
      for (let i = 0; i < 100; i++) {
        promises.push(adapter.save(`key${i}`, `value${i}`));
        promises.push(adapter.load(`key${i}`, 3600));
      }

      const results = await Promise.all(promises);

      // All saves should return false
      for (let i = 0; i < results.length; i += 2) {
        expect(results[i]).toBe(false);
      }

      // All loads should return false
      for (let i = 1; i < results.length; i += 2) {
        expect(results[i]).toBe(false);
      }
    });
  });

  describe("Error Handling", () => {
    it("should not throw errors with invalid inputs", async () => {
      // These should not throw, just return the expected values
      await expect(adapter.load(null as any, 3600)).resolves.toBe(false);
      await expect(adapter.save(null as any, "value")).resolves.toBe(false);
      await expect(adapter.list(null as any)).resolves.toEqual([]);
      await expect(adapter.purge(null as any)).resolves.toBe(true);
    });

    it("should handle undefined parameters gracefully", async () => {
      await expect(
        adapter.load(undefined as any, undefined as any),
      ).resolves.toBe(false);
      await expect(
        adapter.save(undefined as any, undefined as any),
      ).resolves.toBe(false);
      await expect(adapter.list(undefined as any)).resolves.toEqual([]);
      await expect(adapter.purge(undefined as any)).resolves.toBe(true);
    });
  });

  describe("Use Cases", () => {
    it("should be suitable as a null object pattern", async () => {
      // The None adapter is useful as a null object pattern
      // where you want to disable caching without changing code

      // Simulate normal cache operations
      await adapter.save("user:1", { name: "John", age: 30 });
      const user = await adapter.load("user:1", 3600);

      expect(user).toBe(false); // No data is actually stored

      const userKeys = await adapter.list("user:");
      expect(userKeys).toEqual([]); // No keys are returned

      expect(await adapter.getSize()).toBe(0); // Size is always 0
      expect(await adapter.ping()).toBe(true); // Connection is always "healthy"
    });

    it("should be useful for testing or disabling cache", async () => {
      // In tests or when you want to disable caching,
      // the None adapter provides a safe no-op implementation

      const operations = [
        "save operation",
        "load operation",
        "list operation",
        "purge operation",
        "flush operation",
      ];

      for (const operation of operations) {
        // All operations complete successfully but do nothing
        switch (operation) {
          case "save operation":
            expect(await adapter.save("key", "value")).toBe(false);
            break;
          case "load operation":
            expect(await adapter.load("key", 3600)).toBe(false);
            break;
          case "list operation":
            expect(await adapter.list("key")).toEqual([]);
            break;
          case "purge operation":
            expect(await adapter.purge("key")).toBe(true);
            break;
          case "flush operation":
            expect(await adapter.flush()).toBe(true);
            break;
        }
      }
    });
  });
});
