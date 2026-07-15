import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Flag, FolderTree, Forward, MailCheck, MailOpen, MessageCircleReply, Reply, ReplyAll, Tag } from 'lucide-react';
import {
	Menubar,
	MenubarContent,
	MenubarGroup,
	MenubarItem,
	MenubarMenu,
	MenubarSeparator,
	MenubarTrigger,
} from '~/components/ui/menubar';
import { messageFlags } from '~/lib/email';
import { inboxMessageOptions } from './-message';
import type { RouteMessageSchema } from './-route.schema';

const Route = getRouteApi('/inbox/$id/$inbox/');

export default function MessageMenubar({ messageId }: { messageId: RouteMessageSchema['messageId'] }) {
	const parameters = Route.useParams();
	const query = inboxMessageOptions({ ...parameters, messageId });
	const { data: message } = useQuery(query);

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
	);
}
