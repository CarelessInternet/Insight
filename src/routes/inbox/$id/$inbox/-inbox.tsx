import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import {
	ArrowUpDown,
	BellRing,
	CalendarArrowDown,
	CalendarArrowUp,
	ChevronLeft,
	ChevronRight,
	Filter,
	ListOrdered,
	RefreshCcw,
	Search,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { ButtonGroup } from '~/components/ui/button-group';
import { Field, FieldLabel } from '~/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '~/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Spinner } from '~/components/ui/spinner';
import { Switch } from '~/components/ui/switch';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import Email from '~/lib/email.server';
import logger from '~/lib/logger.server';
import { emailMiddleware } from '~/lib/middleware';
import { type RouteSchema, routeSchema } from './-route.schema';

const Route = getRouteApi('/inbox/$id/$inbox/');

const fetchInbox = createServerFn({ method: 'GET' })
	.inputValidator(routeSchema)
	.middleware([emailMiddleware({ decrypt: true })])
	.handler(async ({ context: { email, user }, data }) => {
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

		try {
			const messages = await imapEmail.getPaginatedMailboxMessages(data.inbox);
			logger.info('Fetched inbox emails for inbox:%s by user:%s', email.id, user.id);

			return messages;
		} catch (err) {
			if (err instanceof Error && 'mailboxMissing' in err && err.mailboxMissing) {
				throw Route.redirect({ to: '/inbox/$id/$inbox', params: { id: email.id, inbox: 'INBOX' } });
			}

			// TODO: display a proper failed state in the UI.
			logger.warn('Fetching inbox emails failed: %s', err);
			return [];
		}
	});

export const inboxOptions = ({ id, inbox }: RouteSchema) =>
	queryOptions({
		queryKey: ['email-inbox-emails', id, inbox],
		queryFn: () => fetchInbox({ data: { id, inbox } }),
		refetchOnWindowFocus: false,
	});

/*
	TODO: Resizable component for email list and email message would be sick.
	UI:
		1. Desktop only list: stretched table
		2. Desktop list and message view: table and message view.
		3. Mobile: list or message view.

	Table should include a toggle sidebar and search buttons.

	The resizeable component can make a panel disappear using the
	collapsible/minSize property if the size becomes too small.
	Use conditional panels to render a panel only if needed, useful for #1-3.
*/
export default function Inbox() {
	const parameters = Route.useParams();
	const { data: messages, isRefetching, refetch } = useSuspenseQuery(inboxOptions(parameters));

	const [sortBy, setSortBy] = useState('ascending');
	const [rowsPerPage, setRowsPerPage] = useState(50);
	const [onlyUnreads, setOnlyUnreads] = useState(false);

	return (
		<div className="@container flex flex-col gap-2 p-4">
			<div className="flex w-full @sm:flex-row flex-col items-center justify-center gap-2">
				<ButtonGroup aria-label="Inbox actions group">
					<Button onClick={() => refetch()} disabled={isRefetching} aria-disabled={isRefetching}>
						{isRefetching ? <Spinner /> : <RefreshCcw />}
						Refresh
					</Button>
					<Popover>
						<PopoverTrigger asChild>
							<Button variant="secondary">
								<Filter />
								Filters
							</Button>
						</PopoverTrigger>
						<PopoverContent>
							<PopoverHeader>
								<PopoverTitle>Configure Filters</PopoverTitle>
							</PopoverHeader>
							<Field orientation="horizontal">
								<FieldLabel htmlFor="sort-by">
									<ArrowUpDown className="size-4" />
									Sort By
								</FieldLabel>
								<Select value={sortBy} onValueChange={setSortBy}>
									<SelectTrigger id="sort-by">
										<SelectValue />
									</SelectTrigger>
									<SelectContent position="popper">
										<SelectItem value="descending">
											<CalendarArrowDown className="si" />
											Descending
										</SelectItem>
										<SelectItem value="ascending">
											<CalendarArrowUp />
											Ascending
										</SelectItem>
									</SelectContent>
								</Select>
							</Field>
							<Field orientation="horizontal">
								<FieldLabel htmlFor="rows-per-page">
									<ListOrdered className="size-4" />
									Rows Per Page
								</FieldLabel>
								<Select value={String(rowsPerPage)} onValueChange={(value) => setRowsPerPage(Number(value))}>
									<SelectTrigger id="rows-per-page">
										<SelectValue />
									</SelectTrigger>
									<SelectContent position="popper">
										{[5, 10, 25, 50, 100].map((pageSize) => (
											<SelectItem key={pageSize} value={`${pageSize}`}>
												{pageSize}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field orientation="horizontal">
								<FieldLabel htmlFor="only-unreads">
									<BellRing className="size-4" />
									Only Unreads
								</FieldLabel>
								<Switch id="only-unreads" checked={onlyUnreads} onCheckedChange={setOnlyUnreads} />
							</Field>
						</PopoverContent>
					</Popover>
				</ButtonGroup>
				<ButtonGroup aria-label="Inbox pagination group">
					<Button variant="outline">
						<ChevronLeft />
					</Button>
					<Button variant="outline" className="opacity-100!" disabled>
						Page 1 of 1
					</Button>
					<Button variant="outline">
						<ChevronRight />
					</Button>
				</ButtonGroup>
			</div>
			<div className="flex justify-center">
				<InputGroup className="max-w-full">
					<InputGroupInput placeholder="Search..." />
					<InputGroupAddon>
						<Search />
					</InputGroupAddon>
				</InputGroup>
			</div>
		</div>
	);
}
