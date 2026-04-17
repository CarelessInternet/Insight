import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import type { EmailId } from '~/lib/email';
import Email from '~/lib/email.server';
import logger from '~/lib/logger.server';
import { inboxMiddleware } from '~/lib/middleware';

const fetchInbox = createServerFn({ method: 'GET' })
	.middleware([inboxMiddleware])
	.handler(async ({ context: { email, user } }) => {
		await using imapEmail = new Email({
			email: email.email,
			hostname: email.hostname,
			password: email.password,
		});
		await imapEmail.connect();

		if (!imapEmail.authenticated) {
			await database
				.update(emailAccount)
				.set({ status: 'invalid' })
				.where(and(eq(emailAccount.userId, user.id), eq(emailAccount.id, email.id)));
			throw redirect({ to: '/account/settings' });
		}

		const messages = await imapEmail.getMailboxMessages('INBOX');
		logger.info('Fetched messages for inbox:%s by user:%s', email.id, user.id);

		return messages;
	});

export const inboxOptions = (id: EmailId) =>
	queryOptions({
		queryKey: ['email-inbox', id],
		queryFn: () => fetchInbox({ data: id }),
	});

export default function Inbox({ id }: { id: EmailId }) {
	const { data: messages } = useSuspenseQuery(inboxOptions(id));

	return <p>hiii</p>;
}
