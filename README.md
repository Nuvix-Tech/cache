# @nuvix/cache

A high-performance, flexible caching library with multiple adapter support including Redis, Memcached, and in-memory storage. Built with TypeScript for type safety and optimal performance, with full ESM and CommonJS support.

## ✨ Features

- **🚀 Multiple Adapters**: Redis, Memcached, Memory, and None (no-op) adapters
- **📦 Dual Module Support**: Full ESM and CommonJS compatibility
- **🔧 TypeScript First**: Complete type safety with comprehensive type definitions
- **📊 Telemetry Integration**: Built-in integration with `@nuvix/telemetry` for monitoring
- **⚡ Performance Optimized**: Efficient serialization and storage mechanisms
- **🎯 Simple API**: Consistent interface across all adapters
- **🔄 TTL Support**: Time-to-live functionality for automatic expiration
- **🛡️ Error Resilience**: Graceful error handling and fallback mechanisms

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
# For Redis adapter
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

### Basic Usage

```typescript
import { Cache } from '@nuvix/cache';
import { Memory } from '@nuvix/cache/adapters/memory';

// Create cache with memory adapter
const memoryAdapter = new Memory();
const cache = new Cache(memoryAdapter);

// Basic operations
await cache.save('user:123', { name: 'John Doe', age: 30 });
const user = await cache.load('user:123', 3600); // TTL: 1 hour
await cache.purge('user:123');
```

## 🎯 Usage Examples

### Redis Adapter

```typescript
import { Cache } from '@nuvix/cache';
import { Redis } from '@nuvix/cache/adapters/redis';
import IORedis from 'ioredis';

// Create Redis client
const redisClient = new IORedis({
  host: 'localhost',
  port: 6379,
  retryDelayOnFailover: 100,
});

// Create Redis adapter and cache
const redisAdapter = new Redis(redisClient);
const cache = new Cache(redisAdapter);

// Use the cache
await cache.save('product:456', {
  id: 456,
  name: 'Awesome Product',
  price: 99.99
});

const product = await cache.load('product:456', 1800); // 30 minutes TTL
console.log(product); // { id: 456, name: 'Awesome Product', price: 99.99 }
```

### Memory Adapter

```typescript
import { Cache } from '@nuvix/cache';
import { Memory } from '@nuvix/cache/adapters/memory';

const memoryAdapter = new Memory();
const cache = new Cache(memoryAdapter);

// Perfect for development or single-instance applications
await cache.save('session:abc123', { userId: 1, permissions: ['read', 'write'] });
const session = await cache.load('session:abc123', 900); // 15 minutes TTL
```

### Memcached Adapter

```typescript
import { Cache } from '@nuvix/cache';
import { MemcachedAdapter } from '@nuvix/cache/adapters/memcached';
import Memcached from 'memcached';

const memcachedClient = new Memcached('localhost:11211');
const memcachedAdapter = new MemcachedAdapter(memcachedClient);
const cache = new Cache(memcachedAdapter);

await cache.save('config:app', { theme: 'dark', language: 'en' });
const config = await cache.load('config:app', 7200); // 2 hours TTL
```

### None Adapter (No-op)

```typescript
import { Cache } from '@nuvix/cache';
import { None } from '@nuvix/cache/adapters/none';

// Useful for testing or when you want to disable caching
const noneAdapter = new None();
const cache = new Cache(noneAdapter);

// All operations return false/empty but don't throw errors
await cache.save('key', 'value'); // returns false
const value = await cache.load('key', 3600); // returns false
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
