import { type Histogram, None, Adapter as Telemetry } from "@nuvix/telemetry";
import { Adapter } from "./interfaces/adapter";

export class Cache {
    private adapter: Adapter;

    /**
     * If cache keys are case-sensitive
     */
    public caseSensitive: boolean = false;

    /**
     * Histogram for tracking operation duration
     */
    protected operationDuration: Histogram | null = null;

    /**
     * Set telemetry adapter and create histograms for cache operations.
     */
    public setTelemetry(telemetry: Telemetry): void {
        this.operationDuration = telemetry.createHistogram(
            'cache.operation.duration',
            's',
            null,
            { ExplicitBucketBoundaries: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1] } as any // TODO: ----
        );
    }

    /**
     * Initialize with a no-op telemetry adapter by default.
     */
    constructor(adapter: Adapter) {
        this.adapter = adapter;
        this.setTelemetry(new None());
    }

    /**
     * Toggle case sensitivity of keys inside cache
     */
    public setCaseSensitivity(value: boolean): boolean {
        return this.caseSensitive = value;
    }

    /**
     * Load cached data. return false if no valid cache.
     */
    public async load(key: string, ttl: number, hash: string = ''): Promise<any> {
        key = this.caseSensitive ? key : key.toLowerCase();
        hash = this.caseSensitive ? hash : hash.toLowerCase();

        const start = Date.now();
        const result = await this.adapter.load(key, ttl, hash);
        const duration = (Date.now() - start) / 1000;

        this.operationDuration?.record(duration, {
            operation: 'load',
            adapter: this.adapter.getName(key),
        });

        return result;
    }

    /**
     * Save data to cache. Returns data on success or false on failure.
     */
    public async save(key: string, data: any, hash: string = ''): Promise<boolean | string | any[]> {
        key = this.caseSensitive ? key : key.toLowerCase();
        hash = this.caseSensitive ? hash : hash.toLowerCase();
        const start = Date.now();

        try {
            return await this.adapter.save(key, data, hash);
        } finally {
            const duration = (Date.now() - start) / 1000;
            this.operationDuration?.record(duration, {
                operation: 'save',
                adapter: this.adapter.getName(key),
            });
        }
    }

    /**
     * Returns a list of keys.
     */
    public async list(key: string): Promise<string[]> {
        key = this.caseSensitive ? key : key.toLowerCase();

        const start = Date.now();
        const result = await this.adapter.list(key);
        const duration = (Date.now() - start) / 1000;

        this.operationDuration?.record(duration, {
            operation: 'list',
            adapter: this.adapter.getName(key),
        });

        return result;
    }

    /**
     * Removes data from cache. Returns true on success or false on failure.
     */
    public async purge(key: string, hash: string = ''): Promise<boolean> {
        key = this.caseSensitive ? key : key.toLowerCase();
        hash = this.caseSensitive ? hash : hash.toLowerCase();

        const start = Date.now();
        const result = await this.adapter.purge(key, hash);
        const duration = (Date.now() - start) / 1000;

        this.operationDuration?.record(duration, {
            operation: 'purge',
            adapter: this.adapter.getName(key),
        });

        return result;
    }

    /**
     * Removes all data from cache. Returns true on success or false on failure.
     */
    public async flush(): Promise<boolean> {
        const start = Date.now();
        const result = await this.adapter.flush();
        const duration = (Date.now() - start) / 1000;

        this.operationDuration?.record(duration, {
            operation: 'flush',
            adapter: this.adapter.getName(),
        });

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

        this.operationDuration?.record(duration, {
            operation: 'size',
            adapter: this.adapter.getName(),
        });

        return result;
    }
}