import IORedis from "ioredis";
import { EventEmitter } from "events";
import { CacheAdapter } from "../interfaces/adapter";

interface RedisOptions {
  host?: string;
  port?: number;
  password?: string;
  tls?: boolean;
  namespace?: string;
}

export class RedisAdapter implements CacheAdapter {
  private client: IORedis;
  private namespace: string;
  private eventEmitter: EventEmitter;

  constructor(options: RedisOptions = {}) {
    const { tls, ...redisOptions } = options;
    this.namespace = options.namespace ?? "cache";
    this.eventEmitter = new EventEmitter();

    if (tls) {
      this.client = new IORedis({
        ...redisOptions,
        tls: { rejectUnauthorized: false },
      });
    } else {
      this.client = new IORedis(redisOptions);
    }

    this.client.on("error", (error) => {
      this.eventEmitter.emit("error", error);
    });
  }

  private getKey(key: string, hash?: string): string {
    // Convert empty string hash to undefined to ensure consistent behavior
    if (hash === "") {
      hash = undefined;
    }
    return hash
      ? `${this.namespace}:${key}::${hash}`
      : `${this.namespace}:${key}`;
  }

  async set(
    key: string,
    value: any,
    ttl?: number,
    hash?: string,
  ): Promise<boolean> {
    try {
      const fullKey = this.getKey(key, hash);
      const serializedValue = JSON.stringify(value);

      let result;
      // Setting a short TTL (1 second) in tests can sometimes not expire quickly enough
      // This ensures TTL is set correctly and expires as expected
      if (ttl && ttl > 0) {
        // Use EX option with TTL for expiration in seconds
        result = await this.client.set(fullKey, serializedValue, "EX", ttl);

        // Force an explicit TTL check - this helps Redis expire the key properly
        await this.client.ttl(fullKey);
      } else {
        result = await this.client.set(fullKey, serializedValue);
      }

      if (result !== "OK") {
        throw new Error(`Failed to set value${ttl ? " with TTL" : ""}`);
      }
      return true;
    } catch (error) {
      this.eventEmitter.emit("error", error);
      return false;
    }
  }

  async get(key: string, hash?: string): Promise<any | null> {
    try {
      const fullKey = this.getKey(key, hash);

      // Check for TTL first, if it's -2, the key has expired
      const keyTTL = await this.client.ttl(fullKey);
      if (keyTTL === -2) {
        // Key has expired, explicitly delete it to ensure consistency
        await this.client.del(fullKey);
        return null;
      }

      // Check if the key exists at all
      const exists = await this.client.exists(fullKey);
      if (!exists) {
        return null;
      }

      const value = await this.client.get(fullKey);
      if (!value) return null;
      return JSON.parse(value);
    } catch (error) {
      this.eventEmitter.emit("error", error);
      return null;
    }
  }

  async delete(key: string, hash?: string): Promise<boolean> {
    try {
      const fullKey = this.getKey(key, hash);
      const res = await this.client.del(fullKey);
      return res === 1;
    } catch (error) {
      this.eventEmitter.emit("error", error);
      return false;
    }
  }

  async mget(keys: string[], hash?: string): Promise<(any | null)[]> {
    try {
      const fullKeys = keys.map((key) => this.getKey(key, hash));
      const values = await this.client.mget(...fullKeys);

      return values.map((value) => {
        if (!value) return null;
        try {
          return JSON.parse(value) as any;
        } catch (error) {
          this.eventEmitter.emit("error", error);
          return null;
        }
      });
    } catch (error) {
      this.eventEmitter.emit("error", error);
      return new Array(keys.length).fill(null);
    }
  }

  async mset(
    data: Record<string, any>,
    hash?: string,
    ttl?: number,
  ): Promise<boolean> {
    try {
      const pipeline = this.client.pipeline();

      for (const [key, value] of Object.entries(data)) {
        const fullKey = this.getKey(key, hash);
        const serializedValue = JSON.stringify(value);

        if (ttl) {
          pipeline.set(fullKey, serializedValue, "EX", ttl);
        } else {
          pipeline.set(fullKey, serializedValue);
        }
      }

      const results = await pipeline.exec();
      if (!results) return false;
      return results.every(([err, result]) => !err && result === "OK");
    } catch (error) {
      this.eventEmitter.emit("error", error);
      return false;
    }
  }

  async deleteMany(keys: string[], hash?: string): Promise<boolean> {
    try {
      const fullKeys = keys.map((key) => this.getKey(key, hash));
      await this.client.del(...fullKeys);
      return true;
    } catch (error) {
      this.eventEmitter.emit("error", error);
      return false;
    }
  }

  async keys(pattern: string, hash?: string): Promise<string[]> {
    try {
      if (hash) {
        // Use :: as the separator to match the format used in getKey
        const fullPattern = `${this.namespace}:${pattern}::${hash}`;
        return await this.client.keys(fullPattern);
      } else {
        // Return raw keys without processing them
        return await this.client.keys(`${this.namespace}:${pattern}`);
      }
    } catch (error) {
      this.eventEmitter.emit("error", error);
      return [];
    }
  }

  async ttl(key: string, hash?: string): Promise<number> {
    try {
      const fullKey = this.getKey(key, hash);
      return await this.client.ttl(fullKey);
    } catch (error) {
      this.eventEmitter.emit("error", error);
      return -1;
    }
  }

  async extendTTL(key: string, ttl: number, hash?: string): Promise<boolean> {
    try {
      const fullKey = this.getKey(key, hash);
      const exists = await this.client.exists(fullKey);
      if (!exists) return false;
      const result = await this.client.expire(fullKey, ttl);
      if (result !== 1) {
        throw new Error("Failed to extend TTL");
      }
      return true;
    } catch (error) {
      this.eventEmitter.emit("error", error);
      return false;
    }
  }

  async clear(hash?: string): Promise<boolean> {
    try {
      const pattern = hash
        ? `${this.namespace}:*::${hash}`
        : `${this.namespace}:*`;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return true;
    } catch (error) {
      this.eventEmitter.emit("error", error);
      return false;
    }
  }

  async isAlive(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      this.eventEmitter.emit("error", error);
      return false;
    }
  }

  async size(): Promise<number> {
    try {
      const keys = await this.client.keys(`${this.namespace}:*`);
      return keys.length;
    } catch (error) {
      this.eventEmitter.emit("error", error);
      return 0;
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error) {
      this.eventEmitter.emit("error", error);
    }
  }

  getName(): string {
    return "redis";
  }
}
