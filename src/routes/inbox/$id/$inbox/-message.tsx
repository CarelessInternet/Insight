import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import {
	ChevronDown,
	Flag,
	FolderTree,
	Forward,
	Image as ImageIcon,
	MailCheck,
	MailOpen,
	MessageCircleReply,
	Reply,
	ReplyAll,
	Settings,
	ShieldAlert,
	ShieldMinus,
	Tag,
} from 'lucide-react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Field, FieldLabel } from '~/components/ui/field';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '~/components/ui/item';
import {
	Menubar,
	MenubarContent,
	MenubarGroup,
	MenubarItem,
	MenubarMenu,
	MenubarSeparator,
	MenubarTrigger,
} from '~/components/ui/menubar';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '~/components/ui/popover';
import { ScrollArea, ScrollAreaContent } from '~/components/ui/scroll-area';
import { Skeleton } from '~/components/ui/skeleton';
import { Switch } from '~/components/ui/switch';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import { dateAndTime } from '~/lib/datetime';
import {
	getSenderInfo,
	type MessageFlagsSet,
	messageFlags,
	replaceInlineImages,
	sanitizeMessageHtml,
} from '~/lib/email';
import Email from '~/lib/email.server';
import logger from '~/lib/logger.server';
import { emailMiddleware } from '~/lib/middleware';
import { invalidateInboxQueryKey } from './-inbox.messages';
import { type RouteMessageSchema, routeMessageSchema } from './-route.schema';

const Route = getRouteApi('/inbox/$id/$inbox/');

// The email source from the getMessage method is serializable.
const fetchInboxMessage = createServerFn({ method: 'GET', strict: { output: false } })
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
			if (Error.isError(err) && 'mailboxMissing' in err && err.mailboxMissing) {
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
			if (Error.isError(err) && 'mailboxMissing' in err && err.mailboxMissing) {
				throw Route.redirect({ to: '/inbox/$id/$inbox', params: { id: email.id, inbox: 'INBOX' } });
			}

			logger.warn('Marking inbox email message as read failed: %s', err);
			return false;
		}
	});

export default function InboxMessage({ messageId }: { messageId: RouteMessageSchema['messageId'] }) {
	const parameters = Route.useParams();
	const query = inboxMessageOptions({ ...parameters, messageId });
	const { data: message, refetch } = useQuery(query);

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

			if (message?.imap.flags && !message.imap.flags.has(messageFlags.enum.Seen)) {
				const success = await markMessageAsRead({ data: { ...parameters, messageId } });
				shouldRevalidate.current = success;

				if (success) {
					await refetch();
				}
			}
		}

		void handleMarkAsRead();
	}, [messageId]);

	return (
		<div className="size-full max-h-[calc(100dvh-var(--header-height))] overflow-hidden p-4">
			<Card className="size-full pt-0">
				<Menubar className="rounded-none border-0 border-b bg-accent/40 px-2">
					<MenubarMenu disabled>
						<MenubarTrigger className="gap-1.5">
							<MessageCircleReply className="size-4" /> Respond
						</MenubarTrigger>
						<MenubarContent>
							<MenubarGroup>
								<MenubarItem>
									<Reply /> Reply
								</MenubarItem>
								<MenubarItem>
									<ReplyAll /> Reply All
								</MenubarItem>
								<MenubarSeparator />
								<MenubarItem>
									<Forward /> Forward
								</MenubarItem>
							</MenubarGroup>
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu>
						<MenubarTrigger className="gap-1.5">
							<Tag className="size-4" /> Mark
						</MenubarTrigger>
						<MenubarContent>
							<MenubarGroup>
								<MenubarItem disabled={message?.imap.flags?.has(messageFlags.enum.Seen)}>
									<MailOpen /> As Read
								</MenubarItem>
								<MenubarItem disabled={!message?.imap.flags?.has(messageFlags.enum.Seen)}>
									<MailCheck /> As Unread
								</MenubarItem>
								<MenubarSeparator />
								<MenubarItem disabled>
									<Flag className="fill-foreground" /> As Flagged
								</MenubarItem>
								<MenubarItem disabled>
									<Flag /> As Unflagged
								</MenubarItem>
							</MenubarGroup>
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu disabled>
						<MenubarTrigger className="gap-1.5">
							<FolderTree className="size-4" /> Move
						</MenubarTrigger>
						<MenubarContent>
							<MenubarGroup>
								<MenubarItem>Temp</MenubarItem>
							</MenubarGroup>
						</MenubarContent>
					</MenubarMenu>
				</Menubar>
				<Suspense
					fallback={
						<div className="flex size-full flex-col gap-4 px-4">
							<Skeleton className="h-8" />
							<Skeleton className="h-full" />
						</div>
					}
				>
					<MessageContent messageId={messageId} />
				</Suspense>
			</Card>
		</div>
	);
}

function MessageContent({ messageId }: { messageId: RouteMessageSchema['messageId'] }) {
	const parameters = Route.useParams();
	const query = inboxMessageOptions({ ...parameters, messageId });
	const { data: message } = useSuspenseQuery(query);

	const [allowRemoteSrc, setAllowRemoteSrc] = useState(false);
	const [remoteBlockedNoticeId, setRemoteBlockedNoticeId] = useState<number | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Run on new message ID.
	useEffect(() => {
		setAllowRemoteSrc(false);
	}, [messageId]);

	const { messageHtml, sawRemoteSrc } = sanitizeMessageHtml(message?.source.html, allowRemoteSrc);
	const showRemoteBlockedNotice =
		!!message?.source.html && sawRemoteSrc && !allowRemoteSrc && remoteBlockedNoticeId !== messageId;

	const { from, initials } = getSenderInfo(message?.source.from);

	// TODO: proper Empty component here
	if (!message) {
		return <p>bruh</p>;
	}

	// TODO: mobile view looks terrible. Fix centering.
	return (
		// "pr-2" to prevent the scroll-bar from overlapping the message content.
		<ScrollArea className="size-full overflow-auto data-has-overflow-y:pr-2">
			<ScrollAreaContent className="flex flex-col gap-4">
				<Item className="px-6 py-0">
					<ItemMedia variant="icon">
						<Avatar className="size-10">
							<AvatarFallback>{initials}</AvatarFallback>
						</Avatar>
					</ItemMedia>
					<ItemContent className="gap-0">
						<ItemTitle>
							<span className="font-semibold text-base">{from}</span>
							<span className="text-muted-foreground text-sm">{`<${message.source.from?.address}>`}</span>
						</ItemTitle>
						<ItemDescription className="flex flex-row gap-1">
							<span>To: {message.source.deliveredTo}</span>
							<Popover>
								<PopoverTrigger
									render={
										<Button variant="ghost" size="icon-xs" className="text-foreground">
											<ChevronDown />
										</Button>
									}
								/>
								<PopoverContent>
									<PopoverHeader>
										<PopoverTitle>Hi</PopoverTitle>
									</PopoverHeader>
								</PopoverContent>
							</Popover>
						</ItemDescription>
					</ItemContent>
					<ItemActions>
						<Popover>
							<PopoverTrigger
								render={
									<Button variant="secondary">
										<Settings /> Settings
									</Button>
								}
							/>
							<PopoverContent>
								<PopoverHeader>
									<PopoverTitle>Configure Message Settings</PopoverTitle>
								</PopoverHeader>
								<Field orientation="horizontal">
									<FieldLabel htmlFor="remote-resources">
										<ImageIcon className="size-4" /> Allow Remote Resources
									</FieldLabel>
									<Switch
										id="remote-resources"
										checked={allowRemoteSrc}
										onCheckedChange={() => {
											setAllowRemoteSrc((previous) => !previous);
											setRemoteBlockedNoticeId(messageId);
										}}
										disabled={!message.source.html}
									/>
								</Field>
							</PopoverContent>
						</Popover>
					</ItemActions>
				</Item>
				<CardHeader className="px-4 sm:px-6">
					<CardTitle className="font-bold text-lg">{message.source.subject}</CardTitle>
					<CardAction>
						<Badge variant="ghost">{message.source.date ? dateAndTime(message.source.date) : 'Unknown Date'}</Badge>
					</CardAction>
				</CardHeader>
				{showRemoteBlockedNotice && (
					<div className="px-6">
						<Item variant="warning" size="xs" className="w-full">
							<ItemMedia variant="icon">
								<ShieldAlert />
							</ItemMedia>
							<ItemContent>
								<ItemTitle>Remote Resources Were Blocked!</ItemTitle>
								<ItemDescription>
									This enhances your privacy and security by preventing e.g. tracking via images.
								</ItemDescription>
							</ItemContent>
							<ItemActions>
								<Button
									size="sm"
									onClick={() => {
										setAllowRemoteSrc(true);
										setRemoteBlockedNoticeId(messageId);
									}}
								>
									<ShieldMinus data-icon="inline-start" />
									Allow Remote Resources
								</Button>
							</ItemActions>
						</Item>
					</div>
				)}
				<CardContent className="size-full px-4 sm:px-6">
					{messageHtml ? (
						<iframe
							srcDoc={replaceInlineImages(messageHtml, message.source.attachments)}
							title={message.source.subject}
							sandbox=""
							referrerPolicy="no-referrer"
							className="size-full"
						/>
					) : (
						<p className="wrap-anywhere whitespace-pre-wrap text-wrap">{message.source.text}</p>
					)}
				</CardContent>
			</ScrollAreaContent>
		</ScrollArea>
	);
}
