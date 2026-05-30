import '@tanstack/react-start/server-only';

import { passkey } from '@better-auth/passkey';
import { APIError, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { Keyv } from 'keyv';
import { verifyPasskeyContext } from '../crypto.server';
import { database } from '../database/drizzle.server';
import * as schema from '../database/schema';
import { environment } from '../environment.server';
import { toContext } from './passkeyContext';
import KeyvRedis from './redis';

const cache = new Keyv({
	store: environment.REDIS_URL ? new KeyvRedis({ url: environment.REDIS_URL }) : new Map(),
	namespace: 'better-auth:',
});

const auth = betterAuth({
	advanced: {
		database: {
			generateId: 'uuid',
		},
	},
	database: drizzleAdapter(database, {
		provider: 'pg',
		schema,
	}),
	emailAndPassword: {
		enabled: false,
	},
	experimental: { joins: true },
	plugins: [
		tanstackStartCookies(),
		passkey({
			registration: {
				requireSession: false,
				resolveUser: async ({ context }) => {
					if (!context) {
						throw new APIError('BAD_REQUEST', { message: 'Missing passkey context.' });
					}

					const payload = await verifyPasskeyContext(context);
					const key = toContext(payload.nonce);
					const used = await auth.options.secondaryStorage.get(key);

					if (!used) {
						throw new APIError('CONFLICT', { message: 'Passkey context is already used or missing.' });
					}

					await auth.options.secondaryStorage.delete(key);
					const userRow = await database.query.user.findFirst({
						where: (table, { eq }) => eq(table.email, payload.email),
					});

					if (userRow) {
						throw new APIError('CONFLICT', { message: 'A user already exists with the specified email.' });
					}

					const [user] = await database
						.insert(schema.user)
						.values({ createdAt: new Date(), email: payload.email, name: payload.username })
						.returning();

					if (!user) {
						throw new APIError('INTERNAL_SERVER_ERROR', { message: 'Failed to retrieve the newly created user.' });
					}

					return { id: user.id, name: user.email, displayName: user?.name };
				},
			},
		}),
	],
	secondaryStorage: {
		get: async (key) => await cache.get<string>(key),
		/**
		 * @param ttl This is in seconds.
		 */
		// Keyv stores the TTL in milliseconds while Better-Auth uses seconds, hence the conversion.
		set: async (key, value, ttl) => await cache.set(key, value, typeof ttl === 'number' ? ttl * 1000 : undefined),
		delete: async (key) => {
			await cache.delete(key);
		},
	},
	rateLimit: {
		enabled: true,
		storage: 'secondary-storage',
	},
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60,
			strategy: 'jwe',
		},
		storeSessionInDatabase: true,
	},
});

export default auth;
