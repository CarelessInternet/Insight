import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { database } from '../database/drizzle';
import * as schema from '../database/schema';

export const auth = betterAuth({
	database: drizzleAdapter(database, {
		provider: 'pg',
		schema,
	}),
	emailAndPassword: {
		enabled: true,
	},
	experimental: { joins: true },
	plugins: [tanstackStartCookies(), passkey()],
});
