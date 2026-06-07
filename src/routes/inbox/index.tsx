import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Inbox, MailCheck } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from '~/components/ui/combobox';
import { InputGroupAddon } from '~/components/ui/input-group';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '~/components/ui/item';
import { decrypt } from '~/lib/crypto.server';
import { database } from '~/lib/database/drizzle.server';
import logger from '~/lib/logger.server';
import { sessionMiddleware } from '~/lib/middleware';

const redirectToInbox = createServerFn({ method: 'GET' })
	.middleware([sessionMiddleware])
	.handler(async ({ context: { user } }) => {
		let emails = await database.query.emailAccount.findMany({
			columns: { email: true, hostname: true, id: true, label: true },
			where: (table, { and, eq }) => and(eq(table.userId, user.id), eq(table.status, 'valid')),
		});

		logger.debug('Fetched %s accounts for inbox display list by user:%s', emails.length, user.id);

		if (emails.length === 0) {
			throw Route.redirect({ to: '/account/settings' });
		}

		if (emails.length === 1) {
			// biome-ignore lint/style/noNonNullAssertion: The email does exist.
			throw Route.redirect({ to: '/inbox/$id/$inbox', params: { id: emails.at(0)!.id, inbox: 'INBOX' } });
		}

		emails = await Promise.all(
			emails.map(async ({ email, hostname, ...data }) => ({
				email: await decrypt(email),
				hostname: await decrypt(hostname),
				...data,
			})),
		);

		return emails;
	});

export const Route = createFileRoute('/inbox/')({
	component: RouteComponent,
	loader: async () => await redirectToInbox(),
});

function RouteComponent() {
	const emails = Route.useLoaderData();
	const navigate = Route.useNavigate();

	type Email = (typeof emails)[number];
	const emailLabel = (email: Email) => email.label || email.email;

	return (
		<div className="flex flex-1 items-center justify-center p-6 md:p-10">
			<Card className="w-full max-w-lg">
				<CardHeader className="text-center">
					<CardTitle>Choose an Inbox</CardTitle>
				</CardHeader>
				<CardContent>
					<Combobox
						items={emails}
						itemToStringLabel={emailLabel}
						onValueChange={(id, event) => {
							if (event.reason === 'item-press') {
								navigate({ to: '/inbox/$id/$inbox', params: { id: id as unknown as Email['id'], inbox: 'INBOX' } });
							}
						}}
						autoHighlight
						defaultOpen
					>
						<ComboboxInput type="text" placeholder="Choose an email account...">
							<InputGroupAddon align="inline-start">
								<Inbox />
							</InputGroupAddon>
						</ComboboxInput>
						<ComboboxContent align="center">
							<ComboboxEmpty>No email accounts found.</ComboboxEmpty>
							<ComboboxList>
								{(email: Email) => (
									<ComboboxItem key={email.id} value={email.id}>
										<Item size="xs" className="p-0">
											<ItemMedia variant="icon">
												<MailCheck className="text-primary" />
											</ItemMedia>
											<ItemContent>
												<ItemTitle>{emailLabel(email)}</ItemTitle>
												<ItemDescription>{email.label ? email.email : email.hostname}</ItemDescription>
											</ItemContent>
										</Item>
									</ComboboxItem>
								)}
							</ComboboxList>
						</ComboboxContent>
					</Combobox>
				</CardContent>
				<CardFooter className="justify-center underline">
					<Route.Link to="/account/settings">Add More Accounts</Route.Link>
				</CardFooter>
			</Card>
		</div>
	);
}
