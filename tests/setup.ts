import { RedisAdapter } from "../src/adapters/redis";
import { Cache } from "../src/manager";

// Helper function to create a test cache instance
export function createTestCache(): Cache {
  const adapter = new RedisAdapter({
    host: "localhost",
    port: 6379,
    namespace: "test-cache",
  });
  return new Cache(adapter);
}

// Helper function to sleep
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
