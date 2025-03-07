export interface CacheAdapter {
  /**
   * Retrieves a cached item by key.
   * @param key The cache key.
   * @param ttl Time-to-live in seconds.
   * @param namespace Optional namespace identifier.
   * @returns The cached value or null if not found.
   */
  get<T = unknown>(key: string, namespace?: string): Promise<T | null>;

  /**
   * Stores a value in the cache.
   * @param key The cache key.
   * @param value The data to store.
   * @param ttl Optional time-to-live in seconds.
   * @param namespace Optional namespace identifier.
   * @returns True if successful, otherwise false.
   */
  set(
    key: string,
    value: string | Record<string, unknown>,
    ttl?: number,
    namespace?: string,
  ): Promise<boolean>;

  /**
   * Retrieves a list of keys matching a pattern.
   * @param pattern The key pattern to match.
   * @param namespace Optional namespace identifier.
   * @returns An array of matching cache keys.
   */
  keys(pattern: string, namespace?: string): Promise<string[]>;

  /**
   * Deletes a cached item by key.
   * @param key The cache key.
   * @param namespace Optional namespace identifier.
   * @returns True if successful, otherwise false.
   */
  delete(key: string, namespace?: string): Promise<boolean>;

  /**
   * Clears all cached data within a namespace or globally.
   * @param namespace Optional namespace identifier.
   * @returns True if successful, otherwise false.
   */
  clear(namespace?: string): Promise<boolean>;

  /**
   * Checks if the cache connection is active.
   * @returns True if the connection is alive, otherwise false.
   */
  isAlive(): Promise<boolean>;

  /**
   * Gets the total cache storage size.
   * @returns The size of the cache in bytes.
   */
  size(): Promise<number>;

  /**
   * Returns the name of the cache adapter.
   * @param key Optional cache key.
   * @returns The adapter name or key-specific identifier.
   */
  getName(key?: string): string;

  /**
   * Extends the TTL of an existing cache entry.
   * @param key The cache key.
   * @param ttl Time-to-live in seconds.
   * @param namespace Optional namespace identifier.
   * @returns True if TTL was updated, otherwise false.
   */
  extendTTL(key: string, ttl: number, namespace?: string): Promise<boolean>;
}
