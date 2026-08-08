import type { QueryClient } from '@tanstack/react-query';
import type { ListTreeResponse } from 'imapflow';
import { Archive, ArchiveX, Inbox, Mail, Send, SquarePen, Trash } from 'lucide-react';
import { invalidateInboxQueryKey } from './-inbox.messages';
import { invalidateInboxMessageKey } from './-message';
import type { RouteMessageSchema } from './-route.schema';
import { invalidateFoldersQueryKey } from './-sidebar.folders';

export function FolderIcon({ specialUse }: Pick<ListTreeResponse, 'specialUse'>) {
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

export function invalidateInboxAndFolders(queryClient: QueryClient, options: Omit<RouteMessageSchema, 'messageId'>) {
	void queryClient.invalidateQueries({ queryKey: invalidateInboxQueryKey({ id: options.id, inbox: options.inbox }) });
	void queryClient.invalidateQueries({ queryKey: invalidateFoldersQueryKey(options.id) });
}

export function invalidateMessageAndInbox(queryClient: QueryClient, options: RouteMessageSchema) {
	void queryClient.invalidateQueries({ queryKey: invalidateInboxQueryKey({ id: options.id, inbox: options.inbox }) });
	void queryClient.invalidateQueries({ queryKey: invalidateInboxMessageKey(options) });
}

export function invalidateMessageInboxAndFolders(queryClient: QueryClient, options: RouteMessageSchema) {
	void queryClient.invalidateQueries({ queryKey: invalidateInboxMessageKey(options) });
	void queryClient.invalidateQueries({ queryKey: invalidateInboxQueryKey({ id: options.id, inbox: options.inbox }) });
	void queryClient.invalidateQueries({ queryKey: invalidateFoldersQueryKey(options.id) });
}
