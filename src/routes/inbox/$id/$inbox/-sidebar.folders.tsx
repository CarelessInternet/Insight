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
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
} from '~/components/ui/sidebar';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import type { EmailId } from '~/lib/email';
import Email from '~/lib/email.server';
import logger from '~/lib/logger.server';
import { emailMiddleware } from '~/lib/middleware';

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

export const foldersOptions = (id: EmailId) =>
	queryOptions({
		queryKey: ['email-inbox-folders', id],
		queryFn: () => fetchFolders({ data: { id } }),
	});

export default function SidebarFolders() {
	const { id } = Route.useParams();
	const { data } = useSuspenseQuery(foldersOptions(id));

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Mailbox</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{data.folders?.map((folder) => (
						<FolderTree key={folder.path} folder={folder} />
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

// https://ui.shadcn.com/docs/components/base/collapsible#file-tree
// https://ui.shadcn.com/blocks/sidebar#sidebar-11
function FolderTree({ folder }: { folder: ListTreeResponse }) {
	const { id, inbox } = Route.useParams();
	const isActive = inbox === folder.path;

	if ('folders' in folder) {
		return (
			<SidebarMenuItem>
				<Collapsible
					defaultOpen={!!folder.path && inbox.includes(folder.path)}
					className="group [&[data-open]>button>div>svg:first-child]:rotate-90"
				>
					<CollapsibleTrigger
						render={
							<SidebarMenuButton isActive={isActive}>
								<Route.Link
									to="/inbox/$id/$inbox"
									params={{ id, inbox: folder.path }}
									search={{ search: undefined }}
									className="contents"
								>
									{folder.specialUse === '\\Inbox' ? FolderIcon({ specialUse: folder.specialUse }) : <Folder />}
									{folder.specialUse === '\\Inbox' ? 'Inbox' : folder.name}
								</Route.Link>
								<SidebarMenuBadge>
									<ChevronRight className="transition-transform" />
								</SidebarMenuBadge>
							</SidebarMenuButton>
						}
					/>
					<CollapsibleContent>
						<SidebarGroupContent>
							<SidebarMenuSub className="mr-0 pr-0">
								{folder.folders?.map((subFolder) => (
									<FolderTree key={subFolder.path} folder={subFolder} />
								))}
							</SidebarMenuSub>
						</SidebarGroupContent>
					</CollapsibleContent>
				</Collapsible>
			</SidebarMenuItem>
		);
	}

	return (
		<SidebarMenuItem key={folder.path}>
			<SidebarMenuButton
				className="py-4.5"
				isActive={isActive}
				render={
					<Route.Link to="/inbox/$id/$inbox" params={{ id, inbox: folder.path }} search={{ search: undefined }}>
						<FolderIcon specialUse={folder.specialUse} />
						{folder.specialUse === '\\Inbox' ? 'Inbox' : folder.name}
					</Route.Link>
				}
			/>
		</SidebarMenuItem>
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
