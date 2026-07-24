import { createFileRoute, retainSearchParams, useHydrated } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { useDefaultLayout } from 'react-resizable-panels';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '~/components/ui/resizable';
import { useSidebar } from '~/components/ui/sidebar';
import { getIsomorphicCookie, setIsomorphicCookie } from '~/lib/cookie';
import { isClientMobile, isWidthMobile, useIsMobile } from '~/lib/hooks/use-mobile';
import Inbox from './-inbox';
import { inboxOptions } from './-inbox.messages';
import InboxMessage, { inboxMessageOptions } from './-message';
import { routeSchema, searchSchema } from './-route.schema';

export const isIsomorphicMobile = createIsomorphicFn()
	.server(() => {
		const viewportWidth = getRequestHeader('Sec-CH-Viewport-Width');
		return viewportWidth !== undefined ? isWidthMobile(Number(viewportWidth)) : null;
	})
	.client(isClientMobile);

export const Route = createFileRoute('/inbox/$id/$inbox/')({
	component: RouteComponent,
	loaderDeps: ({ search }) => search,
	loader: ({ context: { queryClient }, params, deps: { messageId, ...search } }) => {
		void queryClient.prefetchQuery(inboxOptions({ ...params, ...search }));

		if (messageId !== undefined) {
			void queryClient.prefetchQuery(inboxMessageOptions({ ...params, messageId }));
		}

		return isIsomorphicMobile();
	},
	params: {
		parse: routeSchema.parse,
	},
	validateSearch: searchSchema,
	search: {
		middlewares: [retainSearchParams(searchSchema.keyof().options)],
	},
});

function RouteComponent() {
	const { messageId } = Route.useSearch();
	const { open } = useSidebar();

	const hydrated = useHydrated();
	const isRenderedMobile = useIsMobile();
	const isIsomorphicMobile = Route.useLoaderData();
	const isMobile = hydrated ? isRenderedMobile : isIsomorphicMobile || isRenderedMobile;

	const inboxPanelId = 'inbox';
	const messagePanelId = 'message';
	// https://react-resizable-panels.vercel.app/examples/persistent-layout/server-rendering
	const { defaultLayout, onLayoutChanged } = useDefaultLayout({
		id: 'inbox-layout',
		storage: {
			getItem: getIsomorphicCookie,
			setItem: (name, value) => setIsomorphicCookie({ name, value }),
		},
		panelIds: messageId ? [inboxPanelId, messagePanelId] : [inboxPanelId],
	});

	// BUG: reazt-resizable-panels, when the inbox panel size is 0%, renders the incorrect size (50% vs 0%)
	// with a specified defaultSize, and an incorrect size with no defaultSize (~9px vs 0%).
	return (
		<ResizablePanelGroup
			orientation={isMobile ? 'vertical' : 'horizontal'}
			defaultLayout={defaultLayout}
			onLayoutChanged={onLayoutChanged}
		>
			<ResizablePanel
				id={inboxPanelId}
				defaultSize={messageId ? '50%' : '100%'}
				minSize={open ? '30%' : '25%'}
				groupResizeBehavior="preserve-relative-size"
				collapsible
			>
				<Inbox />
			</ResizablePanel>
			{messageId && (
				<>
					<ResizableHandle withHandle />
					<ResizablePanel id={messagePanelId} defaultSize={isMobile ? '100%' : '75%'} minSize="50%" collapsible>
						<InboxMessage messageId={messageId} />
					</ResizablePanel>
				</>
			)}
		</ResizablePanelGroup>
	);
}
