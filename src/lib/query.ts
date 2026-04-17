import { QueryClient } from '@tanstack/react-query';
import { createIsomorphicFn } from '@tanstack/react-start';
import z from 'zod';

// Always create a new QueryClient on the server.
// https://tanstack.com/query/latest/docs/framework/react/guides/ssr#initial-setup
let queryClient: QueryClient;

const getQueryClient = createIsomorphicFn()
	.server(() => new QueryClient())
	.client(() => {
		if (!queryClient) {
			if (import.meta.hot) {
				queryClient = import.meta.hot.data.queryClient ??= new QueryClient();

				// Preserve the QueryClient across HMR updates on Vite.
				import.meta.hot.dispose((data) => {
					data.queryClient = queryClient;
				});
			} else {
				queryClient = new QueryClient();
			}
		}

		return queryClient;
	});

export default getQueryClient;

export interface PaginatedQueryResult<T> {
	data: T;
	rowCount: number;
}

export const paginatedQuery = z.object({
	limit: z.number(),
	offset: z.number(),
});
