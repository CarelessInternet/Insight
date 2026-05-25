import { createFileRoute, Outlet } from '@tanstack/react-router';
import { PanelLeftClose, PanelLeftOpen, PencilLine } from 'lucide-react';
import { Suspense } from 'react';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarProvider,
	useSidebar,
} from '~/components/ui/sidebar';
import { Skeleton } from '~/components/ui/skeleton';
import { emailMiddlewareSchema } from '~/lib/middleware';
import SidebarEmailAccounts, { accountsOptions } from './$inbox/-sidebar.accounts';
import SidebarFolders, { foldersOptions } from './$inbox/-sidebar.folders';

export const Route = createFileRoute('/inbox/$id')({
	component: RouteComponent,
	loader: async ({ context: { queryClient }, params: { id } }) => {
		void queryClient.prefetchQuery(foldersOptions(id));
		void queryClient.prefetchQuery(accountsOptions(id));
	},
	params: {
		parse: emailMiddlewareSchema.parse,
	},
});

function ToggleSidebar() {
	const { open, toggleSidebar } = useSidebar();

	return (
		<SidebarMenuButton onClick={toggleSidebar}>
			{open ? (
				<>
					<PanelLeftClose />
					Collapse
				</>
			) : (
				<>
					<PanelLeftOpen />
					Expand
				</>
			)}{' '}
			Sidebar
		</SidebarMenuButton>
	);
}

function RouteComponent() {
	return (
		<SidebarProvider className="min-h-full grow">
			<div className="flex min-h-0 flex-1">
				<Sidebar
					variant="sidebar"
					side="left"
					collapsible="icon"
					className="absolute top-(--header-height) h-[calc(100dvh-var(--header-height))]"
				>
					<SidebarHeader className="mt-2">
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									size="lg"
									variant="outline"
									className="justify-center font-semibold group-data-[collapsible=icon]:justify-normal"
								>
									<PencilLine />
									Compose
								</SidebarMenuButton>
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
						<SidebarMenu>
							<SidebarMenuItem>
								<ToggleSidebar />
							</SidebarMenuItem>
							<SidebarMenuItem>
								<Suspense fallback={<Skeleton className="h-10 w-full" />}>
									<SidebarEmailAccounts />
								</Suspense>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarFooter>
				</Sidebar>
				<main className="flex-1">
					<Suspense
						fallback={
							<div className="size-full p-4">
								<Skeleton className="size-full" />
							</div>
						}
					>
						<Outlet />
					</Suspense>
				</main>
			</div>
		</SidebarProvider>
	);
}
