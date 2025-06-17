// Test setup file
// Global test configuration and setup
import { createClient, type RedisClientType } from 'redis';

// Mock @nuvix/telemetry to avoid external dependencies in tests
jest.mock('@nuvix/telemetry', () => ({
  None: jest.fn().mockImplementation(() => ({
    createHistogram: jest.fn().mockReturnValue({
      record: jest.fn(),
    }),
  })),
  Adapter: jest.fn(),
  Histogram: jest.fn(),
}));

// Redis client for testing
let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      database: 15, // Use database 15 for testing to avoid conflicts
    });

    try {
      await redisClient.connect();
      console.log('Connected to Redis for testing');
    } catch (error) {
      console.warn('Redis not available for testing, will skip Redis tests:', error);
      throw error;
    }
  }
  return redisClient;
}

export async function cleanupRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.flushDb(); // Clear test database
      await redisClient.disconnect();
      redisClient = null;
    } catch (error) {
      console.warn('Error cleaning up Redis:', error);
    }
  }
}

// Global setup and teardown
beforeAll(async () => {
  // Try to connect to Redis, but don't fail if it's not available
  try {
    await getRedisClient();
  } catch (error) {
    console.warn('Redis not available, Redis tests will be skipped');
  }
});

afterAll(async () => {
  await cleanupRedis();
});

// Increase timeout for async operations
jest.setTimeout(30000);
