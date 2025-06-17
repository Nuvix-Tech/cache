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
