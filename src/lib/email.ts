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

export const inbox = z.string();
export const messageId = z.number();

export const getMessageSchema = z.object({ inbox, messageId });

export const paginatedEmailMessagesSchema = z.object({
	inbox,
	page: z.number().gte(1).default(1),
	rowsPerPage: z.literal([5, 10, 25, 50, 100]).default(25),
	seen: z.boolean().default(true),
	sortBy: z.enum(['ascending', 'descending']).default('descending'),
});

export const messageFlags = z.enum({
	Seen: '\\Seen',
});
export const messageFlagsSet = z.set(messageFlags);
export type MessageFlagsSet = z.infer<typeof messageFlagsSet>;

export const setMessageFlagsSchema = getMessageSchema.safeExtend({
	flags: messageFlagsSet,
});
