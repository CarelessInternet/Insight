import IframeResizer from '@iframe-resizer/react';
import { type QueryKey, queryOptions, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, useRouter } from '@tanstack/react-router';
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
	MailQuestionMark,
	Paperclip,
	Printer,
	Settings,
	ShieldAlert,
	ShieldMinus,
	SquareDashedText,
	SunMoon,
	X,
} from 'lucide-react';
import { Suspense, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useAppearance } from '~/components/appearance-provider';
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '~/components/ui/empty';
import { Field, FieldLabel } from '~/components/ui/field';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '~/components/ui/item';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '~/components/ui/popover';
import { ScrollArea, ScrollAreaContent, ScrollAreaViewport, ScrollBar } from '~/components/ui/scroll-area';
import { Skeleton } from '~/components/ui/skeleton';
import { Switch } from '~/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import { getSenderInfo, type MessageFlagsValues, messageFlags, sanitizeMessageHtml } from '~/lib/email';
import Email from '~/lib/email.server';
import { bytesToSize, dateAndTime } from '~/lib/formatter';
import logger from '~/lib/logger.server';
import { emailMiddleware } from '~/lib/middleware';
import { cn } from '~/lib/utils';
import MessageMenubar, { addMessageFlagsFn } from './-message.menubar';
import { type RouteMessageSchema, routeMessageSchema } from './-route.schema';
import { invalidateMessageInboxAndFolders } from './-utils';

const Route = getRouteApi('/inbox/$id/$inbox/');

// The email source from the getMessage method is serializable.
const fetchInboxMessage = createServerFn({ method: 'GET', strict: { output: false } })
	.middleware([emailMiddleware])
	.validator(routeMessageSchema)
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

const inboxMessageKey = 'email-inbox-message' as const;
export const invalidateInboxMessageKey = (options: RouteMessageSchema) =>
	[inboxMessageKey, options satisfies Partial<RouteMessageSchema>] satisfies QueryKey;

export const inboxMessageOptions = (data: RouteMessageSchema) =>
	queryOptions({
		queryKey: [inboxMessageKey, data],
		queryFn: () => fetchInboxMessage({ data }),
	});

export default function InboxMessage({ messageId }: { messageId: RouteMessageSchema['messageId'] }) {
	const parameters = Route.useParams();
	const query = inboxMessageOptions({ ...parameters, messageId });
	const { data: message } = useQuery(query);

	const addMessageFlags = useServerFn(addMessageFlagsFn);
	const queryClient = useQueryClient();

	const onMessageRead = useEffectEvent(async (id: RouteMessageSchema['messageId']) => {
		if (message?.flags && !message.flags.has(messageFlags.enum.Seen)) {
			if (
				await addMessageFlags({
					data: { ...parameters, flags: new Set<MessageFlagsValues>([messageFlags.enum.Seen]), messageId: id },
				})
			) {
				invalidateMessageInboxAndFolders(queryClient, { ...parameters, messageId: id });
			}
		}
	});

	// https://react.dev/learn/removing-effect-dependencies#separating-reactive-and-non-reactive-code
	useEffect(() => {
		if (message?.uid !== undefined) {
			onMessageRead(message.uid);
		}
		// The useState value dependency forces the hook to run only when the message has been loaded.
		// If the message does not have a value, the message cannot be marked as read.
	}, [message?.uid]);

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
	const { theme } = useAppearance();
	const [toggledEmailBackground, setToggledEmailBackground] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Run on new message ID.
	useEffect(() => {
		setAllowRemoteSrc(false);
		setTextMode(false);
		setToggledEmailBackground(false);
	}, [messageId, theme]);

	const { messageHtml, sawRemoteSrc } = sanitizeMessageHtml(message?.source.html, allowRemoteSrc);
	const showRemoteBlockedNotice =
		!!message?.source.html && sawRemoteSrc && !allowRemoteSrc && remoteBlockedNoticeId !== messageId;

	const { from, initials } = getSenderInfo(message?.source.from);
	const router = useRouter();

	const getUrl = (part: string, inline = false) =>
		router.buildLocation({
			to: '/inbox/$id/$inbox/$messageId/attachment/$part',
			params: { ...parameters, messageId: messageId.toString(), part },
			// @ts-expect-error: It will be parsed as a string.
			search: { inline },
		}).href;

	// https://postal-mime.postalsys.com/docs/examples/email-viewer#react-email-viewer-component
	let parsedMessageHtml = messageHtml;

	message?.source.attachments
		.filter(({ contentId, inline }) => inline && contentId)
		.forEach(({ contentId, part }) => {
			const cid = contentId?.replace(/^<|>$/g, '');

			parsedMessageHtml = parsedMessageHtml.replace(new RegExp(`cid:${cid}`, 'gi'), getUrl(part, true));
		});

	const attachments = message?.source.attachments.filter(({ inline }) => !inline) ?? [];

	const contentRef = useRef<HTMLDivElement>(null);
	const printEmail = useReactToPrint({ contentRef, documentTitle: message?.source.subject });

	if (!message) {
		return (
			<div className="flex size-full items-center justify-center">
				<Empty className="@sm:max-w-2/3 max-w-4/5 border border-destructive border-dashed">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<MailQuestionMark />
						</EmptyMedia>
						<EmptyTitle>Message Not Found</EmptyTitle>
						<EmptyDescription>
							The email message with the ID {messageId} could not be found in this inbox.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			</div>
		);
	}

	return (
		<ScrollArea className="size-full overflow-y-auto">
			<ScrollAreaViewport>
				<ScrollAreaContent className="@container flex size-auto flex-col gap-4 px-4 sm:px-6">
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
									<PopoverContent className="w-full max-w-sm">
										<PopoverHeader>
											<PopoverTitle>Email Message Details</PopoverTitle>
										</PopoverHeader>
										<Field orientation="horizontal">
											<FieldLabel htmlFor="to" className="shrink-0! self-start">
												To:
											</FieldLabel>
											<div id="to" className="space-x-2 break-all">
												{message.source.to?.map(({ name, address }, index, array) => (
													<span key={address}>
														{name && <>{name}</>}
														<span className="text-muted-foreground text-sm"> {`<${address}>`}</span>
														{index + 1 < array.length && ','}
														<br />
													</span>
												))}
											</div>
										</Field>
										<Field orientation="horizontal">
											<FieldLabel htmlFor="return-path" className="shrink-0! self-start">
												Return Path:
											</FieldLabel>
											<p id="return-path" className="break-all">
												{message.source.returnPath}
											</p>
										</Field>
										<Field orientation="horizontal">
											<FieldLabel htmlFor="message-id" className="shrink-0! self-start">
												Message ID:
											</FieldLabel>
											<p id="message-id" className="break-all">
												{message.source.messageId}
											</p>
										</Field>
										<Field orientation="horizontal">
											<FieldLabel htmlFor="mime-version" className="shrink-0! self-start">
												MIME-Version:
											</FieldLabel>
											<p id="mime-version" className="break-all">
												{message.source.headers.find((header) => header.key === 'mime-version')?.value}
											</p>
										</Field>
										<Field orientation="horizontal">
											<FieldLabel htmlFor="content-type" className="shrink-0! self-start">
												Content-Type:
											</FieldLabel>
											<p id="content-type" className="break-all">
												{message.source.headers.find((header) => header.key === 'content-type')?.value}
											</p>
										</Field>
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
												<Settings data-icon="inline-start" /> Settings
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
										<Field orientation="horizontal">
											<Tooltip>
												<TooltipTrigger
													render={
														<FieldLabel
															htmlFor="dark-content"
															className="flex-auto underline decoration-dotted underline-offset-4"
														>
															<SunMoon className="size-4" /> Opposite Email Background Colour
														</FieldLabel>
													}
												/>
												<TooltipContent>
													<p>
														Toggling this setting may improve text contrast for emails without a specified background
														colour.
													</p>
												</TooltipContent>
												<Switch
													id="dark-content"
													checked={toggledEmailBackground}
													onCheckedChange={setToggledEmailBackground}
												/>
											</Tooltip>
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
						<CardDescription suppressHydrationWarning>
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
									{attachments.map(({ filename, part, size, type }) => {
										const name = filename || message.source.subject;

										return (
											<Attachment key={part}>
												<AttachmentMedia>
													<FileText className="size-6" />
												</AttachmentMedia>
												<AttachmentContent>
													<AttachmentTitle className="truncate">{name}</AttachmentTitle>
													<AttachmentDescription>
														{bytesToSize(size ?? 0)} · {type}
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
																<DialogDescription>{type}</DialogDescription>
															</DialogHeader>
															<embed type={type} src={getUrl(part, true)} className="size-full" />
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
																	href={getUrl(part)}
																	target="_blank"
																	className={buttonVariants({ variant: 'secondary' })}
																	rel="noopener"
																>
																	<ExternalLink data-icon="inline-start" />
																	Open in New Tab
																</a>
																<a href={getUrl(part)} download={name} className={buttonVariants()}>
																	<FileDown data-icon="inline-start" />
																	Download
																</a>
															</DialogFooter>
														</DialogContent>
													</Dialog>
													<AttachmentAction
														nativeButton={false}
														aria-label={`Download ${name}`}
														render={
															<a href={getUrl(part)} download={name} className={buttonVariants({ variant: 'ghost' })}>
																<FileDown />
															</a>
														}
													/>
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
					<CardContent
						ref={contentRef}
						className={cn(
							'size-full rounded-2xl px-0 *:rounded-2xl',
							toggledEmailBackground ? 'bg-secondary-foreground' : 'bg-secondary',
						)}
					>
						{messageHtml && !textMode ? (
							<IframeResizer
								suppressHydrationWarning
								// https://iframe-resizer.com/gpl/
								license="GPLv3"
								log={false}
								srcDoc={parsedMessageHtml}
								title={message.source.subject}
								/**
								 * allow-popups: open target="_blank" links.
								 * allow-popups-to-escape-sandbox: makes CORS work which is needed by some websites.
								 * allow-same-origin: makes network requests with cookies (e.g. GET) work. Needed for attachments.
								 * allow-scripts: @iframe/resizer.
								 * TODO: use temporary IDs (like passkeys on registration) for attachments so allow-same-origin can be removed.
								 */
								sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
								referrerPolicy="no-referrer"
								scrolling="omit"
								className="h-screen w-full"
							/>
						) : (
							<p className="wrap-anywhere m-1 whitespace-pre-wrap text-wrap">{message.source.text}</p>
						)}
					</CardContent>
				</ScrollAreaContent>
			</ScrollAreaViewport>
			<ScrollBar />
		</ScrollArea>
	);
}
