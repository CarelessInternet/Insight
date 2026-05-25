import { defineConfig } from 'drizzle-kit';
import { environment } from '~/lib/environment.server';

export default defineConfig({
	breakpoints: true,
	dbCredentials: { url: environment.DATABASE_URL },
	dialect: 'postgresql',
	out: './migrations',
	schema: './src/lib/database/schema.ts',
	strict: true,
	verbose: true,
});
