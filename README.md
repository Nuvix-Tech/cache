# Nuvix Cache

## Overview
Nuvix Cache provides a flexible and efficient caching system with an adapter-based architecture, allowing support for multiple caching backends. The package includes telemetry integration for performance monitoring and optional event listeners for cache changes.

## Features
- **Adapter System:** Easily switch between different cache backends (e.g., Redis, Memory, etc.).
- **Telemetry Support:** Built-in integration with `@nuvix/telemetry` to monitor cache performance.
- **Event Listeners:** Subscribe to cache events such as `set`, `get`, `delete`, and `clear`.
- **Stats Tracking:** Tracks cache hits and misses for improved analytics.
- **Namespace Support:** Organize cache keys using namespaces.
- **Performance Optimized:** Uses efficient storage mechanisms and supports TTL (time-to-live).

## Installation
```sh
npm install @nuvix/cache ioredis
```

## Usage

### Creating a Cache Instance
```ts
import { Cache } from "@nuvix/cache";
import {Redis as RedisAdapter } from "@nuvix/cache";
import Redis from "ioredis";
import { Telemetry } from "@nuvix/telemetry";

const redis = new Redis();
const telemetry = new Telemetry();
const cache = new Cache(new RedisAdapter(redis), telemetry);
```

### Storing and Retrieving Data
```ts
await cache.set("user:123", { name: "John Doe" });
const user = await cache.get("user:123");
console.log(user); // { name: "John Doe" }
```

### Deleting and Clearing Cache
```ts
await cache.delete("user:123");
await cache.clear();
```

### Checking Cache Status
```ts
if (await cache.ping()) {
    console.log("Cache is alive!");
}
```

## Adapters
The following cache adapters are supported:
- **Redis:** Uses Redis for caching (recommended for distributed applications).
- **Memory:** (Planned) In-memory cache for fast local storage.

## API Reference

### `Cache`
- `set(key: string, value: any, namespace?: string): Promise<boolean>` – Stores a value in cache.
- `get<T>(key: string, ttl: number, namespace?: string): Promise<T | null>` – Retrieves a value from cache.
- `delete(key: string, namespace?: string): Promise<boolean>` – Deletes a key from cache.
- `clear(): Promise<boolean>` – Clears all cache entries.
- `keys(pattern: string): Promise<string[]>` – Returns cache keys matching a pattern.
- `ping(): Promise<boolean>` – Checks if the cache backend is available.
- `getSize(): Promise<number>` – Retrieves the total cache size.

### `CacheAdapter`
Each adapter implements the `CacheAdapter` interface. Custom adapters can be created to support additional caching mechanisms.

## License
This project is licensed under the BSD 3-Clause License.

---

Made with ❤️ by Nuvix.

