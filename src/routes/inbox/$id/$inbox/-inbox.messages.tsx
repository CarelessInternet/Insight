import { type QueryKey, queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { Inbox } from 'lucide-react';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '~/components/ui/empty';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '~/components/ui/item';
import { ScrollArea, ScrollAreaContent } from '~/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import { dateAndTime, relativeTime } from '~/lib/datetime';
import { getSenderInfo, getSubject, messageFlags } from '~/lib/email';
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
			if (Error.isError(err) && 'mailboxMissing' in err && err.mailboxMissing) {
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
		<ScrollArea className="@container flex flex-col overflow-y-auto">
			<ScrollAreaContent>
				{messages.length > 0 ? (
					messages.map((message) => {
						const { from, initials } = getSenderInfo(message.envelope?.from);
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
										<AvatarFallback>{initials}</AvatarFallback>
									</Avatar>
								</ItemMedia>
								<ItemContent>
									<ItemDescription className="flex w-full @sm:flex-row flex-col items-baseline justify-between gap-0">
										<Tooltip>
											<TooltipTrigger render={<span>{from}</span>} />
											<TooltipContent>
												<p>{message.envelope?.from?.map((sender) => `<${sender.address}>`).join(', ')}</p>
											</TooltipContent>
										</Tooltip>
										<Tooltip>
											<TooltipTrigger
												render={
													<span className="text-muted-foreground/80" suppressHydrationWarning>
														{message.envelope?.date ? relativeTime(message.envelope.date) : 'Unknown Date'}
													</span>
												}
											/>
											<TooltipContent>
												<p>{message.envelope?.date ? dateAndTime(message.envelope.date) : 'Unknown Date'}</p>
											</TooltipContent>
										</Tooltip>
									</ItemDescription>
									<ItemTitle>{getSubject(message.envelope?.subject)}</ItemTitle>
								</ItemContent>
							</Item>
						);
					})
				) : (
					<div className="flex size-full items-center justify-center">
						<Empty className="@sm:max-w-2/3 max-w-4/5 border border-destructive border-dashed">
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
			</ScrollAreaContent>
		</ScrollArea>
	);
}
