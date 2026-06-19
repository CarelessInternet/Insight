import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import getQueryClient from '~/lib/query';
import ErrorComponent from './components/error';
import { routeTree } from './routeTree.gen';

export function getRouter() {
	const queryClient = getQueryClient();
	const router = createRouter({
		routeTree,
		// Passing down the QueryClient is extremely important for persisting cached data!
		// It is in practice not optional despite what is said here: https://tanstack.com/router/latest/docs/integrations/query#setup
		// Cached data is not shared with all users because getRouter is unique per SSR request.
		context: { queryClient },
		scrollRestoration: true,
		defaultErrorComponent: ErrorComponent,
		defaultPreload: 'intent',
		// https://tanstack.com/router/latest/docs/guide/preloading#preloading-with-external-libraries
		defaultPreloadStaleTime: 0,
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
