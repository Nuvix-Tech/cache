# Nuvix Cache

A high-performance, flexible caching library with Redis support, compression, and telemetry integration. Built with TypeScript for type safety and optimal performance.

## Features

- **Redis Support**: Built-in Redis adapter with optimized performance
- **Compression**: Automatic compression for large values with configurable thresholds
- **Telemetry Integration**: Built-in integration with `@nuvix/telemetry` for performance monitoring
- **Event System**: Subscribe to cache events (hit, miss, set, delete, error)
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Performance Optimizations**:
  - Connection pooling
  - Batch operations
  - Parallel processing
  - Efficient serialization
- **Resource Management**:
  - Configurable key length limits
  - Value size restrictions
  - Memory optimization
  - Connection cleanup
- **Error Handling**:
  - Automatic retries
  - Graceful degradation
  - Comprehensive error events
  - Error statistics tracking

## Installation

```sh
npm install @nuvix/cache ioredis
```

## Quick Start

```ts
import { Cache } from "@nuvix/cache";
import { Redis } from "@nuvix/cache/adapters/redis";
import { Telemetry } from "@nuvix/telemetry";

// Create Redis adapter with options
const redis = new Redis({
  host: "localhost",
  port: 6379,
  useCompression: true,
  compressionThreshold: 1024,
  maxKeyLength: 255,
  maxValueSize: 512 * 1024, // 512KB
  namespace: "my-app",
});

// Create telemetry instance
const telemetry = new Telemetry();

// Create cache instance
const cache = new Cache(redis, telemetry);

// Set up event listeners
cache.on("hit", (key) => console.log(`Cache hit: ${key}`));
cache.on("miss", (key) => console.log(`Cache miss: ${key}`));
cache.on("error", (error) => console.error(`Cache error: ${error}`));

// Use the cache
await cache.set("user:123", { name: "John Doe" }, 3600); // 1 hour TTL
const user = await cache.get("user:123");
```

## Advanced Usage

### Batch Operations

```ts
// Set multiple values
await cache.mset({
  "user:1": { name: "John" },
  "user:2": { name: "Jane" },
  "user:3": { name: "Bob" },
});

// Get multiple values
const users = await cache.mget(["user:1", "user:2", "user:3"]);
```

### Pattern Matching

```ts
// Find all keys matching a pattern
const keys = await cache.keys("user:*");
```

### Statistics and Monitoring

```ts
// Get cache statistics
const stats = cache.getStats();
console.log(`Hits: ${stats.hits}, Misses: ${stats.misses}`);

// Check cache health
const isAlive = await cache.ping();
```

## Configuration Options

### Redis Adapter Options

```ts
interface RedisOptions {
  host?: string; // Redis host (default: "localhost")
  port?: number; // Redis port (default: 6379)
  db?: number; // Redis database (default: 0)
  useCompression?: boolean; // Enable compression (default: false)
  compressionThreshold?: number; // Minimum size for compression (default: 1024)
  maxKeyLength?: number; // Maximum key length (default: 255)
  maxValueSize?: number; // Maximum value size (default: 512KB)
  namespace?: string; // Key namespace (default: "cache")
  tls?: boolean | object; // TLS configuration
  maxRetriesPerRequest?: number; // Maximum retries (default: 3)
  retryStrategy?: (times: number) => number; // Custom retry strategy
  connectTimeout?: number; // Connection timeout (default: 10000ms)
  commandTimeout?: number; // Command timeout (default: 5000ms)
  keepAlive?: number; // Keep-alive interval (default: 30000ms)
  family?: number; // IP family (default: 4)
}
```

### Cache Manager Options

```ts
interface CacheOptions {
  maxRetries?: number; // Maximum retries (default: 3)
  retryDelay?: number; // Retry delay in ms (default: 100)
  defaultTTL?: number; // Default TTL in seconds (default: 3600)
  maxKeyLength?: number; // Maximum key length (default: 512)
  maxValueSize?: number; // Maximum value size (default: 512MB)
}
```

## API Reference

### Cache Manager

- `set(key: string, value: T, ttl?: number): Promise<boolean>`
- `get<T>(key: string): Promise<T | null>`
- `delete(key: string): Promise<boolean>`
- `clear(): Promise<boolean>`
- `keys(pattern: string): Promise<string[]>`
- `ping(): Promise<boolean>`
- `getStats(): { hits: number; misses: number; errors: number }`
- `on(event: string, listener: (...args: any[]) => void): void`
- `off(event: string, listener: (...args: any[]) => void): void`

### Redis Adapter

- `get<T>(key: string, hash?: string): Promise<T | null>`
- `set<T>(key: string, value: T, ttl?: number, hash?: string): Promise<boolean>`
- `mget<T>(keys: string[], hash?: string): Promise<(T | null)[]>`
- `mset(data: Record<string, T>, hash?: string, ttl?: number): Promise<boolean>`
- `delete(key: string, hash?: string): Promise<boolean>`
- `deleteMany(keys: string[], hash?: string): Promise<boolean>`
- `clear(hash?: string): Promise<boolean>`
- `keys(pattern: string, hash?: string): Promise<string[]>`
- `size(): Promise<number>`
- `isAlive(): Promise<boolean>`
- `extendTTL(key: string, ttl: number, hash?: string): Promise<boolean>`
- `close(): Promise<void>`

## Events

The cache manager emits the following events:

- `hit`: Emitted when a cache hit occurs
- `miss`: Emitted when a cache miss occurs
- `set`: Emitted when a value is set
- `delete`: Emitted when a value is deleted
- `error`: Emitted when an error occurs

## Performance Considerations

1. **Compression**: Enable compression for values larger than 1KB
2. **Batch Operations**: Use `mset` and `mget` for multiple operations
3. **Connection Pooling**: Reuse Redis connections
4. **Error Handling**: Implement retry strategies for resilience
5. **Monitoring**: Use telemetry for performance tracking

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the BSD 3-Clause License - see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by Nuvix.
