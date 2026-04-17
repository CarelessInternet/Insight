import { createEnv } from '@t3-oss/env-core';
import z from 'zod';

export const environment = createEnv({
	server: {
		ENCRYPTION_SECRET: z.base64().min(32),
		LOOKUP_SECRET: z.string().min(32),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		DATABASE_HOST: z.string(),
		DATABASE_PORT: z.coerce.number(),
		DATABASE_DB: z.string(),
		DATABASE_USERNAME: z.string(),
		DATABASE_PASSWORD: z.string(),
		// https://github.com/winstonjs/winston?tab=readme-ov-file#logging-levels
		LOG_LEVEL: z
			.union([
				z.literal('error'),
				z.literal('warn'),
				z.literal('info'),
				z.literal('http'),
				z.literal('verbose'),
				z.literal('debug'),
			])
			.default('http'),
		NODE_ENV: z.union([z.literal('development'), z.literal('production')]),
	},
	// Would use import.meta.env, but Bun loads .env files which overrides Vite's.
	// BETTER_AUTH_URL would be replaceable with import.meta.env.BASE_URL.
	// https://vite.dev/guide/env-and-mode#env-files
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
