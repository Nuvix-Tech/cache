import { Cache } from "../src/cache";
import { Redis } from "../src/adapters/redis";
import { Memory } from "../src/adapters/memory";
import IORedis from "ioredis";

describe("Enhanced Integration Tests", () => {
  let redisCache: Cache;
  let memoryCache: Cache;
  let redisClient: IORedis;

  beforeAll(async () => {
    // Set up memory cache
    const memoryAdapter = new Memory();
    memoryCache = new Cache(memoryAdapter);

    // Set up Redis cache if available
    try {
      redisClient = new IORedis({
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        lazyConnect: true,
      });
      await redisClient.connect();

      const redisAdapter = new Redis({
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        namespace: "integration-test",
        defaultTTL: 3600,
        enableCompression: true,
        compressionThreshold: 100,
      });

      redisCache = new Cache(redisAdapter);
      redisCache.setDefaultNamespace("integration");
    } catch (error) {
      console.warn("Redis not available for integration tests");
    }
  });

  beforeEach(async () => {
    if (redisClient?.status === "ready") {
      await redisClient.flushdb();
    }
  });

  afterAll(async () => {
    if (redisClient?.status === "ready") {
      await redisClient.quit();
    }
  });

  const skipIfNoRedis = () => {
    if (!redisCache || !redisClient || redisClient.status !== "ready") {
      return test.skip;
    }
    return test;
  };

  describe("Real-world Usage Scenarios", () => {
    skipIfNoRedis()("should handle user session management", async () => {
      const sessionData = {
        userId: "user123",
        username: "johndoe",
        permissions: ["read", "write"],
        loginTime: Date.now(),
        preferences: { theme: "dark", language: "en" },
      };

      // Store session with 1 hour TTL and tags
      await redisCache.set(`session:${sessionData.userId}`, sessionData, {
        ttl: 3600,
        tags: ["sessions", "active-users"],
        metadata: {
          ip: "192.168.1.1",
          userAgent: "Mozilla/5.0...",
          loginSource: "web",
        },
      });

      // Retrieve session
      const retrievedSession = await redisCache.get(
        `session:${sessionData.userId}`,
      );
      expect(retrievedSession).toEqual(sessionData);

      // Update session activity
      const updatedSession = {
        ...sessionData,
        lastActivity: Date.now(),
      };
      await redisCache.set(`session:${sessionData.userId}`, updatedSession, {
        ttl: 3600,
        tags: ["sessions", "active-users"],
      });

      // Verify update
      const finalSession = (await redisCache.get(
        `session:${sessionData.userId}`,
      )) as any;
      expect(finalSession?.lastActivity).toBeDefined();

      // Clean up all active sessions
      await redisCache.flushByTags(["active-users"]);
      const cleanedSession = await redisCache.get(
        `session:${sessionData.userId}`,
      );
      expect(cleanedSession).toBeNull();
    });

    skipIfNoRedis()("should handle product catalog caching", async () => {
      const products = [
        {
          id: "prod1",
          name: "Laptop",
          category: "electronics",
          price: 999.99,
          inStock: true,
        },
        {
          id: "prod2",
          name: "Phone",
          category: "electronics",
          price: 699.99,
          inStock: true,
        },
        {
          id: "prod3",
          name: "Book",
          category: "books",
          price: 19.99,
          inStock: false,
        },
      ];

      // Cache products with categories as tags
      const productEntries: Record<string, any> = {};
      for (const product of products) {
        productEntries[`product:${product.id}`] = product;
      }

      await redisCache.mset(productEntries, {
        ttl: 7200, // 2 hours
        tags: ["products", "catalog"],
        namespace: "ecommerce",
      });

      // Cache category listings
      const electronics = products.filter((p) => p.category === "electronics");
      const books = products.filter((p) => p.category === "books");

      await redisCache.set("category:electronics", electronics, {
        ttl: 3600,
        tags: ["categories", "electronics"],
        namespace: "ecommerce",
      });

      await redisCache.set("category:books", books, {
        ttl: 3600,
        tags: ["categories", "books"],
        namespace: "ecommerce",
      });

      // Retrieve products
      const productKeys = products.map((p) => `product:${p.id}`);
      const cachedProducts = await redisCache.mget(productKeys, {
        namespace: "ecommerce",
      });

      expect(cachedProducts).toHaveLength(3);
      expect(cachedProducts[0]).toEqual(products[0]);

      // Get category data
      const electronicsData = await redisCache.get("category:electronics", {
        namespace: "ecommerce",
      });
      expect(electronicsData).toEqual(electronics);

      // Invalidate electronics category when product updated
      await redisCache.flushByTags(["electronics"]);

      const updatedElectronics = await redisCache.get("category:electronics", {
        namespace: "ecommerce",
      });
      expect(updatedElectronics).toBeNull();

      // Products should still exist (different tags)
      const stillCachedProduct = await redisCache.get("product:prod1", {
        namespace: "ecommerce",
      });
      expect(stillCachedProduct).toEqual(products[0]);
    });

    skipIfNoRedis()("should handle analytics and counters", async () => {
      // Page view counters
      await redisCache.set("counter:page_views", 0);
      await redisCache.set("counter:unique_visitors", 0);

      // Simulate page views
      for (let i = 0; i < 10; i++) {
        await redisCache.increment("counter:page_views");
      }

      // Simulate unique visitors
      for (let i = 0; i < 5; i++) {
        await redisCache.increment("counter:unique_visitors");
      }

      const pageViews = await redisCache.get("counter:page_views");
      const uniqueVisitors = await redisCache.get("counter:unique_visitors");

      expect(pageViews).toBe(10);
      expect(uniqueVisitors).toBe(5);

      // Store detailed analytics
      const analyticsData = {
        date: "2025-06-17",
        pageViews: pageViews,
        uniqueVisitors: uniqueVisitors,
        topPages: ["/home", "/products", "/about"],
        avgSessionDuration: 345,
        bounceRate: 0.32,
      };

      await redisCache.set("analytics:daily:2025-06-17", analyticsData, {
        ttl: 86400 * 30, // 30 days
        tags: ["analytics", "daily-stats"],
        metadata: { generated: Date.now(), source: "web-analytics" },
      });

      const storedAnalytics = await redisCache.get(
        "analytics:daily:2025-06-17",
      );
      expect(storedAnalytics).toEqual(analyticsData);
    });

    skipIfNoRedis()("should handle configuration management", async () => {
      const configs = {
        "app:feature_flags": {
          newDashboard: true,
          advancedSearch: false,
          betaFeatures: true,
        },
        "app:settings": {
          maxUploadSize: "10MB",
          sessionTimeout: 3600,
          enableLogging: true,
        },
        "app:themes": {
          default: "light",
          available: ["light", "dark", "auto"],
          customColors: { primary: "#007bff", secondary: "#6c757d" },
        },
      };

      // Store configurations with long TTL
      await redisCache.mset(configs, {
        ttl: 86400, // 24 hours
        tags: ["config", "app-settings"],
        namespace: "configuration",
      });

      // Retrieve specific config
      const featureFlags = (await redisCache.get("app:feature_flags", {
        namespace: "configuration",
      })) as any;
      expect(featureFlags?.newDashboard).toBe(true);

      // Bulk retrieve configurations
      const configKeys = Object.keys(configs);
      const allConfigs = await redisCache.mget(configKeys, {
        namespace: "configuration",
      });

      expect(allConfigs).toHaveLength(3);
      expect(allConfigs[0]).toEqual(configs["app:feature_flags"]);

      // Update feature flag
      const updatedFlags = {
        ...configs["app:feature_flags"],
        advancedSearch: true,
      };
      await redisCache.set("app:feature_flags", updatedFlags, {
        ttl: 86400,
        tags: ["config", "app-settings"],
        namespace: "configuration",
      });

      const newFlags = (await redisCache.get("app:feature_flags", {
        namespace: "configuration",
      })) as any;
      expect(newFlags?.advancedSearch).toBe(true);

      // Clear all configuration cache
      await redisCache.flushNamespace("configuration");

      const clearedConfig = await redisCache.get("app:settings", {
        namespace: "configuration",
      });
      expect(clearedConfig).toBeNull();
    });
  });

  describe("Performance and Stress Testing", () => {
    skipIfNoRedis()(
      "should handle large batch operations efficiently",
      async () => {
        const batchSize = 100;
        const entries: Record<string, any> = {};

        // Generate test data
        for (let i = 0; i < batchSize; i++) {
          entries[`batch:item:${i}`] = {
            id: i,
            data: `data-${i}`,
            timestamp: Date.now() + i,
          };
        }

        const startTime = Date.now();

        // Batch set
        await redisCache.mset(entries, {
          ttl: 3600,
          tags: ["batch-test"],
          namespace: "performance",
        });

        const setTime = Date.now() - startTime;

        // Batch get
        const keys = Object.keys(entries);
        const getStartTime = Date.now();
        const results = await redisCache.mget(keys, {
          namespace: "performance",
        });
        const getTime = Date.now() - getStartTime;

        expect(results).toHaveLength(batchSize);
        expect(results[0]).toEqual(entries["batch:item:0"]);
        expect(results[batchSize - 1]).toEqual(
          entries[`batch:item:${batchSize - 1}`],
        );

        // Performance should be reasonable (adjust thresholds as needed)
        expect(setTime).toBeLessThan(5000); // 5 seconds
        expect(getTime).toBeLessThan(2000); // 2 seconds

        console.log(
          `Batch operations: Set ${batchSize} items in ${setTime}ms, Get in ${getTime}ms`,
        );
      },
    );

    skipIfNoRedis()("should handle compression for large objects", async () => {
      const largeObject = {
        id: "large-obj",
        data: "x".repeat(10000), // 10KB of data
        metadata: {
          size: "large",
          compressed: true,
          arrays: new Array(1000)
            .fill(0)
            .map((_, i) => ({ index: i, value: `item-${i}` })),
        },
      };

      const startTime = Date.now();

      await redisCache.set("large:object", largeObject, {
        ttl: 3600,
        compression: true,
        tags: ["large-objects"],
      });

      const setTime = Date.now() - startTime;

      const getStartTime = Date.now();
      const retrieved = (await redisCache.get("large:object")) as any;
      const getTime = Date.now() - getStartTime;

      expect(retrieved).toEqual(largeObject);
      expect(retrieved?.data).toHaveLength(10000);
      expect(retrieved?.metadata.arrays).toHaveLength(1000);

      console.log(
        `Large object operations: Set in ${setTime}ms, Get in ${getTime}ms`,
      );
    });
  });

  describe("Error Recovery and Edge Cases", () => {
    it("should gracefully handle memory adapter limitations", async () => {
      // Memory adapter doesn't support enhanced features
      await expect(memoryCache.set("key", "value")).rejects.toThrow();

      // But legacy methods should work
      const result = await memoryCache.save("legacy:key", { data: "value" });
      expect(result).toEqual({ data: "value" });

      const loaded = await memoryCache.load("legacy:key", 3600);
      expect(loaded).toEqual({ data: "value" });
    });

    skipIfNoRedis()("should handle TTL edge cases", async () => {
      // Test TTL of 0 (no expiration)
      await redisCache.set("permanent", "value", { ttl: 0 });

      // Test very short TTL
      await redisCache.set("temporary", "value", { ttl: 1 });

      expect(await redisCache.get("permanent")).toBe("value");
      expect(await redisCache.get("temporary")).toBe("value");

      // Wait for short TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(await redisCache.get("permanent")).toBe("value");
      expect(await redisCache.get("temporary")).toBeNull();
    });

    skipIfNoRedis()(
      "should handle namespace and tag combinations",
      async () => {
        // Store items in different namespaces with overlapping tags
        await redisCache.set("item1", "value1", {
          namespace: "ns1",
          tags: ["shared", "ns1-specific"],
        });

        await redisCache.set("item2", "value2", {
          namespace: "ns2",
          tags: ["shared", "ns2-specific"],
        });

        // Get keys by tags (should span namespaces)
        const sharedKeys = await redisCache.getKeysByTags(["shared"]);
        expect(sharedKeys.length).toBe(2);

        // Flush by namespace should only affect one namespace
        await redisCache.flushNamespace("ns1");

        expect(await redisCache.get("item1", { namespace: "ns1" })).toBeNull();
        expect(await redisCache.get("item2", { namespace: "ns2" })).toBe(
          "value2",
        );
      },
    );
  });

  describe("Statistics and Monitoring", () => {
    skipIfNoRedis()("should track comprehensive statistics", async () => {
      // Perform various operations
      await redisCache.set("stats:1", "value1");
      await redisCache.set("stats:2", "value2");
      await redisCache.get("stats:1"); // hit
      await redisCache.get("stats:nonexistent"); // miss
      await redisCache.delete("stats:2"); // delete

      const stats = await redisCache.getStats();

      expect(stats).toMatchObject({
        hits: expect.any(Number),
        misses: expect.any(Number),
        sets: expect.any(Number),
        deletes: expect.any(Number),
        errors: expect.any(Number),
        keyCount: expect.any(Number),
      });

      expect(stats.hits).toBeGreaterThanOrEqual(1);
      expect(stats.misses).toBeGreaterThanOrEqual(1);
      expect(stats.sets).toBeGreaterThanOrEqual(2);
      expect(stats.deletes).toBeGreaterThanOrEqual(1);
    });
  });
});
