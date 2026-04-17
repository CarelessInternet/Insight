import type z from 'zod';
import { emailAccountInsertSchema, type emailAccountSelectSchema } from './database/schema';

export const emailCredentialsSchema = emailAccountInsertSchema.pick({ hostname: true, email: true, password: true });

export type EmailCredentialsSchema = z.infer<typeof emailCredentialsSchema>;
export type EmailId = z.infer<typeof emailAccountSelectSchema>['id'];
