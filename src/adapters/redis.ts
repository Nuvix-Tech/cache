import { type Adapter } from "../interfaces/adapter";
import { type RedisClientType } from "redis";

export class Redis implements Adapter {
  private redis: RedisClientType;

  constructor(redis: RedisClientType) {
    this.redis = redis;
  }

  async load(key: string, ttl: number, hash: string = ""): Promise<any> {
    if (!hash) {
      hash = key;
    }

    const redisString = await this.redis.hGet(key, hash);

    if (!redisString) {
      return false;
    }

    try {
      const cache = JSON.parse(redisString) as { time: number; data: any };

      if (cache.time + ttl > Math.floor(Date.now() / 1000)) {
        return cache.data;
      }
    } catch {
      return false;
    }

    return false;
  }

  async save(key: string, data: any, hash: string = ""): Promise<any> {
    if (!key || !data) {
      return false;
    }

    if (!hash) {
      hash = key;
    }

    try {
      const value = JSON.stringify({
        time: Math.floor(Date.now() / 1000),
        data,
      });

      await this.redis.hSet(key, hash, value);
      return data;
    } catch {
      return false;
    }
  }

  async list(key: string): Promise<string[]> {
    try {
      const keys = await this.redis.hKeys(key);
      return keys || [];
    } catch {
      return [];
    }
  }

  async purge(key: string, hash: string = ""): Promise<boolean> {
    try {
      if (hash) {
        return Boolean(await this.redis.hDel(key, hash));
      }
      return Boolean(await this.redis.del(key));
    } catch {
      return false;
    }
  }

  async flush(): Promise<boolean> {
    try {
      await this.redis.flushAll();
      return true;
    } catch {
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
      return await this.redis.dbSize();
    } catch {
      return 0;
    }
  }

  getName(key?: string): string {
    return "redis";
  }
}
