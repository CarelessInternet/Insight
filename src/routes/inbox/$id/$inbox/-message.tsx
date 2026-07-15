import IframeResizer from '@iframe-resizer/react';
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import {
	ChevronDown,
	ChevronRight,
	ExternalLink,
	Eye,
	FileCode,
	FileDown,
	FileText,
	Image as ImageIcon,
	Paperclip,
	Printer,
	Settings,
	ShieldAlert,
	ShieldMinus,
	SquareDashedText,
	X,
} from 'lucide-react';
import { Suspense, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import {
	Attachment,
	AttachmentAction,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentGroup,
	AttachmentMedia,
	AttachmentTitle,
} from '~/components/ui/attachment';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { Button, buttonVariants } from '~/components/ui/button';
import { ButtonGroup } from '~/components/ui/button-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Field, FieldLabel } from '~/components/ui/field';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '~/components/ui/item';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '~/components/ui/popover';
import { ScrollArea, ScrollAreaContent, ScrollAreaViewport, ScrollBar } from '~/components/ui/scroll-area';
import { Skeleton } from '~/components/ui/skeleton';
import { Switch } from '~/components/ui/switch';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import {
	getSenderInfo,
	type MessageFlagsSet,
	messageFlags,
	replaceInlineImages,
	sanitizeMessageHtml,
} from '~/lib/email';
import Email from '~/lib/email.server';
import { bytesToSize, dateAndTime } from '~/lib/formatter';
import logger from '~/lib/logger.server';
import { emailMiddleware } from '~/lib/middleware';
import { downloadAttachment, useEmailAttachments } from './-blob';
import { invalidateInboxQueryKey } from './-inbox.messages';
import MessageMenubar from './-message.menubar';
import { type RouteMessageSchema, routeMessageSchema } from './-route.schema';
import { invalidateFoldersQueryKey } from './-sidebar.folders';

const Route = getRouteApi('/inbox/$id/$inbox/');

// The email source from the getMessage method is serializable.
const fetchInboxMessage = createServerFn({ method: 'GET', strict: { output: false } })
	.validator(routeMessageSchema)
	.middleware([emailMiddleware])
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
	.middleware([emailMiddleware])
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

	const onMessageRead = useEffectEvent(async () => {
		if (await markMessageAsRead({ data: { ...parameters, messageId } })) {
			// Refetch to revalidate the message variable to not cause unnecessary invalidations.
			void refetch();
			void queryClient.invalidateQueries({
				queryKey: invalidateInboxQueryKey(parameters),
			});
			void queryClient.invalidateQueries({
				queryKey: invalidateFoldersQueryKey(parameters.id),
			});
		}
	});

	useEffect(() => {
		if (message?.imap.flags && !message.imap.flags.has(messageFlags.enum.Seen)) {
			onMessageRead();
		}
	}, [message]);

	return (
		<div className="size-full max-h-[calc(100dvh-var(--header-height))] overflow-hidden p-4">
			<Card className="size-full gap-4 pt-0">
				<MessageMenubar messageId={messageId} />
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

	const [remoteBlockedNoticeId, setRemoteBlockedNoticeId] = useState<number | null>(null);

	const [allowRemoteSrc, setAllowRemoteSrc] = useState(false);
	const [textMode, setTextMode] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Run on new message ID.
	useEffect(() => {
		setAllowRemoteSrc(false);
	}, [messageId]);

	const { messageHtml, sawRemoteSrc } = sanitizeMessageHtml(message?.source.html, allowRemoteSrc);
	const showRemoteBlockedNotice =
		!!message?.source.html && sawRemoteSrc && !allowRemoteSrc && remoteBlockedNoticeId !== messageId;

	const { from, initials } = getSenderInfo(message?.source.from);

	const attachments = useEmailAttachments(message?.source.attachments.filter(({ related }) => !related));

	const contentRef = useRef<HTMLDivElement>(null);
	const printEmail = useReactToPrint({ contentRef, documentTitle: message?.source.subject });

	// TODO: proper Empty component here
	if (!message) {
		return <p>bruh</p>;
	}

	// TODO: fix bug where when the iframe content is smaller after load, the scrollbar is still present.
	// TODO: bug where too big of an attachment causes a Seroval node type 19 (ArrayBuffer) error.
	return (
		<ScrollArea className="size-full overflow-y-auto">
			<ScrollAreaViewport>
				<ScrollAreaContent className="@container flex flex-col gap-4 px-4 sm:px-6">
					<Item className="p-0">
						<ItemMedia variant="icon">
							<Avatar className="size-10">
								<AvatarFallback>{initials}</AvatarFallback>
							</Avatar>
						</ItemMedia>
						<ItemContent className="gap-0">
							<ItemTitle className="@2xl:flex-row flex-col items-baseline @2xl:gap-2 gap-0">
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
							<ButtonGroup>
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
										<Field orientation="horizontal">
											<FieldLabel htmlFor="text-mode">
												<SquareDashedText className="size-4" /> Text Mode
											</FieldLabel>
											<Switch
												id="text-mode"
												checked={textMode}
												onCheckedChange={setTextMode}
												disabled={!message.source.html || !message.source.text}
											/>
										</Field>
									</PopoverContent>
								</Popover>
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<Button variant="secondary" className="pl-2">
												<ChevronDown />
											</Button>
										}
									/>
									<DropdownMenuContent>
										<DropdownMenuGroup>
											<DropdownMenuLabel>View</DropdownMenuLabel>
											<DropdownMenuItem
												render={
													<Route.Link
														to="/inbox/$id/$inbox/$messageId/source"
														params={{ ...parameters, messageId: messageId.toString() }}
														target="_blank"
													>
														<FileCode />
														Show Source
													</Route.Link>
												}
											/>
											<DropdownMenuItem onClick={printEmail}>
												<Printer />
												Print Email
											</DropdownMenuItem>
										</DropdownMenuGroup>
									</DropdownMenuContent>
								</DropdownMenu>
							</ButtonGroup>
						</ItemActions>
					</Item>
					<CardHeader className="flex @lg:grid @lg:grid-flow-row flex-col gap-0 px-0">
						<CardTitle className="font-bold text-lg">{message.source.subject}</CardTitle>
						<CardDescription>
							on {message.source.date ? dateAndTime(message.source.date) : 'Unknown Date'}
						</CardDescription>
					</CardHeader>
					{attachments.length > 0 && (
						// For some reason, making this component a container forces the AttachmentGroup to respect the 100% width.
						<Collapsible defaultOpen className="@container w-full rounded-lg border">
							<CollapsibleTrigger
								nativeButton={false}
								render={
									<Item size="xs" className="rounded-none">
										<ItemMedia variant="icon">
											<Paperclip />
										</ItemMedia>
										<ItemContent>
											<ItemTitle>Attachments</ItemTitle>
										</ItemContent>
										<ItemActions>
											<ChevronRight className="ml-auto transition-transform group-data-panel-open/item:rotate-90" />
										</ItemActions>
									</Item>
								}
							/>
							<CollapsibleContent className="bg-muted/30 p-2">
								<AttachmentGroup className="w-full">
									{attachments.map(({ blobUrl, content, filename, mimeType }) => {
										const name = filename || message.source.subject;

										return (
											// There is no unique identifier. File names can collide.
											<Attachment key={crypto.randomUUID()}>
												<AttachmentMedia>
													<FileText className="size-6" />
												</AttachmentMedia>
												<AttachmentContent>
													<AttachmentTitle className="truncate">{name}</AttachmentTitle>
													<AttachmentDescription>
														{bytesToSize((typeof content === 'string' ? Buffer.from(content) : content).byteLength)} ·{' '}
														{mimeType}
													</AttachmentDescription>
												</AttachmentContent>
												<AttachmentActions>
													<Dialog>
														<DialogTrigger
															render={
																<AttachmentAction aria-label={`Open the preview of ${name}`}>
																	<Eye />
																</AttachmentAction>
															}
														/>
														<DialogContent className="h-[90vh] max-w-9/10! grid-rows-[auto_1fr_auto]">
															<DialogHeader>
																<DialogTitle className="wrap-anywhere pr-4">{name}</DialogTitle>
																<DialogDescription>{mimeType}</DialogDescription>
															</DialogHeader>
															<embed type={mimeType} src={blobUrl} className="size-full" />
															<DialogFooter>
																<DialogClose
																	render={
																		<Button variant="outline">
																			<X data-icon="inline-start" />
																			Close
																		</Button>
																	}
																/>
																<a
																	href={blobUrl}
																	target="_blank"
																	className={buttonVariants({ variant: 'secondary' })}
																	rel="noopener"
																>
																	<ExternalLink data-icon="inline-start" />
																	Open in New Tab
																</a>
																<Button onClick={() => downloadAttachment(blobUrl, name)}>
																	<FileDown data-icon="inline-start" />
																	Download
																</Button>
															</DialogFooter>
														</DialogContent>
													</Dialog>
													<AttachmentAction
														aria-label={`Download ${name}`}
														onClick={() => downloadAttachment(blobUrl, name)}
													>
														<FileDown />
													</AttachmentAction>
												</AttachmentActions>
											</Attachment>
										);
									})}
								</AttachmentGroup>
							</CollapsibleContent>
						</Collapsible>
					)}
					{showRemoteBlockedNotice && !textMode && (
						<Item variant="warning" size="xs" className="w-full">
							<ItemMedia variant="icon">
								<ShieldAlert />
							</ItemMedia>
							<ItemContent className="min-w-0 flex-1">
								<ItemTitle>Remote Resources Were Blocked!</ItemTitle>
								<ItemDescription>
									This enhances your privacy and security by preventing e.g. tracking via images.
								</ItemDescription>
							</ItemContent>
							<ItemActions className="@lg:ml-auto @lg:basis-auto basis-full">
								<ButtonGroup
									className="@lg:w-fit w-full justify-end"
									aria-label="Remote resources warning message actions"
								>
									<Button
										size="sm"
										onClick={() => {
											setAllowRemoteSrc(true);
											setRemoteBlockedNoticeId(messageId);
										}}
									>
										<ShieldMinus data-icon="inline-start" />
										Allow Remote
									</Button>
									<Button
										variant="secondary"
										size="sm"
										onClick={() => {
											setAllowRemoteSrc(false);
											setRemoteBlockedNoticeId(messageId);
										}}
									>
										<X data-icon="inline-start" /> Close
									</Button>
								</ButtonGroup>
							</ItemActions>
						</Item>
					)}
					<CardContent ref={contentRef} className="size-full px-0">
						{messageHtml && !textMode ? (
							<IframeResizer
								suppressHydrationWarning
								// https://iframe-resizer.com/gpl/
								license="GPLv3"
								log="collapsed"
								srcDoc={replaceInlineImages(messageHtml, message.source.attachments)}
								title={message.source.subject}
								sandbox="allow-scripts"
								referrerPolicy="no-referrer"
								className="h-screen w-full rounded-2xl"
							/>
						) : (
							<p className="wrap-anywhere whitespace-pre-wrap text-wrap">{message.source.text}</p>
						)}
					</CardContent>
				</ScrollAreaContent>
			</ScrollAreaViewport>
			<ScrollBar />
		</ScrollArea>
	);
}
