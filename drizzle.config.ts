import { defineConfig } from 'drizzle-kit';
import { url } from '~/lib/database/drizzle';

export default defineConfig({
	breakpoints: true,
	dbCredentials: { url },
	dialect: 'postgresql',
	out: './migrations',
	schema: './src/lib/database/schema.ts',
	strict: true,
	verbose: true,
});
