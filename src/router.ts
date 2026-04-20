import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import getQueryClient from '~/lib/query';
import { routeTree } from './routeTree.gen';

export function getRouter() {
	const queryClient = getQueryClient();
	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		defaultViewTransition: true,
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient,
		handleRedirects: true,
		wrapQueryClient: true,
	});

	return router;
}
