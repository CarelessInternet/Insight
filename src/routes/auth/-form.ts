import { formOptions } from '@tanstack/react-form-start';
import z from 'zod';

export const signUpSchema = z.object({
	username: z.string().nonempty().max(100),
	email: z.email().nonempty(),
	// Minimum 8 characters enforced by Better Auth.
	password: z.string().nonempty().min(8).max(128),
});

export const signUpOptions = formOptions({
	defaultValues: {
		username: '',
		email: '',
		password: '',
	} satisfies z.infer<typeof signUpSchema>,
});

export const signInSchema = signUpSchema.omit({ username: true });

export const signInOptions = formOptions({
	defaultValues: {
		email: '',
		password: '',
	} satisfies z.infer<typeof signInSchema>,
});
