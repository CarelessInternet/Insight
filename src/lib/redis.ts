// https://keyv.org/docs/third-party-storage-adapters/#building-a-storage-adapter

import { EventEmitter } from 'node:events';
import { RedisClient } from 'bun';
import type { KeyvStoreAdapter } from 'keyv';
import type { environment } from './environment.server';

type KeyvStorageGetResult<Value> = { value?: Value; expires?: number } | undefined;

export default class KeyvRedis extends EventEmitter implements KeyvStoreAdapter {
	public opts: { store: RedisClient };

	constructor({ url }: { url: NonNullable<typeof environment.REDIS_URL> }) {
		super();

		this.opts = { store: new RedisClient(url) };
	}

	async get<Value>(key: string): Promise<KeyvStorageGetResult<Value> | undefined> {
		const [data, ttl] = await Promise.all([this.opts.store.get(key), this.opts.store.ttl(key)]);

		if (!data || !ttl) {
			return undefined;
		}

		if (ttl !== -1 && ttl < 0) {
			await this.opts.store.del(key);
			return undefined;
		}

		return data as KeyvStorageGetResult<Value>;
	}

	async set(key: string, value: string, ttl?: number): Promise<boolean> {
		if (ttl) {
			// Redis stores the TTL in seconds while Keyv uses milliseconds, hence the conversion.
			await this.opts.store.set(key, value, 'EX', ttl / 1000);
		} else {
			await this.opts.store.set(key, value);
		}

		return true;
	}

	async delete(key: string): Promise<boolean> {
		const amount = await this.opts.store.del(key);
		return amount > 0;
	}

	async clear(): Promise<void> {
		await this.opts.store.send('FLUSHALL', []);
	}

	async disconnect(): Promise<void> {
		this.opts.store.close();
	}
}
