import { drizzle } from 'drizzle-orm/bun-sql';
import { environment } from '../environment.server';
import * as schema from './schema';

export const url = `postgresql://${environment.DATABASE_USERNAME}:${environment.DATABASE_PASSWORD}@${environment.DATABASE_HOST}:${environment.DATABASE_PORT}/${environment.DATABASE_DB}`;

const createDatabase = () => drizzle({ connection: url, schema });
type Database = ReturnType<typeof createDatabase>;

// biome-ignore lint/suspicious/noAssignInExpressions: This is wicked.
export const database = (import.meta.hot.data.database ??= createDatabase()) as Database;
