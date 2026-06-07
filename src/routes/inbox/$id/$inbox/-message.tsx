import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { Suspense, useEffect, useRef } from 'react';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import { type MessageFlagsSet, messageFlags } from '~/lib/email';
import Email from '~/lib/email.server';
import logger from '~/lib/logger.server';
import { emailMiddleware } from '~/lib/middleware';
import { invalidateInboxQueryKey } from './-inbox.messages';
import { type RouteMessageSchema, routeMessageSchema } from './-route.schema';

const Route = getRouteApi('/inbox/$id/$inbox/');

const fetchInboxMessage = createServerFn({ method: 'GET' })
	.validator(routeMessageSchema)
	.middleware([emailMiddleware({ decrypt: true })])
	.handler(async ({ context: { email, user }, data: { inbox, messageId } }) => {
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
			const message = await imapEmail.getMessage({ inbox, messageId });
			logger.verbose('Fetched inbox email message for inbox:%s by user:%s', email.id, user.id);

			return message;
		} catch (err) {
			if (err instanceof Error && 'mailboxMissing' in err && err.mailboxMissing) {
				throw Route.redirect({ to: '/inbox/$id/$inbox', params: { id: email.id, inbox: 'INBOX' } });
			}

			logger.warn('Fetching inbox email message failed: %s', err);
			throw err;
		}
	});

export const inboxMessageOptions = (data: RouteMessageSchema) =>
	queryOptions({
		queryKey: ['email-inbox-message', data],
		queryFn: () => fetchInboxMessage({ data }),
	});

const markMessageAsReadFn = createServerFn({ method: 'POST' })
	.validator(routeMessageSchema)
	.middleware([emailMiddleware({ decrypt: true })])
	.handler(async ({ context: { email, user }, data: { inbox, messageId } }) => {
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
			const flagSuccess = await imapEmail.addMessageFlags({
				flags: (new Set() satisfies MessageFlagsSet).add(messageFlags.enum.Seen),
				inbox,
				messageId,
			});

			if (flagSuccess) {
				logger.debug('Marked a message as read by user:%s', user.id);
			}

			return flagSuccess;
		} catch (err) {
			if (err instanceof Error && 'mailboxMissing' in err && err.mailboxMissing) {
				throw Route.redirect({ to: '/inbox/$id/$inbox', params: { id: email.id, inbox: 'INBOX' } });
			}

			logger.warn('Marking inbox email message as read failed: %s', err);
			return false;
		}
	});

export default function InboxMessage({ messageId }: { messageId: RouteMessageSchema['messageId'] }) {
	return (
		<div>
			<p>hi</p>
			<Suspense fallback="Loading...">
				<MessageContent messageId={messageId} />
			</Suspense>
		</div>
	);
}

function MessageContent({ messageId }: { messageId: RouteMessageSchema['messageId'] }) {
	const parameters = Route.useParams();
	const query = inboxMessageOptions({ ...parameters, messageId });
	const { data: message, refetch } = useSuspenseQuery(query);

	const markMessageAsRead = useServerFn(markMessageAsReadFn);
	const queryClient = useQueryClient();
	const currentMessageId = useRef(messageId);
	const shouldRevalidate = useRef(false);

	// Moving handleMarkAsRead to a useEffectEvent broke the intended behaviour.
	// biome-ignore lint/correctness/useExhaustiveDependencies: Only revalidate if messageId changes.
	useEffect(() => {
		async function handleMarkAsRead() {
			// Revalidate the inbox if the newly read message is clicked away in order to reflect the new seen state.
			if (currentMessageId.current !== messageId) {
				if (shouldRevalidate.current) {
					await queryClient.invalidateQueries({
						queryKey: invalidateInboxQueryKey(parameters),
					});
				}

				shouldRevalidate.current = false;
				currentMessageId.current = messageId;
			}

			if (message && !message.flags?.has(messageFlags.enum.Seen)) {
				const success = await markMessageAsRead({ data: { ...parameters, messageId } });
				shouldRevalidate.current = success;

				if (success) {
					await refetch();
				}
			}
		}

		void handleMarkAsRead();
	}, [messageId]);

	return <p>{message?.bodyStructure?.type}</p>;
}
