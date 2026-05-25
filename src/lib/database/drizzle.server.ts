import { drizzle } from 'drizzle-orm/bun-sql';
import { environment } from '../environment.server';
import * as schema from './schema';

const createDatabase = () => drizzle({ connection: environment.DATABASE_URL, schema });

// biome-ignore lint/suspicious/noAssignInExpressions: This is wicked.
export const database = (import.meta.hot.data.database ??= createDatabase()) as ReturnType<typeof createDatabase>;
