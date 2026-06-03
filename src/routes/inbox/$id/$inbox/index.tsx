import { createFileRoute } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getCookie, setCookie } from '@tanstack/react-start/server';
import { type LayoutStorage, useDefaultLayout } from 'react-resizable-panels';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '~/components/ui/resizable';
import { useSidebar } from '~/components/ui/sidebar';
import { useIsMobile } from '~/lib/hooks/use-mobile';
import Inbox from './-inbox';
import { inboxOptions } from './-inbox.messages';
import { routeSchema, searchSchema } from './-route.schema';

export const Route = createFileRoute('/inbox/$id/$inbox/')({
	component: RouteComponent,
	loaderDeps: ({ search: { messageId, ...deps } }) => deps,
	loader: ({ context: { queryClient }, params, deps }) =>
		void queryClient.prefetchQuery(inboxOptions({ ...params, ...deps })),
	params: {
		parse: routeSchema.parse,
	},
	validateSearch: searchSchema,
	// retainSearchParams does not currently work.
	// That's why each navigation requires passing the previous search parameters.
	// https://github.com/TanStack/router/issues/2845
	// search: {
	// 	middlewares: [retainSearchParams(true)],
	// },
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

	const { defaultLayout, onLayoutChanged } = useDefaultLayout({
		id: 'inbox-layout',
		storage: cookieStorage,
	});

	return (
		<ResizablePanelGroup
			orientation={isMobile ? 'vertical' : 'horizontal'}
			defaultLayout={defaultLayout}
			onLayoutChanged={onLayoutChanged}
		>
			<ResizablePanel id="inbox" defaultSize={messageId ? '25%' : '50%'} minSize={open ? '30%' : '25%'} collapsible>
				<Inbox />
			</ResizablePanel>
			{messageId && (
				<>
					<ResizableHandle withHandle />
					<ResizablePanel id="message" defaultSize="75%" minSize="50%">
						{messageId}
					</ResizablePanel>
				</>
			)}
		</ResizablePanelGroup>
	);
}
