import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import {
	Flag,
	FlagOff,
	FolderTree,
	Forward,
	Mail,
	MailOpen,
	MessageCircleReply,
	Reply,
	ReplyAll,
	Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
	Menubar,
	MenubarContent,
	MenubarGroup,
	MenubarItem,
	MenubarMenu,
	MenubarSeparator,
	MenubarSub,
	MenubarSubContent,
	MenubarSubTrigger,
	MenubarTrigger,
} from '~/components/ui/menubar';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import {
	type MessageFlagColoursValues,
	type MessageFlagsValues,
	messageFlagColours,
	messageFlags,
	setMessageFlagsSchema,
} from '~/lib/email';
import Email from '~/lib/email.server';
import logger from '~/lib/logger.server';
import { emailMiddleware } from '~/lib/middleware';
import { inboxMessageOptions } from './-message';
import type { RouteMessageSchema } from './-route.schema';
import { invalidateMessageAndFolders } from './-utils';

const Route = getRouteApi('/inbox/$id/$inbox/');

export const addMessageFlagsFn = createServerFn({ method: 'POST' })
	.middleware([emailMiddleware])
	.validator(setMessageFlagsSchema.extend({ colour: z.optional(messageFlagColours) }))
	.handler(async ({ context: { email, user }, data: { colour, ...parameters } }) => {
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
			let colourSuccess = true;

			if (colour) {
				colourSuccess = await imapEmail.setMessageFlagColour({ ...parameters, colour });

				if (colourSuccess) {
					logger.debug('Set the flag colour for an inbox email message by user:%s', user.id);
				}
			}

			const flagSuccess = await imapEmail.addMessageFlags(parameters);

			if (flagSuccess) {
				logger.debug('Added inbox email message flag by user:%s', user.id);
			}

			return colourSuccess && flagSuccess;
		} catch (err) {
			if (Error.isError(err) && 'mailboxMissing' in err && err.mailboxMissing) {
				throw Route.redirect({ to: '/inbox/$id/$inbox', params: { id: email.id, inbox: 'INBOX' } });
			}

			logger.warn('Adding inbox email message flag failed: %s', err);
			return false;
		}
	});

const removeMessageFlagsFn = createServerFn({ method: 'POST' })
	.middleware([emailMiddleware])
	.validator(setMessageFlagsSchema)
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
			const success = await imapEmail.removeMessageFlags(data);

			if (success) {
				logger.debug('Removed inbox email message flag by user:%s', user.id);
			}

			return success;
		} catch (err) {
			if (Error.isError(err) && 'mailboxMissing' in err && err.mailboxMissing) {
				throw Route.redirect({ to: '/inbox/$id/$inbox', params: { id: email.id, inbox: 'INBOX' } });
			}

			logger.warn('Removing inbox email message flag failed: %s', err);
			return false;
		}
	});

export default function MessageMenubar({ messageId }: { messageId: RouteMessageSchema['messageId'] }) {
	const parameters = Route.useParams();
	const { data: message } = useQuery(inboxMessageOptions({ ...parameters, messageId }));
	const queryClient = useQueryClient();

	const addMessageFlags = useServerFn(addMessageFlagsFn);
	const removeMessageFlags = useServerFn(removeMessageFlagsFn);

	const { isPending: markMessageReadPending, mutate: markMessageRead } = useMutation({
		mutationFn: (seen: boolean) => {
			const data = { ...parameters, flags: new Set<MessageFlagsValues>([messageFlags.enum.Seen]), messageId } as const;

			return seen ? addMessageFlags({ data }) : removeMessageFlags({ data });
		},
		onSettled(success, _, seen) {
			if (success) {
				invalidateMessageAndFolders(queryClient, { ...parameters, messageId });
				toast.success(`Email message was marked as ${seen ? 'read' : 'unread'}!`);
			} else {
				toast.error(`Failed to mark the email message as ${seen ? 'read' : 'unread'}.`);
			}
		},
	});
	const { isPending: markMessageFlaggedPending, mutate: markMessageFlagged } = useMutation({
		mutationFn: ({ flagged, colour }: { flagged: boolean; colour?: MessageFlagColoursValues }) => {
			const data = {
				...parameters,
				colour,
				flags: new Set<MessageFlagsValues>([messageFlags.enum.Flagged]),
				messageId,
			} as const;

			return flagged ? addMessageFlags({ data }) : removeMessageFlags({ data });
		},
		onSettled(success, _, { flagged }) {
			if (success) {
				invalidateMessageAndFolders(queryClient, { ...parameters, messageId });
				toast.success(`Email message was marked as ${flagged ? 'flagged' : 'unflagged'}!`);
			} else {
				toast.error(`Failed to mark the email message as ${flagged ? 'flaggedf' : 'unflagged'}.`);
			}
		},
	});

	return (
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
						<MenubarItem
							onClick={() => markMessageRead(true)}
							disabled={markMessageReadPending || message?.flags?.has(messageFlags.enum.Seen)}
						>
							<MailOpen /> As Read
						</MenubarItem>
						<MenubarItem
							onClick={() => markMessageRead(false)}
							disabled={markMessageReadPending || !message?.flags?.has(messageFlags.enum.Seen)}
						>
							<Mail /> As Unread
						</MenubarItem>
						<MenubarSeparator />
						<MenubarSub disabled={markMessageFlaggedPending || message?.flags?.has(messageFlags.enum.Flagged)}>
							<MenubarSubTrigger>
								<Flag className="fill-foreground" /> As Flagged
							</MenubarSubTrigger>
							<MenubarSubContent>
								{Object.entries(messageFlagColours.enum).map(([key, value]) => (
									<MenubarItem key={key} onClick={() => markMessageFlagged({ flagged: true, colour: value })}>
										<Flag style={{ fill: key }} /> {key}
									</MenubarItem>
								))}
							</MenubarSubContent>
						</MenubarSub>
						<MenubarItem
							onClick={() => markMessageFlagged({ flagged: true })}
							disabled={markMessageFlaggedPending || message?.flags?.has(messageFlags.enum.Flagged)}
						>
							<Flag /> As Flagged
						</MenubarItem>
						<MenubarItem
							onClick={() => markMessageFlagged({ flagged: false })}
							disabled={markMessageFlaggedPending || !message?.flags?.has(messageFlags.enum.Flagged)}
						>
							<FlagOff /> As Unflagged
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
	);
}
