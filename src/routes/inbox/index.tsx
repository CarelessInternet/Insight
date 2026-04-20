import { createFileRoute, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { database } from '~/lib/database/drizzle.server';
import { sessionMiddleware } from '~/lib/middleware';

const redirectToInbox = createServerFn({ method: 'GET' })
	.middleware([sessionMiddleware])
	.handler(
		async ({
			context: {
				user: { id },
			},
		}) => {
			const email = await database.query.emailAccount.findFirst({
				where: (table, { eq }) => eq(table.userId, id),
			});

			if (email) {
				throw redirect({ to: '/inbox/$id', params: { id: email.id } });
			} else {
				throw redirect({ to: '/account/settings' });
			}
		},
	);

// TODO: display list of emails in select list to redirect to, if > 1 email.
export const Route = createFileRoute('/inbox/')({
	loader: async () => await redirectToInbox(),
});
