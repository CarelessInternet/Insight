import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '~/components/ui/item';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import { dateAndTime, relativeTime } from '~/lib/datetime';
import Email from '~/lib/email.server';
import logger from '~/lib/logger.server';
import { emailMiddleware } from '~/lib/middleware';
import { type RouteSearchSchema, routeSearchSchema } from './-route.schema';

const Route = getRouteApi('/inbox/$id/$inbox/');

const fetchInbox = createServerFn({ method: 'GET' })
	.inputValidator(routeSearchSchema)
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
			const messages = await imapEmail.getPaginatedMailboxMessages(data);
			logger.info('Fetched inbox emails for inbox:%s by user:%s', email.id, user.id);

			return messages;
		} catch (err) {
			if (err instanceof Error && 'mailboxMissing' in err && err.mailboxMissing) {
				throw Route.redirect({ to: '/inbox/$id/$inbox', params: { id: email.id, inbox: 'INBOX' } });
			}

			// TODO: display a proper failed state in the UI.
			logger.warn('Fetching inbox emails failed: %s', err);
			return [];
		}
	});

export const inboxOptions = (data: RouteSearchSchema) =>
	queryOptions({
		queryKey: ['email-inbox-emails', data],
		queryFn: () => fetchInbox({ data }),
		// TODO: change to true
		refetchOnWindowFocus: false,
	});

export default function InboxMessages() {
	const parameters = Route.useParams();
	const { messageId: _, ...search } = Route.useSearch();
	const { data: messages } = useSuspenseQuery(inboxOptions({ ...parameters, ...search }));

	return (
		<ScrollArea className="flex flex-col overflow-y-auto">
			TODO: use the Empty component to display an empty state.
			{messages.map((message) => {
				const from = message.envelope?.from?.map((recipient) => recipient.name || recipient.address);

				return (
					<Item
						key={message.uid}
						variant="outline"
						className="rounded-none even:bg-card/90"
						render={<Route.Link search={{ messageId: message.uid }} />}
					>
						<ItemMedia variant="icon">
							<Avatar>
								<AvatarFallback>{from?.at(0)?.at(0)}</AvatarFallback>
							</Avatar>
						</ItemMedia>
						<ItemContent>
							<ItemTitle className="flex w-full flex-row justify-between">
								<span>{from?.join(', ')}</span>
								<Tooltip>
									<TooltipTrigger
										render={
											<span>{message.envelope?.date ? relativeTime(message.envelope.date) : 'Unknown Date'}</span>
										}
									/>
									<TooltipContent>
										<p>{message.envelope?.date ? dateAndTime(message.envelope.date) : 'Unknown Date'}</p>
									</TooltipContent>
								</Tooltip>
							</ItemTitle>
							<ItemDescription>{message.envelope?.subject}</ItemDescription>
						</ItemContent>
					</Item>
				);
			})}
		</ScrollArea>
	);
}
