import '@tanstack/react-start/server-only';
import { getAuthenticatorName, passkey } from '@better-auth/passkey';
import { APIError, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { Keyv } from 'keyv';
import { verifyPasskeyContext } from '../crypto.server';
import { database } from '../database/drizzle.server';
import * as schema from '../database/schema';
import { environment } from '../environment.server';
import KeyvRedis from '../redis';
import { toContext } from './passkeyContext';

const cache = new Keyv({
	namespace: 'better-auth',
	store: environment.REDIS_URL ? new KeyvRedis({ url: environment.REDIS_URL }) : new Map(),
});

const auth = betterAuth({
	advanced: { database: { generateId: 'uuid' } },
	database: drizzleAdapter(database, { provider: 'pg', schema }),
	emailAndPassword: { enabled: false },
	experimental: { joins: true },
	plugins: [
		passkey({
			authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
			// TODO: delete the user if the WebAuthn ceremony fails.
			registration: {
				afterVerification: async ({ verification }) => ({
					name: getAuthenticatorName(verification.registrationInfo?.aaguid),
				}),
				resolveUser: async ({ context }) => {
					if (!context) {
						throw new APIError('BAD_REQUEST', { message: 'Missing passkey context.' });
					}

					const payload = await verifyPasskeyContext(context);
					const key = toContext(payload.nonce);
					const storedContext = await auth.options.secondaryStorage.getAndDelete(key);

					if (!storedContext) {
						throw new APIError('CONFLICT', { message: 'Passkey context is already used or missing.' });
					}

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
				requireSession: false,
			},
			rpID: new URL(environment.BETTER_AUTH_URL).hostname,
			rpName: 'Insight',
		}),
		tanstackStartCookies(),
	],
	secondaryStorage: {
		delete: async (key) => void cache.delete(key),
		get: async (key) => await cache.get<string>(key),
		getAndDelete: async (key) => {
			// For some reason, (Bun) Redis' getdel method does not work.
			const value = await cache.get<string>(key);
			await cache.delete(key);

			return value;
		},
		increment: async (key, ttl) => {
			if (cache.store instanceof KeyvRedis) {
				return await cache.store.increment(key, ttl);
			} else {
				const value = Number(await cache.get(key));

				if (value === 1) {
					await cache.set(key, value, ttl * 1000);
				}

				return value;
			}
		},
		/**
		 * @param ttl This is in seconds.
		 */
		// Keyv stores the TTL in milliseconds while Better-Auth uses seconds, hence the conversion.
		set: async (key, value, ttl) => await cache.set(key, value, typeof ttl === 'number' ? ttl * 1000 : undefined),
	},
	secret: environment.APPLICATION_SECRET,
	rateLimit: { enabled: true, storage: 'secondary-storage' },
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
