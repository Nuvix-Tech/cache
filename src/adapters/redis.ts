import { CacheAdapter } from "../interfaces/adapter";
import { Redis as IoRedis, RedisOptions } from "ioredis";
import zlib from "zlib";

export class Redis implements CacheAdapter {
  private client: IoRedis;
  private readonly namespace: string;
  private readonly useCompression: boolean;

  constructor(
    redisInstanceOrOptions: IoRedis | RedisOptions,
    namespace = "cache",
    useCompression = false,
  ) {
    this.namespace = namespace;
    this.useCompression = useCompression;

    if (redisInstanceOrOptions instanceof IoRedis) {
      this.client = redisInstanceOrOptions;
    } else {
      this.client = new IoRedis(redisInstanceOrOptions);
    }
  }

  private getKey(key: string, namespace?: string): string {
    return `${namespace || this.namespace}:${key}`;
  }

  private compress(data: string): Buffer {
    return zlib.deflateSync(data);
  }

  private decompress(data: Buffer): string {
    return zlib.inflateSync(data).toString();
  }

  async get<T = unknown>(key: string, namespace?: string): Promise<T | null> {
    const fullKey = this.getKey(key, namespace);
    const value = await this.client.getBuffer(fullKey);

    if (!value) return null;

    const decompressed = this.useCompression
      ? this.decompress(value)
      : value.toString();
    return JSON.parse(decompressed) as T;
  }

  async set<T = unknown>(
    key: string,
    value: T,
    ttl?: number,
    namespace?: string,
  ): Promise<boolean> {
    const fullKey = this.getKey(key, namespace);
    const serializedValue = JSON.stringify(value);
    const data = this.useCompression
      ? this.compress(serializedValue)
      : serializedValue;

    if (ttl) {
      return (await this.client.set(fullKey, data, "EX", ttl)) === "OK";
    } else {
      return (await this.client.set(fullKey, data)) === "OK";
    }
  }

  async mget<T = unknown>(
    keys: string[],
    namespace?: string,
  ): Promise<(T | null)[]> {
    const fullKeys = keys.map((key) => this.getKey(key, namespace));
    const values = await this.client.mgetBuffer(...fullKeys);

    return values.map((value) =>
      value
        ? (JSON.parse(
            this.useCompression ? this.decompress(value) : value.toString(),
          ) as T)
        : null,
    );
  }

  async mset(
    data: Record<string, unknown>,
    namespace?: string,
    ttl?: number,
  ): Promise<boolean> {
    const pipeline = this.client.pipeline();

    for (const [key, value] of Object.entries(data)) {
      const fullKey = this.getKey(key, namespace);
      const serializedValue = JSON.stringify(value);
      const data = this.useCompression
        ? this.compress(serializedValue)
        : serializedValue;
      if (ttl) {
        pipeline.set(fullKey, data, "EX", ttl);
      } else {
        pipeline.set(fullKey, data);
      }
    }

    await pipeline.exec();
    return true;
  }

  async keys(pattern: string, namespace?: string): Promise<string[]> {
    return await this.client.keys(this.getKey(pattern, namespace));
  }

  async delete(key: string, namespace?: string): Promise<boolean> {
    const fullKey = this.getKey(key, namespace);
    return (await this.client.del(fullKey)) > 0;
  }

  async deleteMany(keys: string[], namespace?: string): Promise<boolean> {
    if (keys.length === 0) return false;
    const fullKeys = keys.map((key) => this.getKey(key, namespace));

    const luaScript = `
      for i=1,#KEYS do
        redis.call("DEL", KEYS[i])
      end
      return 1
    `;

    return (
      (await this.client.eval(luaScript, fullKeys.length, ...fullKeys)) === 1
    );
  }

  async clear(namespace?: string): Promise<boolean> {
    const keys = await this.keys("*", namespace);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
    return true;
  }

  async isAlive(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async size(): Promise<number> {
    return (await this.client.dbsize()) || 0;
  }

  async expire(key: string, ttl: number, namespace?: string): Promise<boolean> {
    const fullKey = this.getKey(key, namespace);
    return (await this.client.expire(fullKey, ttl)) === 1;
  }

  async ttl(key: string, namespace?: string): Promise<number> {
    const fullKey = this.getKey(key, namespace);
    return await this.client.ttl(fullKey);
  }

  async extendTTL(
    key: string,
    ttl: number,
    namespace?: string,
  ): Promise<boolean> {
    const fullKey = this.getKey(key, namespace);
    const currentTTL = await this.client.ttl(fullKey);

    if (currentTTL > 0) {
      return (await this.client.expire(fullKey, currentTTL + ttl)) === 1;
    }

    return false;
  }

  getName(): string {
    return "RedisAdapter";
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
