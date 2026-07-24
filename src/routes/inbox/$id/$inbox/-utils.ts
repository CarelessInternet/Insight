import type { QueryClient } from '@tanstack/react-query';
import { invalidateInboxQueryKey } from './-inbox.messages';
import { invalidateInboxMessageKey } from './-message';
import type { RouteMessageSchema } from './-route.schema';
import { invalidateFoldersQueryKey } from './-sidebar.folders';

export function invalidateInboxAndFolders(queryClient: QueryClient, options: Omit<RouteMessageSchema, 'messageId'>) {
	void queryClient.invalidateQueries({ queryKey: invalidateInboxQueryKey(options) });
	void queryClient.invalidateQueries({ queryKey: invalidateFoldersQueryKey(options.id) });
}

export function invalidateMessageAndFolders(queryClient: QueryClient, options: RouteMessageSchema) {
	invalidateInboxAndFolders(queryClient, { id: options.id, inbox: options.inbox });
	void queryClient.invalidateQueries({ queryKey: invalidateInboxMessageKey(options) });
}
