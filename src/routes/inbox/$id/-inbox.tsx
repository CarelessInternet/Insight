import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { decrypt } from '~/lib/crypto';
import { database } from '~/lib/database/drizzle';
import { emailAccount } from '~/lib/database/schema';
import type { EmailId } from '~/lib/email';
import Email from '~/lib/email.server';
import logger from '~/lib/logger.server';
import { inboxMiddleware } from '~/lib/middleware';

const fetchInbox = createServerFn({ method: 'GET' })
	.middleware([inboxMiddleware])
	.handler(async ({ context }) => {
		await using imapEmail = await Email.connect({
			email: context.email.email,
			hostname: context.email.hostname,
			password: await decrypt({ data: context.email.password }),
		});

		if (!imapEmail.authenticated) {
			await database.update(emailAccount).set({ status: 'invalid' }).where(eq(emailAccount.id, context.email.id));
			throw redirect({ to: '/account/settings' });
		}

		const messages = await imapEmail.getMailboxMessages('INBOX');
		logger.info('Fetched messages for inbox:%s for user:%s', context.email.id, context.user.id);

		return messages;
	});

// type Inbox = Awaited<ReturnType<typeof fetchInbox>>;

export const inboxOptions = (id: EmailId) =>
	queryOptions({
		queryKey: ['email-inbox', id],
		queryFn: () => fetchInbox({ data: id }),
		refetchOnWindowFocus: false,
	});

export default function Inbox({ id }: { id: EmailId }) {
	const { data: messages } = useSuspenseQuery(inboxOptions(id));
	console.log('messages', messages);

	return <p>hiii</p>;
}
