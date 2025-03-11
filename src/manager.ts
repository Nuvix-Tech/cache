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
  private eventEmitter = new EventEmitter();
  private hits = 0;
  private misses = 0;

  /**
   * Creates an instance of Cache.
   * @param adapter - The cache adapter to use for cache operations.
   * @param telemetry - Optional telemetry instance for recording metrics.
   */
  constructor(
    adapter: CacheAdapter,
    telemetry: Telemetry = new NoOpTelemetry() as any,
  ) {
    this.adapter = adapter;
    this.telemetry = telemetry;
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
    return Cache.caseSensitive ? key : key.toLowerCase();
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
    const result = await this.adapter.get<T>(key, hash);
    const duration = performance.now() - start;
    this.telemetry.record("get", duration, {
      adapterName: this.adapter.getName(key),
    });

    if (result !== null) {
      this.hits++;
      this.eventEmitter.emit("hit", key);
    } else {
      this.misses++;
      this.eventEmitter.emit("miss", key);
    }

    return result;
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
      const success = await this.adapter.set(key, data as any, ttl, hash);
      if (success) this.eventEmitter.emit("set", key, data);
      return success;
    } finally {
      const duration = performance.now() - start;
      this.telemetry.record("set", duration, {
        adapterName: this.adapter.getName(key),
      });
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
    const success = await this.adapter.delete(key, hash);
    const duration = performance.now() - start;
    this.telemetry.record("delete", duration, {
      adapterName: this.adapter.getName(key),
    });
    if (success) this.eventEmitter.emit("delete", key);
    return success;
  }

  /**
   * Clears all values from the cache.
   * @returns Boolean indicating if the operation was successful.
   */
  async clear(): Promise<boolean> {
    const start = performance.now();
    const success = await this.adapter.clear();
    const duration = performance.now() - start;
    this.telemetry.record("clear", duration, {
      adapterName: this.adapter.getName(),
    });
    if (success) this.eventEmitter.emit("clear");
    return success;
  }

  /**
   * Retrieves all keys from the cache with the specified pattern.
   * @param pattern - The pattern to filter keys.
   * @returns An array of cache keys.
   */
  async keys(pattern: string, hash?: string): Promise<string[]> {
    pattern = this.normalizeKey(pattern);
    const start = performance.now();
    const keys = await this.adapter.keys(pattern, hash);
    const duration = performance.now() - start;
    this.telemetry.record("keys", duration, {
      adapterName: this.adapter.getName(pattern),
    });
    return keys;
  }

  /**
   * Retrieves the size of the cache.
   * @returns The number of entries in the cache.
   */
  async getSize(): Promise<number> {
    const start = performance.now();
    const size = await this.adapter.size();
    const duration = performance.now() - start;
    this.telemetry.record("getSize", duration, {
      adapterName: this.adapter.getName(),
    });
    return size;
  }

  /**
   * Checks if the cache adapter is alive.
   * @returns Boolean indicating if the adapter is alive.
   */
  async ping(): Promise<boolean> {
    return await this.adapter.isAlive();
  }

  /**
   * Retrieves cache statistics including hits and misses.
   * @returns An object containing hits and misses.
   */
  getStats() {
    return { hits: this.hits, misses: this.misses };
  }

  /**
   * Registers an event listener for cache events.
   * @param event - The event to listen for.
   * @param listener - The callback function to invoke when the event occurs.
   */
  on(
    event: "set" | "get" | "delete" | "clear" | "hit" | "miss",
    listener: (...args: any[]) => void,
  ): void {
    this.eventEmitter.on(event, listener);
  }
}
