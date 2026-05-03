import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import Email from '~/lib/email.server';
import logger from '~/lib/logger.server';
import { type EmailMiddlewareSchema, emailMiddleware } from '~/lib/middleware';

const Route = getRouteApi('/inbox/$id/$inbox/');

const fetchInbox = createServerFn({ method: 'GET' })
	.middleware([emailMiddleware({ decrypt: true })])
	.handler(async ({ context: { email, user }, data }) => {
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
			throw Route.redirect({ to: '/account/settings' });
		}

		try {
			const messages = await imapEmail.getMailboxMessages(data.inbox);
			logger.info('Fetched inbox emails for inbox:%s by user:%s', email.id, user.id);

			return messages;
		} catch (err) {
			if (err instanceof Error && 'mailboxMissing' in err && err.mailboxMissing) {
				throw Route.redirect({ to: '/inbox/$id/$inbox', params: { id: email.id, inbox: 'INBOX' } });
			}

			logger.warn(err);
			return [];
		}
	});

export const inboxOptions = ({ id, inbox }: EmailMiddlewareSchema) =>
	queryOptions({
		queryKey: ['email-inbox-emails', id, inbox],
		queryFn: () => fetchInbox({ data: { id, inbox } }),
		refetchOnWindowFocus: true,
	});

// TODO: Resizable component for email list and email message would be sick.
export default function Inbox() {
	const parameters = Route.useParams();
	const { data: messages } = useSuspenseQuery(inboxOptions(parameters));

	return <p>hiii</p>;
}
