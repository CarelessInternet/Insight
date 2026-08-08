import { type QueryKey, queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import {
	type ColumnFiltersState,
	type ColumnVisibilityState,
	columnFilteringFeature,
	columnVisibilityFeature,
	createColumnHelper,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	filterFn_includesString,
	flexRender,
	metaHelper,
	type PaginationState,
	type RowSelectionState,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	type SortingState,
	sortFn_alphanumeric,
	sortFn_text,
	tableFeatures,
	useTable,
} from '@tanstack/react-table';
import { eq } from 'drizzle-orm';
import {
	ArrowUpDown,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Columns3Cog,
	MailOpen,
	MailSearch,
	MailX,
	MoreHorizontal,
	UserPen,
	X,
} from 'lucide-react';
import { useState, useTransition } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { ButtonGroup } from '~/components/ui/button-group';
import { Checkbox } from '~/components/ui/checkbox';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Field, FieldLabel } from '~/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '~/components/ui/input-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Skeleton } from '~/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import type auth from '~/lib/authentication/server';
import { decrypt } from '~/lib/crypto.server';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import { dateAndTime, extractTimestampFromUUIDv7 } from '~/lib/formatter';
import logger from '~/lib/logger.server';
import { sessionMiddleware } from '~/lib/middleware';
import { type PaginatedQueryResult, paginatedQuery } from '~/lib/query';
import AddEmailAccount from './-email.add';
import EmailDelete from './-email.delete';
import EmailEdit from './-email.edit';
import DeleteEmails from './-emails.delete';
import RevalidateEmails from './-emails.revalidate';

const Route = getRouteApi('/account/settings/');

const fetchEmailAccounts = createServerFn({ method: 'GET' })
	.middleware([sessionMiddleware])
	.validator(paginatedQuery)
	.handler(
		async ({
			context: {
				user: { id },
			},
			data: { limit, offset },
		}) => {
			let [data, rowCount] = await Promise.all([
				database.query.emailAccount.findMany({
					columns: { emailLookup: false, password: false },
					where: ({ userId }, { eq }) => eq(userId, id),
					orderBy: (table, { asc }) => asc(table.id),
					limit,
					offset,
				}),
				database.$count(emailAccount, eq(emailAccount.userId, id)),
			]);

			data = await Promise.all(
				data.map(async ({ email, hostname, ...credentials }) => ({
					email: await decrypt(email),
					hostname: await decrypt(hostname),
					...credentials,
				})),
			);
			logger.debug('Fetched %s email accounts for user:%s', data.length, id);

			return { data, rowCount } satisfies PaginatedQueryResult<typeof data>;
		},
	);

export type EmailAccount = Awaited<ReturnType<typeof fetchEmailAccounts>>['data'][0];
interface EmailAccountsOptions {
	pagination: PaginationState;
	userId: typeof auth.$Infer.Session.user.id;
}

export const defaultPagination = { pageIndex: 0, pageSize: 10 } satisfies PaginationState;
const emailAccountQueryKey = 'email-settings-accounts' as const;

export const invalidateEmailAccountsQueryKey = (userId: EmailAccountsOptions['userId']) =>
	[emailAccountQueryKey, { userId } satisfies Partial<EmailAccountsOptions>] satisfies QueryKey;

export const emailAccountsOptions = (parameters: EmailAccountsOptions) =>
	queryOptions({
		queryKey: [emailAccountQueryKey, parameters],
		queryFn: () =>
			fetchEmailAccounts({ data: { limit: parameters.pagination.pageSize, offset: parameters.pagination.pageIndex } }),
	});

type RowAction = 'edit' | 'delete' | null;

const features = tableFeatures({
	columnFilteringFeature,
	columnVisibilityFeature,
	filterFns: { includesString: filterFn_includesString },
	filteredRowModel: createFilteredRowModel(),
	paginatedRowModel: createPaginatedRowModel(),
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	sortedRowModel: createSortedRowModel(),
	sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
	tableMeta: metaHelper<{ openAction: (action: RowAction, row: EmailAccount) => void }>(),
});

export type TableFeatures = typeof features;

const columnHelper = createColumnHelper<TableFeatures, EmailAccount>();
const columns = columnHelper.columns([
	columnHelper.display({
		id: 'select',
		header: ({ table }) => (
			<Checkbox
				checked={table.getIsAllPageRowsSelected() || table.getIsSomePageRowsSelected()}
				onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
				aria-label="Select all"
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				aria-label="Select row"
			/>
		),
		enableHiding: false,
		enableSorting: false,
	}),
	columnHelper.accessor('id', { header: ({ column }) => column.id, id: 'ID' }),
	columnHelper.accessor('label', {
		header: ({ column }) => (
			<Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
				Label
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
		id: 'Label',
	}),
	columnHelper.accessor('email', {
		header: ({ column }) => (
			<Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
				Email
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
	}),
	columnHelper.accessor('hostname', {
		header: ({ column }) => (
			<Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
				Hostname
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
	}),
	columnHelper.accessor('status', {
		cell: ({ getValue }) => {
			const status = getValue() as typeof emailAccount.$inferSelect.status;

			return status === 'valid' ? (
				<Badge variant="success">
					<Check />
					Valid
				</Badge>
			) : (
				<Badge variant="destructive">
					<X />
					Invalid
				</Badge>
			);
		},
		header: ({ column }) => (
			<Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
				Status
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
	}),
	columnHelper.display({
		id: 'Date Added',
		cell: ({ cell }) => dateAndTime(extractTimestampFromUUIDv7(cell.row.original.id)),
		header: ({ column }) => (
			<Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
				{column.id}
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
	}),
	columnHelper.accessor('updatedAt', {
		cell: ({ cell }) => dateAndTime(cell.getValue<ReturnType<typeof extractTimestampFromUUIDv7>>()),
		header: ({ column }) => (
			<Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
				{column.id}
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
		id: 'Last Updated',
	}),
	columnHelper.display({
		id: 'actions',
		cell: ({ row, table }) => (
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant="ghost" className="size-8 p-0">
							<span className="sr-only">Open menu</span>
							<MoreHorizontal className="size-4" />
						</Button>
					}
				/>
				<DropdownMenuContent align="end">
					<DropdownMenuGroup>
						<DropdownMenuLabel>Actions</DropdownMenuLabel>
						<DropdownMenuItem
							render={
								<Route.Link to="/inbox/$id/$inbox" params={{ id: row.original.id, inbox: 'INBOX' }}>
									<MailOpen />
									View Inbox
								</Route.Link>
							}
						/>
						<DropdownMenuItem
							onClick={(e) => {
								e.preventDefault();
								table.options.meta?.openAction('edit', row.original);
							}}
						>
							<UserPen /> Edit Credentials
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							onClick={(e) => {
								e.preventDefault();
								table.options.meta?.openAction('delete', row.original);
							}}
						>
							<MailX /> Delete Email
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		),
		enableHiding: false,
		enableSorting: false,
	}),
]);

export default function EmailAccountsTable() {
	const { userId } = Route.useLoaderData();
	const [pagination, setPagination] = useState(defaultPagination);
	const {
		data: { data, rowCount },
	} = useSuspenseQuery(emailAccountsOptions({ pagination, userId }));
	const [isLoadingData, transitionData] = useTransition();

	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({
		ID: false,
		Label: data.some((email) => !email.label),
		'Date Added': false,
	});
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

	const [activeAction, setActiveAction] = useState<RowAction>(null);
	const [activeRow, setActiveRow] = useState<EmailAccount | null>(null);

	const table = useTable({
		data,
		columns,
		features,
		rowCount,
		manualPagination: true,
		onPaginationChange: (newPagination) => transitionData(() => setPagination(newPagination)),
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		getRowId: (row) => row.id,
		state: {
			pagination,
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
		},
		meta: {
			openAction: (action, row) => {
				setActiveAction(action);
				setActiveRow(row);
			},
		},
	});

	return (
		<div className="flex w-3/4 flex-col gap-2">
			<div className="flex flex-col justify-between sm:flex-row">
				<ButtonGroup className="max-w-full">
					<InputGroup>
						<InputGroupAddon align="inline-start">
							<MailSearch />
						</InputGroupAddon>
						<InputGroupInput
							type="email"
							placeholder="Filter emails..."
							value={(table.getColumn('email')?.getFilterValue() as string) ?? ''}
							onChange={(event) => table.getColumn('email')?.setFilterValue(event.target.value)}
						/>
						<InputGroupAddon align="inline-end">
							<DropdownMenu>
								<DropdownMenuTrigger
									render={
										<InputGroupButton variant="secondary">
											<Columns3Cog data-icon="inline-start" />
											Columns
											<ChevronDown data-icon="inline-end" />
										</InputGroupButton>
									}
								/>
								<DropdownMenuContent align="end">
									{table
										.getAllColumns()
										.filter((column) => column.getCanHide())
										.map((column) => {
											return (
												<DropdownMenuCheckboxItem
													key={column.id}
													className="capitalize"
													checked={column.getIsVisible()}
													onCheckedChange={(value) => column.toggleVisibility(!!value)}
												>
													{column.id}
												</DropdownMenuCheckboxItem>
											);
										})}
								</DropdownMenuContent>
							</DropdownMenu>
						</InputGroupAddon>
					</InputGroup>
				</ButtonGroup>
				<div className="flex items-center justify-between gap-4">
					<Field orientation="horizontal" className="w-fit">
						<FieldLabel htmlFor="select-rows-per-page">Rows per page</FieldLabel>
						<Select
							value={String(table.state.pagination.pageSize)}
							onValueChange={(value) => table.setPageSize(Number(value))}
						>
							<SelectTrigger className="w-20" id="select-rows-per-page">
								<SelectValue placeholder={table.state.pagination.pageSize} />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{[5, 10, 25, 50, 100].map((pageSize) => (
										<SelectItem key={pageSize} value={`${pageSize}`}>
											{pageSize}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<ButtonGroup aria-label="Emails pagination group">
						<Button variant="outline" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
							<ChevronLeft />
						</Button>
						<Button variant="outline" className="opacity-100!" disabled>
							Page {table.state.pagination.pageIndex + (table.getPageCount() === 0 ? 0 : 1)} of {table.getPageCount()}
						</Button>
						<Button variant="outline" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
							<ChevronRight />
						</Button>
					</ButtonGroup>
				</div>
			</div>
			<div className="overflow-hidden rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									return (
										<TableHead key={header.id}>
											{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
										</TableHead>
									);
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{isLoadingData ? (
							<TableRow>
								{table.getVisibleLeafColumns().map((column) => (
									<TableCell key={column.id}>
										<Skeleton className="h-8 w-full" />
									</TableCell>
								))}
							</TableRow>
						) : table.getRowModel().rows.length > 0 ? (
							<>
								{table.getRowModel().rows.map((row) => (
									<TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
										))}
									</TableRow>
								))}
								<EmailEdit
									open={activeAction === 'edit'}
									row={activeRow}
									setOpen={(open) => !open && setActiveAction(null)}
								/>
								<EmailDelete
									open={activeAction === 'delete'}
									row={activeRow}
									setOpen={(open) => !open && setActiveAction(null)}
								/>
							</>
						) : (
							<TableRow>
								<TableCell colSpan={columns.length} className="text-center">
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex items-center justify-between space-x-2">
				<div className="text-muted-foreground text-sm">
					{table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s)
					selected.
				</div>
				<div className="flex items-center gap-2">
					{table.getSelectedRowModel().rows.length > 0 && (
						<>
							<RevalidateEmails
								rows={table.getSelectedRowModel().rows.map((row) => row.original)}
								onRevalidated={() => setRowSelection({})}
							/>
							<DeleteEmails rows={table.getSelectedRowModel().rows.map((row) => row.original)} />
						</>
					)}
					<AddEmailAccount />
				</div>
			</div>
		</div>
	);
}
