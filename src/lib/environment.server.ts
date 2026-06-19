import { createEnv } from '@t3-oss/env-core';
import z from 'zod';

export const environment = createEnv({
	server: {
		APPLICATION_SECRET: z.base64().min(32),
		BETTER_AUTH_URL: z.url(),
		DATABASE_URL: z.url(),
		REDIS_URL: z.url().optional(),
		// https://github.com/winstonjs/winston?tab=readme-ov-file#logging-levels
		LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug']).default('http'),
		NODE_ENV: z.enum(['development', 'production']),
	},
	// Would use import.meta.env, but Bun loads .env files which overrides Vite's.
	// BETTER_AUTH_URL would be replaceable with import.meta.env.BASE_URL.
	// https://vite.dev/guide/env-and-mode#env-files
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
