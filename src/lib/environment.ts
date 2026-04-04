import { createEnv } from '@t3-oss/env-core';
import z from 'zod';

export const environment = createEnv({
	server: {
		APP_SECRET: z.base64().min(32),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		DATABASE_HOST: z.string(),
		DATABASE_PORT: z.coerce.number(),
		DATABASE_DB: z.string(),
		DATABASE_USERNAME: z.string(),
		DATABASE_PASSWORD: z.string(),
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
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
