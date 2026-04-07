import { redirect } from '@tanstack/react-router';
import { createMiddleware, createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from './authentication/server';
import { database } from './database/drizzle';
import { emailAccountSchema } from './database/schema';
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

export const inboxMiddleware = createMiddleware({ type: 'function' })
	.middleware([sessionMiddleware])
	.inputValidator(emailAccountSchema.shape.id)
	.server(async ({ context, data: id, next }) => {
		const email = await database.query.emailAccount.findFirst({
			where: (field, { and, eq }) =>
				and(eq(field.userId, context.user.id), eq(field.id, id), eq(field.status, 'valid')),
		});

		if (!email) {
			logger.warn('The email:%s could not be found or is invalid', id);
			// Redirecting is broken...
			throw redirect({ to: '/account/settings' });
		}

		return await next({ context: { email } });
	});
