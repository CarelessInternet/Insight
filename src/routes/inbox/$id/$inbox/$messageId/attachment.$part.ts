import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { create } from 'content-disposition';
import { and, eq } from 'drizzle-orm';
import z from 'zod';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount, user } from '~/lib/database/schema';
import { getMessageSchema } from '~/lib/email';
import Email from '~/lib/email.server';
import { emailMiddleware } from '~/lib/middleware';

const searchSchema = z.object({ inline: z.optional(z.stringbool()) });

const getEmailCredentials = createServerFn({ method: 'GET' })
	.middleware([emailMiddleware])
	.handler(({ context: { email } }) => email);

export const Route = createFileRoute('/inbox/$id/$inbox/$messageId/attachment/$part')({
	server: {
		handlers: {
			async GET({ params, request }) {
				const { inline } = searchSchema.parse(Object.fromEntries(new URL(request.url).searchParams));

				const parameters = getMessageSchema
					.extend({ id: z.string(), part: z.string() })
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

				const attachment = await imapEmail.getMessageAttachment(parameters);

				if (!attachment) {
					return new Response('Message attachment not found.', { status: 404 });
				}

				return new Response(attachment.blob, {
					headers: {
						'Cache-Control': 'private, max-age=3600, immutable',
						'Content-Disposition': create(attachment.meta.filename, {
							type: inline ? 'inline' : attachment.meta.disposition,
						}),
						'Content-Type': attachment.meta.contentType,
					},
				});
			},
		},
	},
	validateSearch: searchSchema,
});
