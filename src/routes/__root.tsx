import { createRootRouteWithContext, HeadContent, Outlet, ScriptOnce, Scripts } from '@tanstack/react-router';
import { createMiddleware } from '@tanstack/react-start';
import { AppearanceProvider } from '~/components/appearance-provider';
import Header from '~/components/header';
import { Toaster } from '~/components/ui/sonner';
import { TooltipProvider } from '~/components/ui/tooltip';
import { appearanceScript } from '~/lib/appearance';
import logger from '~/lib/logger.server';
import { getSession } from '~/lib/middleware';
import type getQueryClient from '~/lib/query';
import appCss from '../styles/app.css?url';

const loggingRequestMiddleware = createMiddleware({ type: 'request' }).server(async ({ next }) => {
	const data = await next();
	logger.http('[%s] %s %s', data.response.status, data.request.method, data.pathname);

	return data;
});

interface RouterContext {
	queryClient: ReturnType<typeof getQueryClient>;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		links: [
			{ rel: 'stylesheet', href: appCss },
			{ rel: 'icon', type: 'image/png', href: '/insight.png' },
		],
		meta: [
			{
				charSet: 'utf-8',
			},
			{
				name: 'viewport',
				content: 'width=device-width, initial-scale=1',
			},
			{
				title: 'Insight',
			},
		],
	}),
	beforeLoad: async () => ({ ...(await getSession()) }),
	component: RootComponent,
	server: {
		middleware: [loggingRequestMiddleware],
	},
});

function RootComponent() {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<ScriptOnce>{appearanceScript}</ScriptOnce>
				<HeadContent />
			</head>
			<body className="flex min-h-screen flex-col">
				<AppearanceProvider>
					<TooltipProvider>
						<Header />
						<div className="contents min-h-full flex-1">
							<Outlet />
						</div>
						{/* pointer-events-auto allows toasts to be dismissed with a dialog open (see sonner.tsx). */}
						<Toaster richColors className="pointer-events-auto" />
						<Scripts />
					</TooltipProvider>
				</AppearanceProvider>
			</body>
		</html>
	);
}
