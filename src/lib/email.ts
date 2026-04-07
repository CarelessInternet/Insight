import type z from 'zod';
import { emailAccountSchema } from './database/schema';

export const emailSchema = emailAccountSchema.pick({ hostname: true, email: true, password: true });

export type EmailSchema = z.infer<typeof emailSchema>;
export type EmailId = z.infer<typeof emailAccountSchema>['id'];
