import { redirect } from '@tanstack/react-router';
import { createMiddleware, createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import z from 'zod';
import { auth } from './authentication/server';
import { database } from './database/drizzle.server';
import { emailAccountSelectSchema } from './database/schema';
import Email from './email.server';
import logger from './logger.server';

export const getSession = createServerFn({ method: 'GET' }).handler(
	async () => await auth.api.getSession({ headers: getRequestHeaders() }),
);

export const ensureSession = createServerFn({ method: 'GET' }).handler(async ({ serverFnMeta: { name } }) => {
	const session = await getSession();

	if (!session) {
		logger.warn('[%s], User unauthorized, redirecting to /auth/sign-in', name);
		throw redirect({ to: '/auth/sign-in' });
	}

	return session;
});

export const sessionMiddleware = createMiddleware({ type: 'function' }).server(
	async ({ next }) => await next({ context: await ensureSession() }),
);

export const emailMiddlewareSchema = z.object({ id: emailAccountSelectSchema.shape.id, inbox: z.string() });
export type EmailMiddlewareSchema = z.infer<typeof emailMiddlewareSchema>;

export function emailMiddleware({ decrypt }: { decrypt: boolean }) {
	return createMiddleware({ type: 'function' })
		.middleware([sessionMiddleware])
		.inputValidator(emailMiddlewareSchema)
		.server(async ({ context, data, next }) => {
			let email = await database.query.emailAccount.findFirst({
				where: (field, { and, eq }) =>
					and(eq(field.userId, context.user.id), eq(field.id, data.id), eq(field.status, 'valid')),
			});

			if (!email) {
				logger.warn('The email:%s could not be found or is invalid', data.id);
				throw redirect({ to: '/account/settings' });
			}

			email = {
				...email,
				...(decrypt && (await Email.decryptCredentials(email))),
			};

			return await next({ context: { email } });
		});
}
