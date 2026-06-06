import { createFileRoute, retainSearchParams } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getCookie, setCookie } from '@tanstack/react-start/server';
import { type LayoutStorage, useDefaultLayout } from 'react-resizable-panels';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '~/components/ui/resizable';
import { useSidebar } from '~/components/ui/sidebar';
import { useIsMobile } from '~/lib/hooks/use-mobile';
import Inbox from './-inbox';
import { inboxOptions } from './-inbox.messages';
import InboxMessage, { inboxMessageOptions } from './-message';
import { routeSchema, searchSchema } from './-route.schema';

export const Route = createFileRoute('/inbox/$id/$inbox/')({
	component: RouteComponent,
	loaderDeps: ({ search }) => search,
	loader: ({ context: { queryClient }, params, deps: { messageId, ...search } }) => {
		void queryClient.prefetchQuery(inboxOptions({ ...params, ...search }));

		if (messageId !== undefined) {
			void queryClient.prefetchQuery(inboxMessageOptions({ ...params, messageId }));
		}
	},
	params: {
		parse: routeSchema.parse,
	},
	validateSearch: searchSchema,
	search: {
		middlewares: [retainSearchParams(searchSchema.omit({ messageId: true, page: true }).keyof().options)],
	},
});

const getPanelConfiguration = createIsomorphicFn()
	.client((key: string) => {
		const cookies = document.cookie.split(';');

		for (const cookie of cookies) {
			const [name, value] = cookie.trim().split('=');

			if (name === key) {
				return value ?? null;
			}
		}

		return null;
	})
	.server((key: string) => getCookie(key) ?? null);

const setPanelConfiguration = createIsomorphicFn()
	.client((key: string, value: string) => {
		// biome-ignore lint/suspicious/noDocumentCookie: Cannot use cookieStore because it must be synchronous.
		document.cookie = `${key}=${value}; path=/;`;
	})
	.server((key: string, value: string) => setCookie(key, value));

// https://react-resizable-panels.vercel.app/examples/persistent-layout/server-rendering
const cookieStorage: LayoutStorage = {
	getItem: (key) => getPanelConfiguration(key),
	setItem: (key, value) => setPanelConfiguration(key, value),
};

function RouteComponent() {
	const { messageId } = Route.useSearch();
	const isMobile = useIsMobile();
	const { open } = useSidebar();

	const inboxPanelId = 'inbox';
	const messagePanelId = 'message';
	const { defaultLayout, onLayoutChanged } = useDefaultLayout({
		id: 'inbox-layout',
		storage: cookieStorage,
		panelIds: [inboxPanelId, messagePanelId],
	});

	return (
		<ResizablePanelGroup
			orientation={isMobile ? 'vertical' : 'horizontal'}
			defaultLayout={defaultLayout}
			onLayoutChanged={onLayoutChanged}
		>
			<ResizablePanel
				id={inboxPanelId}
				defaultSize={messageId ? '25%' : '50%'}
				minSize={open ? '30%' : '25%'}
				collapsible
			>
				<Inbox />
			</ResizablePanel>
			{messageId && (
				<>
					<ResizableHandle withHandle />
					<ResizablePanel id={messagePanelId} defaultSize="75%" minSize="50%">
						<InboxMessage messageId={messageId} />
					</ResizablePanel>
				</>
			)}
		</ResizablePanelGroup>
	);
}
