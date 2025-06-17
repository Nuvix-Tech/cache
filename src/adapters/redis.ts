import { type EnhancedAdapter, type CacheOptions, type CacheEntry, type CacheStats, type BatchOperation, type Pipeline as IPipeline } from "../interfaces/adapter";
import IORedis, { type RedisOptions, type Pipeline as RedisPipeline } from "ioredis";
import { promisify } from "util";
import { gzip, gunzip } from "zlib";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface RedisAdapterOptions extends RedisOptions {
  namespace?: string;
  defaultTTL?: number;
  enableCompression?: boolean;
  compressionThreshold?: number;
  keyPrefix?: string;
  tagPrefix?: string;
  metadataPrefix?: string;
  maxKeyLength?: number;
  maxValueSize?: number;
}

export class Redis implements EnhancedAdapter {
  private redis: IORedis;
  private namespace: string;
  private defaultTTL: number;
  private enableCompression: boolean;
  private compressionThreshold: number;
  private keyPrefix: string;
  private tagPrefix: string;
  private metadataPrefix: string;
  private maxKeyLength: number;
  private maxValueSize: number;
  private stats: CacheStats;

  constructor(client: IORedis, options?: Partial<RedisAdapterOptions>);
  constructor(options: RedisAdapterOptions);
  constructor(clientOrOptions: IORedis | RedisAdapterOptions, options: Partial<RedisAdapterOptions> = {}) {
    if (clientOrOptions instanceof IORedis) {
      this.redis = clientOrOptions;
      this.setupOptions(options);
    } else {
      const redisAdapterOptions = clientOrOptions as RedisAdapterOptions;
      const { namespace, defaultTTL, enableCompression, compressionThreshold, keyPrefix, tagPrefix, metadataPrefix, maxKeyLength, maxValueSize, ...redisOptions } = redisAdapterOptions;
      this.redis = new IORedis(redisOptions);
      this.setupOptions(redisAdapterOptions);
    }

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  private setupOptions(options: Partial<RedisAdapterOptions>): void {
    this.namespace = options.namespace || 'cache';
    this.defaultTTL = options.defaultTTL || 3600;
    this.enableCompression = options.enableCompression || false;
    this.compressionThreshold = options.compressionThreshold || 1024;
    this.keyPrefix = options.keyPrefix || 'cache:';
    this.tagPrefix = options.tagPrefix || 'tag:';
    this.metadataPrefix = options.metadataPrefix || 'meta:';
    this.maxKeyLength = options.maxKeyLength || 250;
    this.maxValueSize = options.maxValueSize || 512 * 1024; // 512KB
  }

  private buildKey(key: string, options?: CacheOptions): string {
    const namespace = options?.namespace || this.namespace;
    const fullKey = `${this.keyPrefix}${namespace}:${key}`;
    
    if (fullKey.length > this.maxKeyLength) {
      throw new Error(`Key length exceeds maximum of ${this.maxKeyLength} characters`);
    }
    
    return fullKey;
  }

  private buildTagKey(tag: string): string {
    return `${this.tagPrefix}${tag}`;
  }

  private buildMetadataKey(key: string): string {
    return `${this.metadataPrefix}${key}`;
  }

  private async serializeValue(value: any, options?: CacheOptions): Promise<string> {
    let serialized = JSON.stringify(value);
    
    if (serialized.length > this.maxValueSize) {
      throw new Error(`Value size exceeds maximum of ${this.maxValueSize} bytes`);
    }

    if (this.enableCompression && (options?.compression !== false) && serialized.length > this.compressionThreshold) {
      const compressed = await this.compress(serialized);
      return `__compressed__${compressed.toString('base64')}`;
    }

    return serialized;
  }

  private async deserializeValue(value: string): Promise<any> {
    if (value.startsWith('__compressed__')) {
      const compressed = Buffer.from(value.substring(14), 'base64');
      const decompressed = await this.decompress(compressed);
      return JSON.parse(decompressed.toString());
    }
    
    return JSON.parse(value);
  }

  async compress(data: any): Promise<Buffer> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return await gzipAsync(buffer);
  }

  async decompress(data: string | Buffer): Promise<any> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return await gunzipAsync(buffer);
  }

  setNamespace(namespace: string): void {
    this.namespace = namespace;
  }

  getNamespace(): string {
    return this.namespace;
  }

  // Enhanced methods
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      const redisKey = this.buildKey(key, options);
      const ttl = options.ttl || this.defaultTTL;
      const expiresAt = ttl > 0 ? Date.now() + (ttl * 1000) : undefined;

      const entry: CacheEntry<T> = {
        data: value,
        createdAt: Date.now(),
        expiresAt,
        metadata: options.metadata
      };

      const serializedValue = await this.serializeValue(entry, options);
      
      const pipeline = this.redis.pipeline();
      
      if (ttl > 0) {
        pipeline.setex(redisKey, ttl, serializedValue);
      } else {
        pipeline.set(redisKey, serializedValue);
      }

      // Handle tags
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          const tagKey = this.buildTagKey(tag);
          pipeline.sadd(tagKey, redisKey);
          if (ttl > 0) {
            pipeline.expire(tagKey, ttl);
          }
        }
      }

      // Store metadata separately if needed
      if (options.metadata) {
        const metaKey = this.buildMetadataKey(redisKey);
        pipeline.hset(metaKey, options.metadata);
        if (ttl > 0) {
          pipeline.expire(metaKey, ttl);
        }
      }

      await pipeline.exec();
      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  async get<T>(key: string, options: { includeMetadata?: boolean } & CacheOptions = {}): Promise<T | CacheEntry<T> | null> {
    try {
      const redisKey = this.buildKey(key, options);
      const value = await this.redis.get(redisKey);

      if (!value) {
        this.stats.misses++;
        return null;
      }

      const entry: CacheEntry<T> = await this.deserializeValue(value);

      // Check expiration
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.stats.misses++;
        await this.redis.del(redisKey);
        return null;
      }

      this.stats.hits++;
      
      if (options.includeMetadata) {
        return entry;
      }
      
      return entry.data;
    } catch (error) {
      this.stats.errors++;
      return null;
    }
  }

  async mget<T>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    try {
      const redisKeys = keys.map(key => this.buildKey(key, options));
      const values = await this.redis.mget(...redisKeys);
      
      const results: (T | null)[] = [];
      
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (!value) {
          results.push(null);
          this.stats.misses++;
          continue;
        }

        try {
          const entry: CacheEntry<T> = await this.deserializeValue(value);
          
          if (entry.expiresAt && entry.expiresAt < Date.now()) {
            results.push(null);
            this.stats.misses++;
            // Clean up expired key
            this.redis.del(redisKeys[i]).catch(() => {});
          } else {
            results.push(entry.data);
            this.stats.hits++;
          }
        } catch {
          results.push(null);
          this.stats.misses++;
        }
      }
      
      return results;
    } catch (error) {
      this.stats.errors++;
      return keys.map(() => null);
    }
  }

  async mset<T>(entries: Record<string, T>, options: CacheOptions = {}): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();
      const ttl = options.ttl || this.defaultTTL;

      for (const [key, value] of Object.entries(entries)) {
        const redisKey = this.buildKey(key, options);
        const expiresAt = ttl > 0 ? Date.now() + (ttl * 1000) : undefined;

        const entry: CacheEntry<T> = {
          data: value,
          createdAt: Date.now(),
          expiresAt,
          metadata: options.metadata
        };

        const serializedValue = await this.serializeValue(entry, options);
        
        if (ttl > 0) {
          pipeline.setex(redisKey, ttl, serializedValue);
        } else {
          pipeline.set(redisKey, serializedValue);
        }

        // Handle tags
        if (options.tags && options.tags.length > 0) {
          for (const tag of options.tags) {
            const tagKey = this.buildTagKey(tag);
            pipeline.sadd(tagKey, redisKey);
            if (ttl > 0) {
              pipeline.expire(tagKey, ttl);
            }
          }
        }
      }

      await pipeline.exec();
      this.stats.sets += Object.keys(entries).length;
      return true;
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  async mdel(keys: string[], options: CacheOptions = {}): Promise<number> {
    try {
      const redisKeys = keys.map(key => this.buildKey(key, options));
      const result = await this.redis.del(...redisKeys);
      this.stats.deletes += result;
      return result;
    } catch (error) {
      this.stats.errors++;
      return 0;
    }
  }

  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const redisKey = this.buildKey(key, options);
      const result = await this.redis.exists(redisKey);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  async expire(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
    try {
      const redisKey = this.buildKey(key, options);
      const result = await this.redis.expire(redisKey, ttl);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  async ttl(key: string, options: CacheOptions = {}): Promise<number> {
    try {
      const redisKey = this.buildKey(key, options);
      return await this.redis.ttl(redisKey);
    } catch (error) {
      this.stats.errors++;
      return -1;
    }
  }

  async increment(key: string, amount: number = 1, options: CacheOptions = {}): Promise<number> {
    try {
      const redisKey = this.buildKey(key, options);
      const result = await this.redis.incrby(redisKey, amount);
      
      const ttl = options.ttl || this.defaultTTL;
      if (ttl > 0) {
        await this.redis.expire(redisKey, ttl);
      }
      
      return result;
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  async decrement(key: string, amount: number = 1, options: CacheOptions = {}): Promise<number> {
    try {
      const redisKey = this.buildKey(key, options);
      const result = await this.redis.decrby(redisKey, amount);
      
      const ttl = options.ttl || this.defaultTTL;
      if (ttl > 0) {
        await this.redis.expire(redisKey, ttl);
      }
      
      return result;
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  async flushNamespace(namespace: string): Promise<boolean> {
    try {
      const pattern = `${this.keyPrefix}${namespace}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.stats.deletes += keys.length;
      }
      
      return true;
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  async flushByTags(tags: string[]): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();
      const allKeys = new Set<string>();

      for (const tag of tags) {
        const tagKey = this.buildTagKey(tag);
        const keys = await this.redis.smembers(tagKey);
        keys.forEach(key => allKeys.add(key));
        pipeline.del(tagKey);
      }

      if (allKeys.size > 0) {
        pipeline.del(...Array.from(allKeys));
      }

      await pipeline.exec();
      this.stats.deletes += allKeys.size;
      return true;
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const keyCount = await this.redis.dbsize();
      
      return {
        ...this.stats,
        keyCount
      };
    } catch (error) {
      return this.stats;
    }
  }

  async getKeysByNamespace(namespace: string, pattern: string = '*'): Promise<string[]> {
    try {
      const searchPattern = `${this.keyPrefix}${namespace}:${pattern}`;
      return await this.redis.keys(searchPattern);
    } catch (error) {
      this.stats.errors++;
      return [];
    }
  }

  async getKeysByTags(tags: string[]): Promise<string[]> {
    try {
      const allKeys = new Set<string>();
      
      for (const tag of tags) {
        const tagKey = this.buildTagKey(tag);
        const keys = await this.redis.smembers(tagKey);
        keys.forEach(key => allKeys.add(key));
      }
      
      return Array.from(allKeys);
    } catch (error) {
      this.stats.errors++;
      return [];
    }
  }

  pipeline(): Pipeline {
    return new Pipeline(this.redis.pipeline() as any, this);
  }

  async transaction(operations: BatchOperation[]): Promise<any[]> {
    const pipeline = this.redis.pipeline();
    
    for (const op of operations) {
      if (op.value !== undefined) {
        // Set operation
        const redisKey = this.buildKey(op.key, op.options);
        const ttl = op.options?.ttl || this.defaultTTL;
        const expiresAt = ttl > 0 ? Date.now() + (ttl * 1000) : undefined;

        const entry: CacheEntry = {
          data: op.value,
          createdAt: Date.now(),
          expiresAt,
          metadata: op.options?.metadata
        };

        const serializedValue = await this.serializeValue(entry, op.options);
        
        if (ttl > 0) {
          pipeline.setex(redisKey, ttl, serializedValue);
        } else {
          pipeline.set(redisKey, serializedValue);
        }
      } else {
        // Get operation
        const redisKey = this.buildKey(op.key, op.options);
        pipeline.get(redisKey);
      }
    }
    
    const results = await pipeline.exec();
    return results ? results.map(([err, result]) => err ? null : result) : [];
  }

  // Legacy methods for backward compatibility
  async load<T>(key: string, ttl: number, hash: string = ""): Promise<T | null> {
    if (hash) {
      const hashKey = this.buildKey(key);
      const value = await this.redis.hget(hashKey, hash);
      
      if (!value) {
        this.stats.misses++;
        return null;
      }

      try {
        const cache = JSON.parse(value) as { time: number; data: T };
        if (cache.time + ttl > Math.floor(Date.now() / 1000)) {
          this.stats.hits++;
          return cache.data;
        }
      } catch {
        this.stats.errors++;
      }
      
      this.stats.misses++;
      return null;
    }

    return await this.get<T>(key) as T | null;
  }

  async save<T>(key: string, data: T, hash: string = ""): Promise<boolean> {
    if (!key || data === undefined || data === null) {
      return false;
    }

    if (hash) {
      try {
        const hashKey = this.buildKey(key);
        const value = JSON.stringify({
          time: Math.floor(Date.now() / 1000),
          data,
        });

        await this.redis.hset(hashKey, hash, value);
        this.stats.sets++;
        return true;
      } catch {
        this.stats.errors++;
        return false;
      }
    }

    return await this.set(key, data);
  }

  async list(key: string): Promise<string[]> {
    try {
      const pattern = this.buildKey(key.endsWith('*') ? key : `${key}*`);
      return await this.redis.keys(pattern);
    } catch {
      this.stats.errors++;
      return [];
    }
  }

  async purge(key: string, hash: string = ""): Promise<boolean> {
    try {
      if (hash) {
        const hashKey = this.buildKey(key);
        const result = await this.redis.hdel(hashKey, hash);
        if (result > 0) {
          this.stats.deletes++;
        }
        return result > 0;
      }
      
      const redisKey = this.buildKey(key);
      const result = await this.redis.del(redisKey);
      if (result > 0) {
        this.stats.deletes++;
      }
      return result > 0;
    } catch {
      this.stats.errors++;
      return false;
    }
  }

  async flush(): Promise<boolean> {
    try {
      await this.redis.flushdb();
      return true;
    } catch {
      this.stats.errors++;
      return false;
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  async getSize(): Promise<number> {
    try {
      return await this.redis.dbsize();
    } catch {
      return 0;
    }
  }

  getName(key?: string): string {
    return key ? `redis:${this.namespace}:${key}` : `redis:${this.namespace}`;
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

class Pipeline implements IPipeline {
  constructor(private redisPipeline: RedisPipeline, private adapter: Redis) {}

  set<T>(key: string, value: T, options: CacheOptions = {}): Pipeline {
    // Implementation would build the pipeline command
    const redisKey = (this.adapter as any).buildKey(key, options);
    const ttl = options.ttl || (this.adapter as any).defaultTTL;
    
    if (ttl > 0) {
      this.redisPipeline.setex(redisKey, ttl, JSON.stringify(value));
    } else {
      this.redisPipeline.set(redisKey, JSON.stringify(value));
    }
    
    return this;
  }

  get(key: string, options: CacheOptions = {}): Pipeline {
    const redisKey = (this.adapter as any).buildKey(key, options);
    this.redisPipeline.get(redisKey);
    return this;
  }

  del(key: string, options: CacheOptions = {}): Pipeline {
    const redisKey = (this.adapter as any).buildKey(key, options);
    this.redisPipeline.del(redisKey);
    return this;
  }

  expire(key: string, ttl: number, options: CacheOptions = {}): Pipeline {
    const redisKey = (this.adapter as any).buildKey(key, options);
    this.redisPipeline.expire(redisKey, ttl);
    return this;
  }

  async exec(): Promise<any[]> {
    const results = await this.redisPipeline.exec();
    return results ? results.map(([err, result]) => err ? null : result) : [];
  }
}
