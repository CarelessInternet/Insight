import type z from 'zod';
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
