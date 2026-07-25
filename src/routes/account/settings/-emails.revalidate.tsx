import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';
import { and, eq, inArray } from 'drizzle-orm';
import { Wrench } from 'lucide-react';
import z from 'zod';
import { Button } from '~/components/ui/button';
import { Spinner } from '~/components/ui/spinner';
import { toast } from '~/components/ui/toast';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount, emailAccountSelectSchema } from '~/lib/database/schema';
import Email from '~/lib/email.server';
import { formResponse } from '~/lib/forms';
import logger from '~/lib/logger.server';
import { sessionMiddleware } from '~/lib/middleware';
import { type EmailAccount, invalidateEmailAccountsQueryKey } from './-email.table';

const Route = getRouteApi('/account/settings/');

const revalidateEmailsFn = createServerFn({ method: 'POST' })
	.middleware([sessionMiddleware])
	.validator(z.array(emailAccountSelectSchema.shape.id))
	.handler(async ({ context, data: ids }) => {
		try {
			const emails = await database.query.emailAccount.findMany({
				where: (table, { and, eq, inArray }) => and(eq(table.userId, context.user.id), inArray(table.id, ids)),
			});

			if (emails.length === 0) {
				return formResponse({ message: 'No email accounts were found.', success: false });
			}

			const revalidatedEmails = await Promise.all(
				emails.map(async (account) => {
					await using imapEmail = new Email(await Email.decryptCredentials(account));
					await imapEmail.connect();

					return {
						id: account.id,
						valid: imapEmail.authenticated,
					};
				}),
			);

			await Promise.all([
				database
					.update(emailAccount)
					.set({ status: 'valid' })
					.where(
						and(
							eq(emailAccount.userId, context.user.id),
							inArray(
								emailAccount.id,
								revalidatedEmails.filter((email) => email.valid).map((email) => email.id),
							),
						),
					),
				database
					.update(emailAccount)
					.set({ status: 'invalid' })
					.where(
						and(
							eq(emailAccount.userId, context.user.id),
							inArray(
								emailAccount.id,
								revalidatedEmails.filter((email) => !email.valid).map((email) => email.id),
							),
						),
					),
			]);

			return formResponse({ message: 'Successfully revalidated the email accounts!', success: true });
		} catch (err) {
			logger.error('Failed to revalidate %s email accounts for user:%s\n%s', ids.length, context.user.id, err);
			return formResponse({ message: 'There was an internal error.', success: false });
		}
	});

export default function RevalidateEmails({ onRevalidated, rows }: { onRevalidated: () => void; rows: EmailAccount[] }) {
	const { userId } = Route.useLoaderData();
	const queryClient = useQueryClient();
	const revalidateEmails = useServerFn(revalidateEmailsFn);

	const { isPending, mutate } = useMutation({
		mutationFn: () => revalidateEmails({ data: rows.map((data) => data.id) }),
		onSettled(data) {
			if (data?.success) {
				queryClient.invalidateQueries({ queryKey: invalidateEmailAccountsQueryKey(userId) });
				toast.add({ type: 'success', title: data.message });
			} else {
				toast.add({ type: 'error', title: data?.message });
			}

			onRevalidated();
		},
	});

	return (
		<Button variant="secondary" onClick={() => mutate()} disabled={isPending}>
			{isPending ? <Spinner data-icon="inline-start" /> : <Wrench data-icon="inline-start" />}
			Revalidate Selected Emails
		</Button>
	);
}
