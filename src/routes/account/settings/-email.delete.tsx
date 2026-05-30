import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { Trash, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import type DropdownDialog from '~/components/DropdownDialog';
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
} from '~/components/ui/alert-dialog';
import { Spinner } from '~/components/ui/spinner';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount, emailAccountSelectSchema } from '~/lib/database/schema';
import { formResponse } from '~/lib/forms';
import logger from '~/lib/logger.server';
import { sessionMiddleware } from '~/lib/middleware';
import { type EmailAccount, invalidateEmailAccountsQueryKey } from './-email.table';

const Route = getRouteApi('/account/settings/');

const deleteEmailFn = createServerFn({ method: 'POST' })
	.middleware([sessionMiddleware])
	.inputValidator(emailAccountSelectSchema.shape.id)
	.handler(async ({ context, data: id }) => {
		try {
			const [email] = await database
				.delete(emailAccount)
				.where(and(eq(emailAccount.id, id), eq(emailAccount.userId, context.user.id)))
				.returning();

			if (email) {
				logger.info('Email:%s account deleted by user:%s', email?.id, email?.userId);
				return formResponse({ message: 'Successfully deleted the email account!', success: true });
			}

			return formResponse({ message: 'The email did not exist on your account.', success: false });
		} catch (err) {
			logger.error('Failed to delete email:%s for user:%s\n%s', id, context.user.id, err);
			return formResponse({ message: 'There was an internal error.', success: false });
		}
	});

export default function EmailDelete(properties: DropdownDialog<EmailAccount, true>) {
	if (!properties.row) {
		return null;
	}

	return <Component {...(properties as unknown as DropdownDialog<EmailAccount>)} />;
}

function Component({ open, row, setOpen }: DropdownDialog<EmailAccount>) {
	const { userId } = Route.useLoaderData();
	const queryClient = useQueryClient();
	const deleteEmail = useServerFn(deleteEmailFn);

	const { isPending, mutate } = useMutation({
		mutationFn: () => deleteEmail({ data: row.id }),
		onSettled(data) {
			if (data?.success) {
				queryClient.invalidateQueries({ queryKey: invalidateEmailAccountsQueryKey(userId) });
				toast.dismiss();
				toast.success(data.message);
				setOpen(false);
			} else {
				toast.error(data?.message, { closeButton: true, duration: Infinity });
			}
		},
	});

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
						<Trash2Icon />
					</AlertDialogMedia>
					<AlertDialogTitle className="inline-block">
						Delete <p className="inline underline">{row.email}</p>?
					</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently delete the email account from your Insight account.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel variant="outline">Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={() => mutate()}
						disabled={isPending}
						aria-disabled={isPending}
					>
						{isPending ? <Spinner /> : <Trash />}
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
