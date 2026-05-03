import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { PencilLine } from 'lucide-react';
import { Suspense } from 'react';
import { Button } from '~/components/ui/button';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarProvider,
	SidebarRail,
} from '~/components/ui/sidebar';
import { emailMiddlewareSchema } from '~/lib/middleware';
import getQueryClient from '~/lib/query';
import Inbox, { inboxOptions } from './-inbox';
import SidebarEmailAccounts, { accountsOptions } from './-sidebar.accounts';
import SidebarFolders, { foldersOptions } from './-sidebar.folders';

const getData = createServerFn({ method: 'GET' })
	.inputValidator(emailMiddlewareSchema)
	.handler(({ data }) => {
		const queryClient = getQueryClient();

		queryClient.ensureQueryData(foldersOptions(data));
		queryClient.ensureQueryData(inboxOptions(data));
		queryClient.ensureQueryData(accountsOptions(data.id));
	});

export const Route = createFileRoute('/inbox/$id/$inbox/')({
	component: RouteComponent,
	loader: ({ params }) => getData({ data: params }),
});

// TODO: Fix navigating to another mailbox/folder not make the sidebar temporarily disappear.
function RouteComponent() {
	return (
		<SidebarProvider className="min-h-full">
			<div className="flex min-h-0 flex-1">
				<Sidebar
					variant="sidebar"
					side="left"
					collapsible="offcanvas"
					className="absolute top-(--header-height) h-[calc(100dvh-var(--header-height))]"
				>
					<SidebarHeader className="mt-2">
						<SidebarMenu>
							<SidebarMenuItem className="flex justify-center">
								<Button className="h-12 w-5/6 text-base">
									<PencilLine />
									Compose Message
								</Button>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarHeader>
					<SidebarContent>
						<Suspense
							fallback={
								<SidebarGroup>
									<SidebarGroupContent>
										<SidebarMenu>
											{Array.from({ length: 5 }, () => (
												<SidebarMenuItem key={crypto.randomUUID()}>
													<SidebarMenuSkeleton />
												</SidebarMenuItem>
											))}
										</SidebarMenu>
									</SidebarGroupContent>
								</SidebarGroup>
							}
						>
							<SidebarFolders />
						</Suspense>
					</SidebarContent>
					<SidebarFooter>
						<SidebarEmailAccounts />
					</SidebarFooter>
					<SidebarRail />
				</Sidebar>
				<SidebarInset className="min-w-0 flex-1">
					<main>
						<Inbox />
					</main>
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
}
