import z from 'zod';
import { paginatedEmailMessagesSchema } from '~/lib/email';
import { emailMiddlewareSchema } from '~/lib/middleware';

export const routeSchema = emailMiddlewareSchema.safeExtend({ inbox: z.string() });

export const searchSchema = paginatedEmailMessagesSchema.omit({ inbox: true }).safeExtend({
	messageId: z.number().optional(),
});

export type SearchSchema = z.infer<typeof searchSchema>;

export const routeSearchSchema = z.object({
	...routeSchema.shape,
	...paginatedEmailMessagesSchema.shape,
});

export type RouteSearchSchema = z.infer<typeof routeSearchSchema>;
