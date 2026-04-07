import type z from 'zod';
import { emailAccountSchema } from '~/lib/database/schema';

export const emailSchema = emailAccountSchema.pick({ hostname: true, email: true, password: true });

export type EmailSchema = z.infer<typeof emailSchema>;
