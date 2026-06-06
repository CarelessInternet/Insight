import z from 'zod';
import { messageId, paginatedEmailMessagesSchema } from '~/lib/email';
import { emailMiddlewareSchema } from '~/lib/middleware';

export const routeSchema = emailMiddlewareSchema.safeExtend({
	// https://github.com/colinhacks/zod/discussions/4934#discussioncomment-13858053
	inbox: z.union([
		z.literal('INBOX'),
		z.literal('Sent'),
		z.literal('Drafts'),
		z.literal('Junk'),
		z.literal('Trash'),
		z.literal('Archive'),
		z.string() as z.ZodType<string & {}>,
	]),
});

export const routeMessageSchema = z.object({ ...routeSchema.shape, messageId });

export type RouteMessageSchema = z.infer<typeof routeMessageSchema>;

export const searchSchema = paginatedEmailMessagesSchema
	.omit({ inbox: true })
	.safeExtend({ messageId: messageId.optional() });

export type SearchSchema = z.infer<typeof searchSchema>;

export const routeSearchSchema = z.object({
	...routeSchema.shape,
	...paginatedEmailMessagesSchema.shape,
});

export type RouteSearchSchema = z.infer<typeof routeSearchSchema>;
