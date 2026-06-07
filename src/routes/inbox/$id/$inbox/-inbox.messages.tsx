import { type QueryKey, queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { Inbox } from 'lucide-react';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '~/components/ui/empty';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '~/components/ui/item';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import { dateAndTime, relativeTime } from '~/lib/datetime';
import { messageFlags } from '~/lib/email';
import Email from '~/lib/email.server';
import logger from '~/lib/logger.server';
import { emailMiddleware } from '~/lib/middleware';
import { type RouteSearchSchema, routeSearchSchema } from './-route.schema';

const Route = getRouteApi('/inbox/$id/$inbox/');

const fetchInbox = createServerFn({ method: 'GET' })
	.validator(routeSearchSchema)
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
			logger.verbose('Fetched inbox emails for inbox:%s by user:%s', email.id, user.id);

			return messages;
		} catch (err) {
			if (err instanceof Error && 'mailboxMissing' in err && err.mailboxMissing) {
				throw Route.redirect({ to: '/inbox/$id/$inbox', params: { id: email.id, inbox: 'INBOX' } });
			}

			logger.warn('Fetching inbox emails failed: %s', err);
			throw err;
		}
	});

const inboxQueryKey = 'email-inbox-emails' as const;
export const invalidateInboxQueryKey = (options: Pick<RouteSearchSchema, 'id' | 'inbox'>) =>
	[inboxQueryKey, options satisfies Partial<RouteSearchSchema>] satisfies QueryKey;

export const inboxOptions = (data: RouteSearchSchema) =>
	queryOptions({
		queryKey: [inboxQueryKey, data],
		queryFn: () => fetchInbox({ data }),
		refetchOnWindowFocus: true,
	});

export default function InboxMessages() {
	const parameters = Route.useParams();
	const { messageId: _, ...search } = Route.useSearch();
	const {
		data: { data: messages },
	} = useSuspenseQuery(inboxOptions({ ...parameters, ...search }));

	return (
		<ScrollArea className="flex flex-col overflow-y-auto">
			{messages.length > 0 ? (
				messages.map((message) => {
					const initials =
						message.envelope?.from
							?.at(0)
							?.name?.split(' ')
							.map((name) => name.at(0))
							.join('') || message.envelope?.from?.at(0)?.address?.at(0);
					const from = message.envelope?.from?.map((recipient) => recipient.name || recipient.address).join(', ');
					const seen = message.flags?.has(messageFlags.enum.Seen);

					return (
						<Item
							key={message.uid}
							variant="outline"
							className="rounded-none not-data-seen:border-l-5 not-data-seen:border-l-ring not-data-seen:pl-3 odd:bg-card/90"
							{...(seen ? { 'data-seen': seen } : {})}
							render={
								<Route.Link
									search={{ messageId: message.uid }}
									preload={false}
									activeOptions={{ includeSearch: true }}
									className="data-[status=active]:border-l-5 data-[status=active]:border-l-primary data-[status=active]:pl-3"
								/>
							}
						>
							<ItemMedia variant="icon">
								<Avatar>
									<AvatarFallback className="text-clip">{initials?.toWellFormed()}</AvatarFallback>
								</Avatar>
							</ItemMedia>
							<ItemContent>
								<ItemTitle className="flex w-full flex-row justify-between">
									<span>{from}</span>
									<Tooltip>
										<TooltipTrigger
											render={
												<span suppressHydrationWarning>
													{message.envelope?.date ? relativeTime(message.envelope.date) : 'Unknown Date'}
												</span>
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
				})
			) : (
				<div className="flex size-full items-center justify-center">
					<Empty className="max-w-2/3 border border-destructive border-dashed sm:max-w-1/2">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Inbox />
							</EmptyMedia>
							<EmptyTitle>No Messages Found</EmptyTitle>
							<EmptyDescription>
								A grand total of 0 email messages were found in this mailbox with the specified filters!
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				</div>
			)}
		</ScrollArea>
	);
}
