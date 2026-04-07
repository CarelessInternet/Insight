/// <reference types="vite/client" />

import { createRootRoute, HeadContent, Outlet, ScriptOnce, Scripts } from '@tanstack/react-router';
import { createMiddleware } from '@tanstack/react-start';
import type { PropsWithChildren } from 'react';
import { ThemeProvider, useTheme } from '~/components/theme-provider';
import { Toaster } from '~/components/ui/sonner';
import logger from '~/lib/logger.server';
import { getThemeServerFn } from '~/lib/theme';
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
	component: RootComponent,
	loader: () => getThemeServerFn(),
	server: {
		middleware: [loggingRequestMiddleware],
	},
});

function RootComponent() {
	const theme = Route.useLoaderData();

	return (
		<ThemeProvider theme={theme}>
			<RootDocument>
				<Outlet />
			</RootDocument>
		</ThemeProvider>
	);
}

function RootDocument({ children }: PropsWithChildren) {
	const { theme } = useTheme();
	const themeClass = theme === 'dark' ? 'dark' : '';

	return (
		<html className={themeClass} lang="en" suppressHydrationWarning>
			<head>
				{theme === 'system' && (
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
			<body>
				{children}
				{/* pointer-events-auto allows toasts to be dismissed with a dialog open (see sonner.tsx). */}
				<Toaster richColors className="pointer-events-auto" />
				<Scripts />
			</body>
		</html>
	);
}
