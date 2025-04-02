import { NoOpTelemetry, Telemetry } from "@nuvix/telemetry";
import { CacheAdapter } from "./interfaces/adapter";
import { EventEmitter } from "events";
import { performance } from "perf_hooks";

/**
 * Manages cache operations including get, set, delete, and clear.
 * Provides telemetry and event emission for cache operations.
 */
export class Cache {
  private adapter: CacheAdapter;
  private static caseSensitive = false;
  private telemetry: Telemetry;
  private eventEmitter: EventEmitter;
  private hits: number;
  private misses: number;
  private errors: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly defaultTTL: number;
  private readonly maxKeyLength: number;
  private readonly maxValueSize: number;

  /**
   * Creates an instance of Cache.
   * @param adapter - The cache adapter to use for cache operations.
   * @param telemetry - Optional telemetry instance for recording metrics.
   * @param options - Optional configuration options.
   */
  constructor(
    adapter: CacheAdapter,
    telemetry: Telemetry = new NoOpTelemetry() as any,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      defaultTTL?: number;
      maxKeyLength?: number;
      maxValueSize?: number;
    } = {},
  ) {
    this.adapter = adapter;
    this.telemetry = telemetry;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 100; // 100ms
    this.defaultTTL = options.defaultTTL ?? 3600; // 1 hour
    this.maxKeyLength = options.maxKeyLength ?? 512;
    this.maxValueSize = options.maxValueSize ?? 512 * 1024 * 1024; // 512MB

    this.eventEmitter = new EventEmitter();
    this.hits = 0;
    this.misses = 0;
    this.errors = 0;

    // Set up error handling
    this.eventEmitter.on("error", (error) => {
      console.error("Cache error:", error);
      this.errors++;
    });
  }

  /**
   * Sets the case sensitivity for cache keys.
   * @param value - Boolean indicating if keys should be case sensitive.
   */
  static setCaseSensitivity(value: boolean): void {
    this.caseSensitive = value;
  }

  /**
   * Normalizes the cache key based on case sensitivity setting.
   * @param key - The cache key to normalize.
   * @returns The normalized cache key.
   */
  private normalizeKey(key: string): string {
    if (key.length > this.maxKeyLength) {
      throw new Error(
        `Key length exceeds maximum allowed length of ${this.maxKeyLength} characters`,
      );
    }
    return Cache.caseSensitive ? key : key.toLowerCase();
  }

  /**
   * Validates a value before caching.
   * @param value - The value to validate.
   */
  private validateValue(value: unknown): void {
    try {
      JSON.stringify(value);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Invalid value: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Retries an operation with exponential backoff.
   * @param operation - The operation to retry.
   * @returns The result of the operation.
   */
  private async retry<T>(
    operation: () => Promise<T>,
    retries = this.maxRetries,
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.retryDelay;

    for (let i = 0; i <= retries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (i < retries) {
          // Exponential backoff with jitter
          const jitter = Math.random() * 100;
          await new Promise((resolve) => setTimeout(resolve, delay + jitter));
          delay *= 2; // Exponential increase
        }
      }
    }
    throw lastError;
  }

  /**
   * Records telemetry for an operation.
   * @param operation - The operation name.
   * @param duration - The operation duration.
   * @param key - The cache key.
   */
  private recordTelemetry(
    operation: string,
    duration: number,
    key: string,
  ): void {
    // Batch telemetry records to reduce overhead
    if (duration > 100) {
      // Only record slow operations
      this.telemetry.record(operation, duration, {
        adapterName: this.adapter.getName(key),
        key,
      });
    }
  }

  /**
   * Retrieves a value from the cache.
   * @param key - The cache key.
   * @param hash - Optional hash to further identify the cache entry.
   * @returns The cached value or null if not found.
   */
  async get<T>(key: string, hash = ""): Promise<T | null> {
    key = this.normalizeKey(key);
    hash = this.normalizeKey(hash);

    const start = performance.now();
    try {
      const result = await this.retry(() => this.adapter.get<T>(key, hash));
      const duration = performance.now() - start;

      if (result !== null) {
        this.hits++;
        this.eventEmitter.emit("hit", key);
      } else {
        this.misses++;
        this.eventEmitter.emit("miss", key);
      }

      // Only record telemetry for slow operations
      if (duration > 100) {
        this.recordTelemetry("get", duration, key);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordTelemetry("get_error", duration, key);
      this.eventEmitter.emit("error", error);
      return null;
    }
  }

  /**
   * Sets a value in the cache.
   * @param key - The cache key.
   * @param data - The data to cache.
   * @param ttl - Optional time-to-live for the cache entry.
   * @param hash - Optional hash to further identify the cache entry.
   * @returns Boolean indicating if the operation was successful.
   */
  async set<T = unknown>(
    key: string,
    data: T,
    ttl?: number,
    hash = "",
  ): Promise<boolean> {
    key = this.normalizeKey(key);
    hash = this.normalizeKey(hash);

    const start = performance.now();
    try {
      this.validateValue(data);
      const success = await this.retry(() =>
        this.adapter.set(key, data as any, ttl ?? this.defaultTTL, hash),
      );
      const duration = performance.now() - start;

      if (success) {
        this.eventEmitter.emit("set", key, data);
        // Only record telemetry for slow operations
        if (duration > 100) {
          this.recordTelemetry("set", duration, key);
        }
      } else {
        throw new Error("Failed to set value in cache");
      }

      return success;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordTelemetry("set_error", duration, key);
      this.eventEmitter.emit("error", error);
      throw error;
    }
  }

  /**
   * Deletes a value from the cache.
   * @param key - The cache key.
   * @param hash - Optional hash to further identify the cache entry.
   * @returns Boolean indicating if the operation was successful.
   */
  async delete(key: string, hash = ""): Promise<boolean> {
    key = this.normalizeKey(key);
    hash = this.normalizeKey(hash);

    const start = performance.now();
    try {
      const success = await this.retry(() => this.adapter.delete(key, hash));
      const duration = performance.now() - start;
      this.recordTelemetry("delete", duration, key);

      if (success) {
        this.eventEmitter.emit("delete", key);
      }

      return success;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordTelemetry("delete_error", duration, key);
      this.eventEmitter.emit("error", error);
      return false;
    }
  }

  /**
   * Clears all values from the cache.
   * @returns Boolean indicating if the operation was successful.
   */
  async clear(): Promise<boolean> {
    const start = performance.now();
    try {
      const success = await this.retry(() => this.adapter.clear());
      const duration = performance.now() - start;
      this.recordTelemetry("clear", duration, "");

      if (success) {
        this.eventEmitter.emit("clear");
      }

      return success;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordTelemetry("clear_error", duration, "");
      this.eventEmitter.emit("error", error);
      return false;
    }
  }

  /**
   * Retrieves all keys from the cache with the specified pattern.
   * @param pattern - The pattern to filter keys.
   * @param hash - Optional hash to filter keys.
   * @returns An array of cache keys.
   */
  async keys(pattern: string, hash?: string): Promise<string[]> {
    pattern = this.normalizeKey(pattern);
    hash = hash ? this.normalizeKey(hash) : "";

    const start = performance.now();
    try {
      const keys = await this.retry(() => this.adapter.keys(pattern, hash));
      const duration = performance.now() - start;
      this.recordTelemetry("keys", duration, pattern);
      return keys;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordTelemetry("keys_error", duration, pattern);
      this.eventEmitter.emit("error", error);
      return [];
    }
  }

  /**
   * Retrieves the size of the cache.
   * @returns The number of entries in the cache.
   */
  async getSize(): Promise<number> {
    const start = performance.now();
    try {
      const size = await this.retry(() => this.adapter.size());
      const duration = performance.now() - start;
      this.recordTelemetry("getSize", duration, "");
      return size;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordTelemetry("getSize_error", duration, "");
      this.eventEmitter.emit("error", error);
      return 0;
    }
  }

  /**
   * Checks if the cache adapter is alive.
   * @returns Boolean indicating if the adapter is alive.
   */
  async ping(): Promise<boolean> {
    const start = performance.now();
    try {
      const isAlive = await this.retry(() => this.adapter.isAlive());
      const duration = performance.now() - start;
      this.recordTelemetry("ping", duration, "");
      return isAlive;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordTelemetry("ping_error", duration, "");
      this.eventEmitter.emit("error", error);
      return false;
    }
  }

  /**
   * Retrieves cache statistics including hits, misses, and errors.
   * @returns An object containing cache statistics.
   */
  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
      hitRate: this.hits / (this.hits + this.misses) || 0,
    };
  }

  /**
   * Registers an event listener for cache events.
   * @param event - The event to listen for.
   * @param listener - The callback function to invoke when the event occurs.
   */
  on(
    event: "set" | "get" | "delete" | "clear" | "hit" | "miss" | "error",
    listener: (...args: any[]) => void,
  ): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Removes an event listener for cache events.
   * @param event - The event to remove the listener from.
   * @param listener - The callback function to remove.
   */
  off(
    event: "set" | "get" | "delete" | "clear" | "hit" | "miss" | "error",
    listener: (...args: any[]) => void,
  ): void {
    this.eventEmitter.off(event, listener);
  }

  async mget<T = unknown>(keys: string[], hash?: string): Promise<(T | null)[]> {
    return this.adapter.mget<T>(keys, hash);
  }

  async mset<T = unknown>(
    data: Record<string, T>,
    hash?: string,
    ttl?: number,
  ): Promise<boolean> {
    try {
      for (const value of Object.values(data)) {
        this.validateValue(value);
      }
      const result = await this.adapter.mset(data, hash, ttl);
      if (!result) {
        throw new Error("Failed to set values");
      }
      this.hits++;
      return true;
    } catch (error) {
      this.eventEmitter.emit("error", error);
      this.misses++;
      return false;
    }
  }

  async deleteMany(keys: string[], hash?: string): Promise<boolean> {
    const results = await Promise.all(
      keys.map((key) => this.delete(key, hash)),
    );
    return results.every((result) => result);
  }

  async extendTTL(key: string, ttl: number, hash?: string): Promise<boolean> {
    const value = await this.get(key, hash);
    if (value === null) {
      return false;
    }
    return this.set(key, value, ttl, hash);
  }
}
