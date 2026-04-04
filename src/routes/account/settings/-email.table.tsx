import { queryOptions } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { sessionMiddleware } from '~/lib/authentication/middleware';
import { database } from '~/lib/database/drizzle';
import { emailAccount } from '~/lib/database/schema';
import logger from '~/lib/logger.server';

const fetchEmailAccounts = createServerFn({ method: 'GET' })
	.middleware([sessionMiddleware])
	.handler(async ({ context }) => {
		const accounts = await database.select().from(emailAccount).where(eq(emailAccount.userId, context.user.id));
		logger.debug('Fetched email accounts for user:%s', context.user.id);

		return accounts;
	});

export const emailAccountsOptions = queryOptions({
	queryKey: ['email-accounts'],
	queryFn: fetchEmailAccounts,
});

interface Table {
	hostname: string;
	email: string;
}

export function EmailTable() {}
