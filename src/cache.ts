import { type Histogram, None, Adapter as Telemetry } from "@nuvix/telemetry";
import {
  Adapter,
  EnhancedAdapter,
  CacheOptions,
  CacheStats,
} from "./interfaces/adapter.js";

export class Cache {
  private adapter: Adapter | EnhancedAdapter;

  /**
   * If cache keys are case-sensitive
   */
  public caseSensitive: boolean = false;

  /**
   * Default namespace for cache operations
   */
  public defaultNamespace: string = "default";

  /**
   * Histogram for tracking operation duration
   */
  protected operationDuration: Histogram | null = null;

  /**
   * Set telemetry adapter and create histograms for cache operations.
   */
  public setTelemetry(telemetry: Telemetry): void {
    this.operationDuration = telemetry.createHistogram(
      "cache.operation.duration",
      "s",
      null,
      {
        ExplicitBucketBoundaries: [
          0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1,
        ],
      } as any, // TODO: ----
    );
  }

  /**
   * Initialize with a no-op telemetry adapter by default.
   */
  constructor(adapter: Adapter | EnhancedAdapter) {
    this.adapter = adapter;
    this.setTelemetry(new None());
  }

  /**
   * Toggle case sensitivity of keys inside cache
   */
  public setCaseSensitivity(value: boolean): boolean {
    return (this.caseSensitive = value);
  }

  /**
   * Set default namespace for cache operations
   */
  public setDefaultNamespace(namespace: string): void {
    this.defaultNamespace = namespace;
    if (this.isEnhancedAdapter(this.adapter)) {
      this.adapter.setNamespace(namespace);
    }
  }

  /**
   * Get default namespace
   */
  public getDefaultNamespace(): string {
    return this.defaultNamespace;
  }

  private isEnhancedAdapter(
    adapter: Adapter | EnhancedAdapter,
  ): adapter is EnhancedAdapter {
    return "set" in adapter && "get" in adapter;
  }

  private normalizeKey(key: string): string {
    return this.caseSensitive ? key : key.toLowerCase();
  }

  private recordOperation(
    operation: string,
    duration: number,
    adapter?: string,
  ): void {
    this.operationDuration?.record(duration, {
      operation,
      adapter: adapter || this.adapter.getName(),
    });
  }

  // Enhanced methods for modern API
  public async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {},
  ): Promise<boolean> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    key = this.normalizeKey(key);
    const start = Date.now();

    try {
      const cacheOptions: CacheOptions = {
        namespace: this.defaultNamespace,
        ...options,
      };

      const result = await this.adapter.set(key, value, cacheOptions);
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("set", duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("set_error", duration);
      throw error;
    }
  }

  public async get<T>(
    key: string,
    options: { includeMetadata?: boolean } & CacheOptions = {},
  ): Promise<T | null> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    key = this.normalizeKey(key);
    const start = Date.now();

    try {
      const cacheOptions = {
        namespace: this.defaultNamespace,
        ...options,
      };

      const result = await this.adapter.get<T>(key, cacheOptions);
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("get", duration);
      return result as T | null;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("get_error", duration);
      throw error;
    }
  }

  public async mget<T>(
    keys: string[],
    options: CacheOptions = {},
  ): Promise<(T | null)[]> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    const normalizedKeys = keys.map((key) => this.normalizeKey(key));
    const start = Date.now();

    try {
      const cacheOptions = {
        namespace: this.defaultNamespace,
        ...options,
      };

      const result = await this.adapter.mget<T>(normalizedKeys, cacheOptions);
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("mget", duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("mget_error", duration);
      throw error;
    }
  }

  public async mset<T>(
    entries: Record<string, T>,
    options: CacheOptions = {},
  ): Promise<boolean> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    const normalizedEntries: Record<string, T> = {};
    for (const [key, value] of Object.entries(entries)) {
      normalizedEntries[this.normalizeKey(key)] = value;
    }

    const start = Date.now();

    try {
      const cacheOptions = {
        namespace: this.defaultNamespace,
        ...options,
      };

      const result = await this.adapter.mset(normalizedEntries, cacheOptions);
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("mset", duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("mset_error", duration);
      throw error;
    }
  }

  public async delete(
    key: string,
    options: CacheOptions = {},
  ): Promise<boolean> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    key = this.normalizeKey(key);
    const start = Date.now();

    try {
      const cacheOptions = {
        namespace: this.defaultNamespace,
        ...options,
      };

      const result = await this.adapter.mdel([key], cacheOptions);
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("delete", duration);
      return result > 0;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("delete_error", duration);
      throw error;
    }
  }

  public async deleteMany(
    keys: string[],
    options: CacheOptions = {},
  ): Promise<number> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    const normalizedKeys = keys.map((key) => this.normalizeKey(key));
    const start = Date.now();

    try {
      const cacheOptions = {
        namespace: this.defaultNamespace,
        ...options,
      };

      const result = await this.adapter.mdel(normalizedKeys, cacheOptions);
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("delete_many", duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("delete_many_error", duration);
      throw error;
    }
  }

  public async exists(
    key: string,
    options: CacheOptions = {},
  ): Promise<boolean> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    key = this.normalizeKey(key);
    const start = Date.now();

    try {
      const cacheOptions = {
        namespace: this.defaultNamespace,
        ...options,
      };

      const result = await this.adapter.exists(key, cacheOptions);
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("exists", duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("exists_error", duration);
      throw error;
    }
  }

  public async expire(
    key: string,
    ttl: number,
    options: CacheOptions = {},
  ): Promise<boolean> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    key = this.normalizeKey(key);
    const start = Date.now();

    try {
      const cacheOptions = {
        namespace: this.defaultNamespace,
        ...options,
      };

      const result = await this.adapter.expire(key, ttl, cacheOptions);
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("expire", duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("expire_error", duration);
      throw error;
    }
  }

  public async ttl(key: string, options: CacheOptions = {}): Promise<number> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    key = this.normalizeKey(key);
    const start = Date.now();

    try {
      const cacheOptions = {
        namespace: this.defaultNamespace,
        ...options,
      };

      const result = await this.adapter.ttl(key, cacheOptions);
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("ttl", duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("ttl_error", duration);
      throw error;
    }
  }

  public async increment(
    key: string,
    amount: number = 1,
    options: CacheOptions = {},
  ): Promise<number> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    key = this.normalizeKey(key);
    const start = Date.now();

    try {
      const cacheOptions = {
        namespace: this.defaultNamespace,
        ...options,
      };

      const result = await this.adapter.increment(key, amount, cacheOptions);
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("increment", duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("increment_error", duration);
      throw error;
    }
  }

  public async decrement(
    key: string,
    amount: number = 1,
    options: CacheOptions = {},
  ): Promise<number> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    key = this.normalizeKey(key);
    const start = Date.now();

    try {
      const cacheOptions = {
        namespace: this.defaultNamespace,
        ...options,
      };

      const result = await this.adapter.decrement(key, amount, cacheOptions);
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("decrement", duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("decrement_error", duration);
      throw error;
    }
  }

  public async flushNamespace(namespace?: string): Promise<boolean> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    const targetNamespace = namespace || this.defaultNamespace;
    const start = Date.now();

    try {
      const result = await this.adapter.flushNamespace(targetNamespace);
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("flush_namespace", duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("flush_namespace_error", duration);
      throw error;
    }
  }

  public async flushByTags(tags: string[]): Promise<boolean> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    const start = Date.now();

    try {
      const result = await this.adapter.flushByTags(tags);
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("flush_by_tags", duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("flush_by_tags_error", duration);
      throw error;
    }
  }

  public async getStats(): Promise<CacheStats> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    const start = Date.now();

    try {
      const result = await this.adapter.getStats();
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("get_stats", duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("get_stats_error", duration);
      throw error;
    }
  }

  public async getKeysByNamespace(
    namespace?: string,
    pattern?: string,
  ): Promise<string[]> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    const targetNamespace = namespace || this.defaultNamespace;
    const start = Date.now();

    try {
      const result = await this.adapter.getKeysByNamespace(
        targetNamespace,
        pattern,
      );
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("get_keys_by_namespace", duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("get_keys_by_namespace_error", duration);
      throw error;
    }
  }

  public async getKeysByTags(tags: string[]): Promise<string[]> {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Enhanced methods require an EnhancedAdapter");
    }

    const start = Date.now();

    try {
      const result = await this.adapter.getKeysByTags(tags);
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("get_keys_by_tags", duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("get_keys_by_tags_error", duration);
      throw error;
    }
  }

  public pipeline() {
    if (!this.isEnhancedAdapter(this.adapter)) {
      throw new Error("Pipeline requires an EnhancedAdapter");
    }

    return this.adapter.pipeline?.();
  }

  // Legacy methods for backward compatibility
  /**
   * Load cached data. return false if no valid cache.
   */
  public async load(key: string, ttl: number, hash: string = ""): Promise<any> {
    key = this.normalizeKey(key);
    hash = this.caseSensitive ? hash : hash.toLowerCase();

    const start = Date.now();
    const result = await this.adapter.load(key, ttl, hash);
    const duration = (Date.now() - start) / 1000;

    this.recordOperation("load", duration);
    return result;
  }

  /**
   * Save data to cache. Returns data on success or false on failure.
   */
  public async save(
    key: string,
    data: any,
    hash: string = "",
  ): Promise<boolean | string | any[]> {
    key = this.normalizeKey(key);
    hash = this.caseSensitive ? hash : hash.toLowerCase();
    const start = Date.now();

    try {
      const result = await this.adapter.save(key, data, hash);
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("save", duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.recordOperation("save_error", duration);
      throw error;
    }
  }

  /**
   * Returns a list of keys.
   */
  public async list(key: string): Promise<string[]> {
    key = this.normalizeKey(key);

    const start = Date.now();
    const result = await this.adapter.list(key);
    const duration = (Date.now() - start) / 1000;

    this.recordOperation("list", duration);
    return result;
  }

  /**
   * Removes data from cache. Returns true on success or false on failure.
   */
  public async purge(key: string, hash: string = ""): Promise<boolean> {
    key = this.normalizeKey(key);
    hash = this.caseSensitive ? hash : hash.toLowerCase();

    const start = Date.now();
    const result = await this.adapter.purge(key, hash);
    const duration = (Date.now() - start) / 1000;

    this.recordOperation("purge", duration);
    return result;
  }

  /**
   * Removes all data from cache. Returns true on success or false on failure.
   */
  public async flush(): Promise<boolean> {
    const start = Date.now();
    const result = await this.adapter.flush();
    const duration = (Date.now() - start) / 1000;

    this.recordOperation("flush", duration);
    return result;
  }

  /**
   * Check Cache Connectivity
   */
  public async ping(): Promise<boolean> {
    return await this.adapter.ping();
  }

  /**
   * Get db size.
   */
  public async getSize(): Promise<number> {
    const start = Date.now();
    const result = await this.adapter.getSize();
    const duration = (Date.now() - start) / 1000;

    this.recordOperation("size", duration);
    return result;
  }
}
