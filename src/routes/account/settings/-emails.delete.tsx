import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';
import { and, eq, inArray } from 'drizzle-orm';
import { MailMinus, MailX, Trash } from 'lucide-react';
import { useState } from 'react';
import z from 'zod';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '~/components/ui/alert-dialog';
import { Button } from '~/components/ui/button';
import { Spinner } from '~/components/ui/spinner';
import { toast } from '~/components/ui/toast';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount, emailAccountSelectSchema } from '~/lib/database/schema';
import { formResponse } from '~/lib/forms';
import logger from '~/lib/logger.server';
import { sessionMiddleware } from '~/lib/middleware';
import { type EmailAccount, invalidateEmailAccountsQueryKey } from './-email.table';

const Route = getRouteApi('/account/settings/');

const deleteEmailsFn = createServerFn({ method: 'POST' })
	.middleware([sessionMiddleware])
	.validator(z.array(emailAccountSelectSchema.shape.id))
	.handler(async ({ context, data: ids }) => {
		try {
			const emails = await database
				.delete(emailAccount)
				.where(and(eq(emailAccount.userId, context.user.id), inArray(emailAccount.id, ids)))
				.returning();

			if (emails.length > 0) {
				logger.verbose(
					'%s email accounts (%s) deleted by user:%s',
					emails.length,
					emails.map((email) => email.id).join(', '),
					context.user.id,
				);
				return formResponse({ message: 'Successfully deleted the email accounts!', success: true });
			}

			return formResponse({ message: 'The emails do not exist on your account.', success: false });
		} catch (err) {
			logger.error('Failed to delete %s email accounts for user:%s\n%s', ids.length, context.user.id, err);
			return formResponse({ message: 'There was an internal error.', success: false });
		}
	});

export default function DeleteEmails({ rows }: { rows: EmailAccount[] }) {
	const { userId } = Route.useLoaderData();
	const queryClient = useQueryClient();
	const deleteEmails = useServerFn(deleteEmailsFn);

	const [open, setOpen] = useState(false);
	const { isPending, mutate } = useMutation({
		mutationFn: () => deleteEmails({ data: rows.map((data) => data.id) }),
		onSettled(data) {
			if (data?.success) {
				queryClient.invalidateQueries({ queryKey: invalidateEmailAccountsQueryKey(userId) });
				toast.add({ type: 'success', title: data.message });
				setOpen(false);
			} else {
				toast.add({ type: 'error', title: data?.message });
			}
		},
	});

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger
				render={
					<Button variant="destructive">
						<MailX data-icon="inline-start" /> Delete Selected Emails
					</Button>
				}
			/>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
						<MailMinus />
					</AlertDialogMedia>
					<AlertDialogTitle>Delete {rows.length} emails?</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently delete the email accounts from your Insight account.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel variant="outline">Cancel</AlertDialogCancel>
					<AlertDialogAction variant="destructive" onClick={() => mutate()} disabled={isPending}>
						{isPending ? <Spinner data-icon="inline-start" /> : <Trash data-icon="inline-start" />}
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
