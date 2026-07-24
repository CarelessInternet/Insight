import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import z from 'zod';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount, user } from '~/lib/database/schema';
import { getMessageSchema } from '~/lib/email';
import Email from '~/lib/email.server';
import { emailMiddleware } from '~/lib/middleware';

const getEmailCredentials = createServerFn({ method: 'GET' })
	.middleware([emailMiddleware])
	.handler(({ context: { email } }) => email);

export const Route = createFileRoute('/inbox/$id/$inbox/$messageId/source')({
	server: {
		handlers: {
			async GET({ params }) {
				const parameters = getMessageSchema
					.extend({ id: z.string() })
					.parse({ ...params, messageId: Number(params.messageId) });
				const email = await getEmailCredentials({ data: params });

				await using imapEmail = new Email({
					email: email.email,
					hostname: email.hostname,
					password: email.password,
				});
				await imapEmail.connect();

				if (!imapEmail.authenticated) {
					await database
						.update(emailAccount)
						.set({ status: 'invalid' })
						.where(and(eq(emailAccount.userId, user.id), eq(emailAccount.id, email.id)));
					throw Route.redirect({ to: '/account/settings' });
				}

				const source = await imapEmail.getMessageSource(parameters);

				if (!source) {
					return new Response('Message source not found.', { status: 404 });
				}

				return new Response(source.toString());
			},
		},
	},
});
