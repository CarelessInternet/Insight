import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import type { ListTreeResponse } from 'imapflow';
import { Archive, ArchiveX, ChevronRight, Folder, Inbox, Mail, Send, SquarePen, Trash } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenuButton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from '~/components/ui/sidebar';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import Email from '~/lib/email.server';
import logger from '~/lib/logger.server';
import { type EmailMiddlewareSchema, emailMiddleware } from '~/lib/middleware';

const Route = getRouteApi('/inbox/$id/$inbox/');

const fetchFolders = createServerFn({ method: 'GET' })
	.middleware([emailMiddleware({ decrypt: true })])
	.handler(async ({ context: { email, user } }) => {
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

		const folders = await imapEmail.getMailboxes();
		logger.debug('Fetched folders for inbox:%s by user:%s', email.id, user.id);

		return folders;
	});

export const foldersOptions = ({ id, inbox }: EmailMiddlewareSchema) =>
	queryOptions({
		queryKey: ['email-inbox-folders', id],
		queryFn: () => fetchFolders({ data: { id, inbox } }),
		refetchOnWindowFocus: false,
	});

export default function SidebarFolders() {
	const parameters = Route.useParams();
	const { data } = useSuspenseQuery(foldersOptions(parameters));

	return (
		<Collapsible defaultOpen className="group">
			<SidebarGroup>
				<SidebarGroupLabel>Inbox</SidebarGroupLabel>
				<CollapsibleTrigger asChild>
					<SidebarMenuButton>
						<ChevronRight className="transition-transform group-data-[state=open]:rotate-90" />
						<Folder />
						Folders
					</SidebarMenuButton>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<SidebarGroupContent>
						<SidebarMenuSub>
							{data.folders?.map((folder) => (
								<FolderTree key={folder.path} folder={folder} />
							))}
						</SidebarMenuSub>
					</SidebarGroupContent>
				</CollapsibleContent>
			</SidebarGroup>
		</Collapsible>
	);
}

// https://ui.shadcn.com/docs/components/base/collapsible#file-tree
// https://ui.shadcn.com/blocks/sidebar#sidebar-11
function FolderTree({ folder }: { folder: ListTreeResponse }) {
	const { id, inbox } = Route.useParams();
	const isActive = inbox === folder.path;

	if ('folders' in folder) {
		return (
			<SidebarMenuSubItem>
				<Collapsible
					defaultOpen={!!folder.path && inbox.includes(folder.path)}
					className="group [&[data-state=open]>button>svg:first-child]:rotate-90"
				>
					<CollapsibleTrigger asChild>
						<SidebarMenuButton isActive={isActive}>
							<ChevronRight className="transition-transform" />
							<Route.Link to="/inbox/$id/$inbox" params={{ id, inbox: folder.path }} className="contents">
								{folder.specialUse === '\\Inbox' ? FolderIcon({ specialUse: folder.specialUse }) : <Folder />}
								{folder.specialUse === '\\Inbox' ? 'Inbox' : folder.name}
							</Route.Link>
						</SidebarMenuButton>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<SidebarGroupContent>
							<SidebarMenuSub>
								{folder.folders?.map((subFolder) => (
									<FolderTree key={subFolder.path} folder={subFolder} />
								))}
							</SidebarMenuSub>
						</SidebarGroupContent>
					</CollapsibleContent>
				</Collapsible>
			</SidebarMenuSubItem>
		);
	}

	return (
		<SidebarMenuSubItem key={folder.path}>
			<SidebarMenuSubButton className="py-4" isActive={isActive} asChild>
				<Route.Link to="/inbox/$id/$inbox" params={{ id, inbox: folder.path }}>
					<FolderIcon specialUse={folder.specialUse} />
					{folder.specialUse === '\\Inbox' ? 'Inbox' : folder.name}
				</Route.Link>
			</SidebarMenuSubButton>
		</SidebarMenuSubItem>
	);
}

function FolderIcon({ specialUse }: Pick<ListTreeResponse, 'specialUse'>) {
	switch (specialUse) {
		case '\\Inbox':
			return <Inbox />;
		case '\\Sent':
			return <Send />;
		case '\\Drafts':
			return <SquarePen />;
		case '\\Junk':
			return <ArchiveX />;
		case '\\Trash':
			return <Trash />;
		case '\\Archive':
			return <Archive />;
		default:
			return <Mail />;
	}
}
