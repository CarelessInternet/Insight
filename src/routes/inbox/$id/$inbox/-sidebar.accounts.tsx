import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { ChevronsUpDown, Mailbox, MailCheck, MailWarning, Settings } from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { SidebarMenuButton } from '~/components/ui/sidebar';
import { decrypt } from '~/lib/crypto.server';
import { database } from '~/lib/database/drizzle.server';
import type { EmailId } from '~/lib/email';
import logger from '~/lib/logger.server';
import { emailMiddlewareSchema, sessionMiddleware } from '~/lib/middleware';

const Route = getRouteApi('/inbox/$id/$inbox/');

const fetchAccounts = createServerFn({ method: 'GET' })
	.middleware([sessionMiddleware])
	.inputValidator(emailMiddlewareSchema.shape.id)
	.handler(async ({ context: { user } }) => {
		let emails = await database.query.emailAccount.findMany({
			columns: { email: true, hostname: true, id: true, label: true, status: true },
			where: (table, { eq }) => eq(table.userId, user.id),
		});

		emails = await Promise.all(
			emails.map(async ({ email, hostname, ...credentials }) => ({
				email: await decrypt(email),
				hostname: await decrypt(hostname),
				...credentials,
			})),
		);
		logger.debug('Fetched %s accounts for inbox sidebar by user:%s', emails.length, user.id);

		return emails;
	});

export const accountsOptions = (id: EmailId) =>
	queryOptions({
		queryKey: ['email-inbox-accounts', id],
		queryFn: () => fetchAccounts({ data: id }),
		refetchOnWindowFocus: false,
	});

export default function SidebarEmailAccounts() {
	const { id } = Route.useParams();
	const { data } = useSuspenseQuery(accountsOptions(id));
	const currentEmail = data.find((email) => email.id === id);
	const otherEmails = data.filter((email) => email.id !== id);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<SidebarMenuButton size="lg" className="group-data-[collapsible=icon]:p-0!">
						<Mailbox className="size-8! text-primary" />
						<div className="grid flex-1 text-left text-base leading-tight">
							<span className="truncate font-bold">{currentEmail?.label ?? currentEmail?.email}</span>
							<span className="truncate text-xs">
								{currentEmail?.label ? currentEmail.email : currentEmail?.hostname}
							</span>
						</div>
						<ChevronsUpDown />
					</SidebarMenuButton>
				}
			/>
			<DropdownMenuContent>
				{otherEmails.length > 0 && (
					<>
						<DropdownMenuGroup>
							<DropdownMenuLabel>Other Email Accounts</DropdownMenuLabel>
							{otherEmails.map((email) => (
								<DropdownMenuItem
									key={email.id}
									render={
										<Route.Link to="/inbox/$id/$inbox" params={{ id: email.id, inbox: 'INBOX' }}>
											{email.status === 'valid' ? (
												<MailCheck className="text-primary" />
											) : (
												<MailWarning className="text-destructive" />
											)}
											<div className="grid flex-1 text-left leading-tight">
												<span className="truncate font-bold text-md">{email.label ?? email.email}</span>
												<span className="truncate text-xs">{email.label ? email.email : email.hostname}</span>
											</div>
										</Route.Link>
									}
								/>
							))}
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
					</>
				)}
				<DropdownMenuGroup>
					<DropdownMenuItem
						render={
							<Route.Link to="/account/settings">
								<Settings /> Settings
							</Route.Link>
						}
					/>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
