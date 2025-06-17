export interface CacheEntry<T = any> {
  data: T;
  createdAt: number;
  expiresAt?: number;
  metadata?: Record<string, any>;
}

export interface CacheOptions {
  ttl?: number;
  namespace?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  compression?: boolean;
  serialize?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  memoryUsage?: number;
  keyCount?: number;
}

export interface BatchOperation<T = any> {
  key: string;
  value?: T;
  options?: CacheOptions;
}

export interface Adapter {
  /**
   * Retrieves a cached item by key.
   * @param key The cache key.
   * @param ttl Time-to-live in seconds.
   * @param hash Optional hash identifier.
   * @returns The cached value or null if not found.
   */
  load<T = unknown>(key: string, ttl: number, hash?: string): Promise<T | null>;

  /**
   * Stores a value in the cache.
   * @param key The cache key.
   * @param data The data to store.
   * @param hash Optional hash identifier.
   * @returns True if successful, otherwise false.
   */
  save<T = unknown>(key: string, data: T, hash?: string): Promise<boolean>;

  /**
   * Retrieves a list of keys matching a pattern.
   * @param key The key pattern to match.
   * @returns An array of matching cache keys.
   */
  list(key: string): Promise<string[]>;

  /**
   * Deletes a cached item by key.
   * @param key The cache key.
   * @param hash Optional hash identifier.
   * @returns True if successful, otherwise false.
   */
  purge(key: string, hash?: string): Promise<boolean>;

  /**
   * Clears all cached data.
   * @returns True if successful, otherwise false.
   */
  flush(): Promise<boolean>;

  /**
   * Checks if the cache connection is active.
   * @returns True if the connection is alive, otherwise false.
   */
  ping(): Promise<boolean>;

  /**
   * Gets the total cache storage size.
   * @returns The size of the cache in bytes.
   */
  getSize(): Promise<number>;

  /**
   * Returns the name of the cache adapter.
   * @param key Optional cache key.
   * @returns The adapter name or key-specific identifier.
   */
  getName(key?: string): string;
}

export interface EnhancedAdapter extends Adapter {
  /**
   * Sets a value with advanced options.
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean>;

  /**
   * Gets a value with metadata.
   */
  get<T>(key: string, options?: { includeMetadata?: boolean }): Promise<T | CacheEntry<T> | null>;

  /**
   * Gets multiple values at once.
   */
  mget<T>(keys: string[], options?: CacheOptions): Promise<(T | null)[]>;

  /**
   * Sets multiple values at once.
   */
  mset<T>(entries: Record<string, T>, options?: CacheOptions): Promise<boolean>;

  /**
   * Deletes multiple keys at once.
   */
  mdel(keys: string[], options?: CacheOptions): Promise<number>;

  /**
   * Checks if a key exists.
   */
  exists(key: string, options?: CacheOptions): Promise<boolean>;

  /**
   * Sets TTL for existing key.
   */
  expire(key: string, ttl: number, options?: CacheOptions): Promise<boolean>;

  /**
   * Gets TTL for a key.
   */
  ttl(key: string, options?: CacheOptions): Promise<number>;

  /**
   * Increments a numeric value.
   */
  increment(key: string, amount?: number, options?: CacheOptions): Promise<number>;

  /**
   * Decrements a numeric value.
   */
  decrement(key: string, amount?: number, options?: CacheOptions): Promise<number>;

  /**
   * Clears cache by namespace.
   */
  flushNamespace(namespace: string): Promise<boolean>;

  /**
   * Clears cache by tags.
   */
  flushByTags(tags: string[]): Promise<boolean>;

  /**
   * Gets cache statistics.
   */
  getStats(): Promise<CacheStats>;

  /**
   * Gets all keys in a namespace.
   */
  getKeysByNamespace(namespace: string, pattern?: string): Promise<string[]>;

  /**
   * Gets all keys with specific tags.
   */
  getKeysByTags(tags: string[]): Promise<string[]>;

  /**
   * Compresses data if needed.
   */
  compress?(data: any): Promise<string | Buffer>;

  /**
   * Decompresses data if needed.
   */
  decompress?(data: string | Buffer): Promise<any>;

  /**
   * Sets namespace for the adapter.
   */
  setNamespace(namespace: string): void;

  /**
   * Gets current namespace.
   */
  getNamespace(): string;

  /**
   * Creates a pipeline for batch operations.
   */
  pipeline?(): Pipeline;

  /**
   * Executes a transaction.
   */
  transaction?(operations: BatchOperation[]): Promise<any[]>;
}

export interface Pipeline {
  set<T>(key: string, value: T, options?: CacheOptions): Pipeline;
  get(key: string, options?: CacheOptions): Pipeline;
  del(key: string, options?: CacheOptions): Pipeline;
  expire(key: string, ttl: number, options?: CacheOptions): Pipeline;
  exec(): Promise<any[]>;
}
