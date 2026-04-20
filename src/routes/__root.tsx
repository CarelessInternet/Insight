import { createRootRoute, HeadContent, Outlet, ScriptOnce, Scripts } from '@tanstack/react-router';
import { createMiddleware } from '@tanstack/react-start';
import { AppearanceProvider } from '~/components/appearance-provider';
import Header from '~/components/header';
import { Toaster } from '~/components/ui/sonner';
import { getAppearanceServerFn } from '~/lib/appearance';
import logger from '~/lib/logger.server';
import { getSession } from '~/lib/middleware';
import appCss from '../styles/app.css?url';

const loggingRequestMiddleware = createMiddleware({ type: 'request' }).server(async ({ next }) => {
	const data = await next();
	logger.http('[%s] %s %s', data.response.status, data.request.method, data.pathname);

	return data;
});

export const Route = createRootRoute({
	head: () => ({
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
		links: [
			{ rel: 'stylesheet', href: appCss },
			{ rel: 'icon', type: 'image/png', href: '/insight.png' },
		],
	}),
	beforeLoad: async () => await getSession(),
	component: RootComponent,
	loader: () => getAppearanceServerFn(),
	server: {
		middleware: [loggingRequestMiddleware],
	},
});

function RootComponent() {
	const session = Route.useRouteContext();
	const appearance = Route.useLoaderData();
	const themeClass = appearance.theme === 'dark' ? 'dark' : '';

	return (
		<AppearanceProvider appearance={appearance}>
			<html className={themeClass} lang="en" suppressHydrationWarning>
				<head>
					{appearance.theme === 'system' && (
						<ScriptOnce>
							{`
								if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
									document.documentElement.classList.add('dark');
								}
							`}
						</ScriptOnce>
					)}
					<HeadContent />
				</head>
				<body className="flex min-h-screen flex-col">
					<Header session={session} />
					<Outlet />
					{/* pointer-events-auto allows toasts to be dismissed with a dialog open (see sonner.tsx). */}
					<Toaster richColors className="pointer-events-auto" />
					<Scripts />
				</body>
			</html>
		</AppearanceProvider>
	);
}
