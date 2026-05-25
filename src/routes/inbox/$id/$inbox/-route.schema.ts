import z from 'zod';
import { emailMiddlewareSchema } from '~/lib/middleware';

export const routeSchema = emailMiddlewareSchema.safeExtend({ inbox: z.string() });

export type RouteSchema = z.infer<typeof routeSchema>;
