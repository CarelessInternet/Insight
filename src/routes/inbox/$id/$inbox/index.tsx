import { createFileRoute } from '@tanstack/react-router';
import z from 'zod';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '~/components/ui/resizable';
import { useSidebar } from '~/components/ui/sidebar';
import { useIsMobile } from '~/lib/hooks/use-mobile';
import Inbox, { inboxOptions } from './-inbox';
import { routeSchema } from './-route.schema';

export const Route = createFileRoute('/inbox/$id/$inbox/')({
	component: RouteComponent,
	loader: ({ context: { queryClient }, params }) => void queryClient.prefetchQuery(inboxOptions(params)),
	params: {
		parse: routeSchema.parse,
	},
	validateSearch: z.object({ messageId: z.string().optional() }),
});

function RouteComponent() {
	const { messageId } = Route.useSearch();
	const isMobile = useIsMobile();
	const { open } = useSidebar();

	return (
		<ResizablePanelGroup orientation={isMobile ? 'vertical' : 'horizontal'}>
			<ResizablePanel id="inbox" defaultSize="50%" minSize={open ? '30%' : '25%'} collapsible>
				<Inbox />
			</ResizablePanel>
			{!messageId && (
				<>
					<ResizableHandle withHandle />
					<ResizablePanel id="message" defaultSize="50%" minSize="50%"></ResizablePanel>
				</>
			)}
		</ResizablePanelGroup>
	);
}
