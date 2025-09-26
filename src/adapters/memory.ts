import { type Adapter } from "../interfaces/adapter.js";

interface CacheEntry {
  time: number;
  data: string | Record<string | number, any>;
}

export class Memory implements Adapter {
  private store: Record<string, CacheEntry> = {};

  constructor() {}

  async load(key: string, ttl: number, hash: string = ""): Promise<any> {
    if (key && this.store[key]) {
      const saved = this.store[key];
      return saved.time + ttl > Date.now() / 1000 ? saved.data : false;
    }
    return false;
  }

  async save(key: string, data: any, hash: string = "") {
    if (!key || !data) {
      return false;
    }

    const saved: CacheEntry = {
      time: Math.floor(Date.now() / 1000),
      data: data,
    };

    this.store[key] = saved;
    return data;
  }

  async list(key: string): Promise<string[]> {
    return Object.keys(this.store).filter((k) => k.startsWith(key));
  }

  async purge(key: string, hash: string = ""): Promise<boolean> {
    if (key && this.store[key]) {
      delete this.store[key];
      return true;
    }
    return false;
  }

  async flush(): Promise<boolean> {
    this.store = {};
    return true;
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async getSize(): Promise<number> {
    return Object.keys(this.store).length;
  }

  getName(key?: string) {
    return "memory";
  }
}
