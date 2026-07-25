import { createRootRouteWithContext, HeadContent, Outlet, ScriptOnce, Scripts } from '@tanstack/react-router';
import { createMiddleware } from '@tanstack/react-start';
import { useEffect } from 'react';
import { AppearanceProvider } from '~/components/appearance-provider';
import Header from '~/components/header';
import { Toaster } from '~/components/ui/toast';
import { TooltipProvider } from '~/components/ui/tooltip';
import { appearanceScript } from '~/lib/appearance';
import { setIsomorphicCookie } from '~/lib/cookie';
import logger from '~/lib/logger.server';
import { getSession } from '~/lib/middleware';
import type getQueryClient from '~/lib/query';
import appCss from '../styles/app.css?url';

// Logging here prevents logging server function requests.
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
	useEffect(() => {
		setIsomorphicCookie({ name: 'timezone', value: Intl.DateTimeFormat().resolvedOptions().timeZone });
	}, []);

	return (
		<html lang="en" className="font-sans" suppressHydrationWarning>
			<head>
				<ScriptOnce>{appearanceScript}</ScriptOnce>
				<HeadContent />
			</head>
			<body className="flex min-h-screen flex-col bg-background text-foreground">
				<AppearanceProvider>
					<TooltipProvider>
						<Header />
						<div className="contents min-h-full flex-1">
							<Outlet />
						</div>
						<Toaster />
						<Scripts />
					</TooltipProvider>
				</AppearanceProvider>
			</body>
		</html>
	);
}
