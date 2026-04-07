import { QueryClient } from '@tanstack/react-query';
import z from 'zod';

const queryClient = new QueryClient();

export default queryClient;

export interface PaginatedQueryResult<T> {
	data: T;
	rowCount: number;
}

export const paginatedQuery = z.object({
	limit: z.number(),
	offset: z.number(),
});
