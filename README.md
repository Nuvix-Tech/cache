# @nuvix/cache

A high-performance, enterprise-grade caching library with advanced features including namespace support, compression, tagging, batch operations, and comprehensive telemetry integration. Built with TypeScript for maximum type safety and supports both ESM and CommonJS.

## ✨ Features

- **🚀 Multiple Adapters**: Redis (enhanced), Memcached, Memory, and None (no-op) adapters
- **📦 Dual Module Support**: Full ESM and CommonJS compatibility with tree-shaking
- **🔧 TypeScript First**: Complete type safety with comprehensive type definitions
- **🏷️ Namespace Support**: Organize cache entries with namespaces for better isolation
- **🏷️ Tag-based Caching**: Group and invalidate related cache entries using tags
- **📊 Advanced Operations**: Batch operations, atomic transactions, and pipelines
- **🗜️ Compression**: Built-in gzip compression with configurable thresholds
- **📈 Telemetry Integration**: Built-in integration with `@nuvix/telemetry` for monitoring
- **⚡ Performance Optimized**: Efficient serialization, pipelining, and memory management
- **🎯 Modern & Legacy APIs**: Clean modern API with backward compatibility
- **🔄 TTL Support**: Flexible time-to-live functionality with per-key expiration
- **🛡️ Error Resilience**: Comprehensive error handling and graceful degradation
- **🔢 Atomic Operations**: Increment/decrement operations with Redis
- **🔍 Pattern Matching**: Advanced key discovery and pattern-based operations

## 📋 Installation

```bash
# Using npm
npm install @nuvix/cache

# Using yarn
yarn add @nuvix/cache

# Using bun
bun add @nuvix/cache
```

### Adapter Dependencies

Install the required dependencies for your chosen adapter:

```bash
# For Redis adapter (recommended)
npm install ioredis
# or
npm install redis

# For Memcached adapter  
npm install memcached @types/memcached
```

## 🚀 Quick Start

### ESM (ES Modules)
```typescript
import { Cache, Redis, Memory } from '@nuvix/cache';
// Or import individual adapters
import { Redis } from '@nuvix/cache/adapters/redis';
```

### CommonJS
```javascript
const { Cache, Redis, Memory } = require('@nuvix/cache');
// Or import individual adapters
const { Redis } = require('@nuvix/cache/adapters/redis');
```

### Basic Usage with Enhanced Redis Adapter

```typescript
import { Cache } from '@nuvix/cache';
import { Redis } from '@nuvix/cache/adapters/redis';
import IORedis from 'ioredis';

// Create enhanced Redis adapter with namespace and compression
const redisAdapter = new Redis({
  host: 'localhost',
  port: 6379,
  namespace: 'myapp',
  defaultTTL: 3600,
  enableCompression: true,
  compressionThreshold: 1024,
  keyPrefix: 'cache:',
  maxKeyLength: 250,
  maxValueSize: 512 * 1024 // 512KB
});

const cache = new Cache(redisAdapter);

// Set default namespace
cache.setDefaultNamespace('users');

// Modern API with advanced features
await cache.set('profile:123', { 
  name: 'John Doe', 
  email: 'john@example.com' 
}, {
  ttl: 1800, // 30 minutes
  tags: ['user', 'profile'],
  metadata: { source: 'database', version: 1 }
});

const profile = await cache.get('profile:123');
console.log(profile); // { name: 'John Doe', email: 'john@example.com' }
```

## 🎯 Advanced Usage Examples

### Namespace Management

```typescript
// Set default namespace for all operations
cache.setDefaultNamespace('session');

// Use specific namespace for operation
await cache.set('user:123', userData, { namespace: 'profiles' });

// Clear entire namespace
await cache.flushNamespace('session');

// Get all keys in namespace
const keys = await cache.getKeysByNamespace('profiles', 'user:*');
```

### Tag-based Cache Management

```typescript
// Cache with multiple tags
await cache.set('product:456', productData, {
  tags: ['products', 'electronics', 'featured'],
  ttl: 7200
});

await cache.set('category:electronics', categoryData, {
  tags: ['categories', 'electronics']
});

// Invalidate all items with specific tags
await cache.flushByTags(['electronics']);

// Find all keys with specific tags
const taggedKeys = await cache.getKeysByTags(['featured', 'products']);
```

### Batch Operations

```typescript
// Set multiple values at once
await cache.mset({
  'user:1': { name: 'Alice', role: 'admin' },
  'user:2': { name: 'Bob', role: 'user' },
  'user:3': { name: 'Charlie', role: 'moderator' }
}, { ttl: 3600, tags: ['users'] });

// Get multiple values at once
const users = await cache.mget(['user:1', 'user:2', 'user:3']);

// Delete multiple keys
const deletedCount = await cache.deleteMany(['user:1', 'user:2']);
```

### Atomic Operations

```typescript
// Increment/decrement counters
const views = await cache.increment('page:views:home', 1);
const downloads = await cache.decrement('quota:downloads:user123', 1);

// Set with expiration
await cache.set('temp:token:abc123', tokenData, { ttl: 300 }); // 5 minutes

// Update TTL for existing key
await cache.expire('session:xyz789', 1800); // Extend to 30 minutes

// Check TTL
const timeLeft = await cache.ttl('session:xyz789');
```

### Pipeline Operations (Redis Only)

```typescript
// Use pipeline for efficient batch operations
const pipeline = cache.pipeline();
if (pipeline) {
  pipeline
    .set('key1', 'value1', { ttl: 300 })
    .set('key2', 'value2', { ttl: 600 })
    .get('existing-key')
    .del('old-key')
    .expire('another-key', 900);
    
  const results = await pipeline.exec();
  console.log('Pipeline results:', results);
}
```

### Compression and Metadata

```typescript
// Large objects are automatically compressed (if enabled)
await cache.set('large-dataset', hugejsonObject, {
  compression: true,
  metadata: { 
    source: 'analytics-api',
    generatedAt: Date.now(),
    version: '2.1.0'
  }
});

// Get with metadata
const result = await cache.get('large-dataset', { includeMetadata: true });
console.log(result.data); // Your data
console.log(result.metadata); // Metadata
console.log(result.createdAt); // Timestamp
```
## 🔧 Telemetry Integration

```typescript
import { Cache } from '@nuvix/cache';
import { Redis } from '@nuvix/cache/adapters/redis';
import { Telemetry } from '@nuvix/telemetry';
import IORedis from 'ioredis';

const redisClient = new IORedis();
const redisAdapter = new Redis(redisClient);
const cache = new Cache(redisAdapter);

// Add telemetry for performance monitoring
const telemetry = new Telemetry();
cache.setTelemetry(telemetry);

// Operations will now be tracked with timing histograms
await cache.save('monitored-key', { data: 'value' });
const value = await cache.load('monitored-key', 3600);
```

## 🎛️ Configuration Options

### Case Sensitivity

```typescript
// Toggle case sensitivity for cache keys
cache.setCaseSensitivity(true);  // Keys are case-sensitive
cache.setCaseSensitivity(false); // Keys are case-insensitive (default)
```

## 📚 API Reference

### Cache Class

#### Constructor
- `new Cache(adapter: Adapter)` - Create cache instance with specified adapter

#### Methods
- `load<T>(key: string, ttl: number, hash?: string): Promise<T | false>` - Load cached data
- `save<T>(key: string, data: T, hash?: string): Promise<T | false>` - Save data to cache  
- `list(key: string): Promise<string[]>` - Get list of keys matching pattern
- `purge(key: string, hash?: string): Promise<boolean>` - Delete cached item
- `flush(): Promise<boolean>` - Clear all cached data
- `ping(): Promise<boolean>` - Check cache connectivity
- `getSize(): Promise<number>` - Get cache storage size
- `setTelemetry(telemetry: Telemetry): void` - Set telemetry adapter
- `setCaseSensitivity(value: boolean): boolean` - Toggle case sensitivity

### Adapter Interface

All adapters implement the same interface:

```typescript
interface Adapter {
  load<T>(key: string, ttl: number, hash?: string): Promise<T | null>;
  save<T>(key: string, data: T, hash?: string): Promise<boolean>;
  list(key: string): Promise<string[]>;
  purge(key: string, hash?: string): Promise<boolean>;
  flush(): Promise<boolean>;
  ping(): Promise<boolean>;
  getSize(): Promise<number>;
  getName(key?: string): string;
}
```

### Redis Adapter

- **Constructor**: `new Redis(redisClient: RedisClientType)`
- **Features**: Uses Redis hash operations for storage with JSON serialization
- **Requirements**: Requires `redis` or `ioredis` client instance

### Memory Adapter

- **Constructor**: `new Memory()`
- **Features**: In-memory storage, perfect for development and testing
- **Limitations**: Data doesn't persist across process restarts

### Memcached Adapter

- **Constructor**: `new MemcachedAdapter(memcachedClient: Memcached)`
- **Features**: Distributed caching with Memcached protocol
- **Requirements**: Requires `memcached` client instance
- **Limitations**: `list()` method returns empty array (Memcached limitation)

### None Adapter

- **Constructor**: `new None()`
- **Features**: No-operation adapter, useful for testing or disabling cache
- **Behavior**: All methods return empty/false values without errors

## 📦 Module Exports

The package provides multiple export formats for maximum compatibility:

### Main Entry Points

```typescript
// Import everything
import { Cache, Redis, Memory, MemcachedAdapter, None, Adapter } from '@nuvix/cache';

// Import specific adapters
import { Redis } from '@nuvix/cache/adapters/redis';
import { Memory } from '@nuvix/cache/adapters/memory';
import { MemcachedAdapter } from '@nuvix/cache/adapters/memcached';
import { None } from '@nuvix/cache/adapters/none';
```

### CommonJS Support

```javascript
const { Cache, Redis, Memory } = require('@nuvix/cache');
const { Redis } = require('@nuvix/cache/adapters/redis');
```

## 🛠️ Development & Building

```bash
# Install dependencies
bun install

# Build for production (ESM + CJS)
bun run build

# Build with watch mode
bun run build:watch

# Run tests
bun run test

# Run tests with coverage
bun run test:coverage

# Lint code
bun run lint

# Format code
bun run format
```

## 📊 Performance Characteristics

| Adapter | Speed | Memory Usage | Persistence | Scalability |
|---------|-------|--------------|-------------|-------------|
| Memory | ⚡⚡⚡⚡ | 🔴 High | ❌ No | ⚠️ Single Instance |
| Redis | ⚡⚡⚡ | 🟡 Medium | ✅ Yes | ✅ Distributed |
| Memcached | ⚡⚡⚡ | 🟢 Low | ❌ No | ✅ Distributed |
| None | ⚡⚡⚡⚡ | 🟢 Minimal | ❌ N/A | ✅ N/A |

## 🏗️ Architecture

```
@nuvix/cache
├── Cache (Main class)
├── Adapters/
│   ├── Redis (ioredis/redis client)
│   ├── Memory (in-memory storage)
│   ├── Memcached (memcached client)
│   └── None (no-op adapter)
├── Interfaces/
│   └── Adapter (common interface)
└── Telemetry Integration
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/nuvix-tech/cache.git
cd cache

# Install dependencies
bun install

# Run tests
bun run test

# Build the project
bun run build
```

## 📄 License

This project is licensed under the BSD 3-Clause License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 [Documentation](https://github.com/nuvix-tech/cache#readme)
- 🐛 [Report Issues](https://github.com/nuvix-tech/cache/issues)
- 💬 [Discussions](https://github.com/nuvix-tech/cache/discussions)

## 🏆 Credits

Built with ❤️ by the [Nuvix](https://nuvix.tech) team.

---

### Related Packages

- [`@nuvix/telemetry`](https://www.npmjs.com/package/@nuvix/telemetry) - Telemetry and monitoring integration
