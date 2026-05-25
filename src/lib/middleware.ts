import { redirect } from '@tanstack/react-router';
import { createMiddleware, createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import z from 'zod';
import auth from './authentication/server';
import { database } from './database/drizzle.server';
import { emailAccountSelectSchema } from './database/schema';
import Email from './email.server';
import logger from './logger.server';

export const getSession = createServerFn({ method: 'GET' }).handler(
	async () => await auth.api.getSession({ headers: getRequestHeaders() }),
);

export const sessionMiddleware = createMiddleware({ type: 'request' }).server(
	async ({ next, pathname, serverFnMeta }) => {
		const session = await getSession();

		if (!session) {
			logger.warn('[%s] User unauthorized, redirecting to /auth/sign-in', serverFnMeta?.name ?? pathname);
			throw redirect({ to: '/auth/sign-in' });
		}

		return await next({ context: session });
	},
);

export const emailMiddlewareSchema = z.object({ id: emailAccountSelectSchema.shape.id });
export type EmailMiddlewareSchema = z.infer<typeof emailMiddlewareSchema>;

export function emailMiddleware({ decrypt }: { decrypt: boolean }) {
	return createMiddleware({ type: 'function' })
		.middleware([sessionMiddleware])
		.inputValidator(emailMiddlewareSchema.loose())
		.server(async ({ context, data, next, serverFnMeta: { name } }) => {
			let email = await database.query.emailAccount.findFirst({
				where: (field, { and, eq }) =>
					and(eq(field.userId, context.user.id), eq(field.id, data.id), eq(field.status, 'valid')),
			});

			if (!email) {
				logger.warn('[%s] The email:%s could not be found or is invalid', name, data.id);
				throw redirect({ to: '/account/settings' });
			}

			email = {
				...email,
				...(decrypt && (await Email.decryptCredentials(email))),
			};

			return await next({ context: { email } });
		});
}
