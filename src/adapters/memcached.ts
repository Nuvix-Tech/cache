import { type Adapter } from "../interfaces/adapter.js";
import Memcached from "memcached";

interface CacheData {
  time: number;
  data: string | Record<string, any>;
}

export class MemcachedAdapter implements Adapter {
  private memcached: Memcached;

  constructor(memcached: Memcached) {
    this.memcached = memcached;
  }

  async load(key: string, ttl: number, hash: string = ""): Promise<any> {
    return new Promise((resolve) => {
      this.memcached.get(key, (err, data: CacheData | undefined) => {
        if (err || !data) {
          resolve(false);
          return;
        }

        if (data.time + ttl > Math.floor(Date.now() / 1000)) {
          resolve(data.data);
        } else {
          resolve(false);
        }
      });
    });
  }

  async save(key: string, data: any, hash: string = ""): Promise<any> {
    if (!key || !data) {
      return false;
    }

    const cache: CacheData = {
      time: Math.floor(Date.now() / 1000),
      data: data,
    };

    return new Promise((resolve) => {
      this.memcached.set(key, cache, 0, (err) => {
        resolve(err ? false : data);
      });
    });
  }

  async list(key: string): Promise<string[]> {
    return [];
  }

  async purge(key: string, hash: string = ""): Promise<boolean> {
    return new Promise((resolve) => {
      this.memcached.del(key, (err) => {
        resolve(!err);
      });
    });
  }

  async flush(): Promise<boolean> {
    return new Promise((resolve) => {
      this.memcached.flush((err) => {
        resolve(!err);
      });
    });
  }

  async ping(): Promise<boolean> {
    return new Promise((resolve) => {
      this.memcached.stats((err, stats) => {
        resolve(!err && stats && Object.keys(stats).length > 0);
      });
    });
  }

  async getSize(): Promise<number> {
    return new Promise((resolve) => {
      this.memcached.stats((err, stats) => {
        if (err || !stats) {
          resolve(0);
          return;
        }

        const serverKeys = Object.keys(stats);
        if (serverKeys.length > 0) {
          const serverStats = stats[serverKeys[0] as keyof typeof stats];
          if (
            typeof serverStats === "object" &&
            serverStats !== null &&
            "curr_items" in serverStats
          ) {
            resolve(parseInt((serverStats as any).curr_items as string) || 0);
          } else {
            resolve(0);
          }
        } else {
          resolve(0);
        }
      });
    });
  }

  getName(key?: string): string {
    return "memcached";
  }
}
