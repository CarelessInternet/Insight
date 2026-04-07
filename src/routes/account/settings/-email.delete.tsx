import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { MailX, Trash2Icon } from 'lucide-react';
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
import { DropdownMenuItem } from '~/components/ui/dropdown-menu';
import { database } from '~/lib/database/drizzle';
import { emailAccount, emailAccountSchema } from '~/lib/database/schema';
import logger from '~/lib/logger.server';
import { sessionMiddleware } from '~/lib/middleware';

const deleteEmail = createServerFn({ method: 'POST' })
	.middleware([sessionMiddleware])
	.inputValidator(emailAccountSchema.shape.id)
	.handler(async ({ context, data: id }) => {
		try {
			const [email] = await database
				.delete(emailAccount)
				.where(and(eq(emailAccount.id, id), eq(emailAccount.userId, context.user.id)))
				.returning();
			logger.info('Email account deleted by user:%s', email?.userId);

			return true;
		} catch (err) {
			logger.error('Failed to delete email account for user:%s\n%s', context.user.id, err);
			return false;
		}
	});

export function EmailDelete({ id }: { id: typeof emailAccount.$inferSelect.id }) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<DropdownMenuItem variant="destructive">
					<MailX /> Delete Email
				</DropdownMenuItem>
			</AlertDialogTrigger>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
						<Trash2Icon />
					</AlertDialogMedia>
					<AlertDialogTitle>Delete chat?</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently delete this chat conversation. View <a href="#">Settings</a> delete any memories saved
						during this chat.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel variant="outline">Cancel</AlertDialogCancel>
					<AlertDialogAction variant="destructive">Delete</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
