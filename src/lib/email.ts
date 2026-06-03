import z from 'zod';
import { emailAccountInsertSchema, type emailAccountSelectSchema } from './database/schema';

export const emailInsertSchema = emailAccountInsertSchema
	.pick({
		hostname: true,
		email: true,
		label: true,
		password: true,
	})
	.extend({ label: emailAccountInsertSchema.shape.label.unwrap().unwrap() });
export const emailCredentialsSchema = emailInsertSchema.omit({ label: true });

export type EmailInsertSchema = z.infer<typeof emailInsertSchema>;
export type EmailCredentialsSchema = z.infer<typeof emailCredentialsSchema>;
export type EmailId = z.infer<typeof emailAccountSelectSchema>['id'];

export const paginatedEmailMessagesSchema = z.object({
	inbox: z.string(),
	limit: z.literal([5, 10, 25, 50, 100]).default(25),
	offset: z.number().default(0),
	seen: z.boolean().default(false),
	sortBy: z.enum(['ascending', 'descending']).default('descending'),
});
