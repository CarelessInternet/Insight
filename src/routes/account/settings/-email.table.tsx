import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import {
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type PaginationState,
	type RowData,
	type RowSelectionState,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from '@tanstack/react-table';
import { eq } from 'drizzle-orm';
import {
	ArrowUpDown,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Columns3Cog,
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
import { decrypt } from '~/lib/crypto.server';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import { dateAndTime, extractTimestampFromUUIDv7 } from '~/lib/datetime';
import logger from '~/lib/logger.server';
import { sessionMiddleware } from '~/lib/middleware';
import { type PaginatedQueryResult, paginatedQuery } from '~/lib/query';
import AddEmailAccount from './-email.add';
import EmailDelete from './-email.delete';
import EmailEdit from './-email.edit';
import DeleteEmails from './-emails.delete';
import RevalidateEmails from './-emails.revalidate';

const fetchEmailAccounts = createServerFn({ method: 'GET' })
	.middleware([sessionMiddleware])
	.inputValidator(paginatedQuery)
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

const defaultPagination: PaginationState = { pageIndex: 0, pageSize: 10 };
export const emailAccountQueryKey = 'email-accounts' as const;

export const emailAccountsOptions = ({ pageIndex, pageSize } = defaultPagination) =>
	queryOptions({
		queryKey: [emailAccountQueryKey, pageIndex, pageSize],
		queryFn: () => fetchEmailAccounts({ data: { limit: pageSize, offset: pageIndex } }),
		refetchOnWindowFocus: false,
	});

type RowAction = 'edit' | 'delete' | null;

declare module '@tanstack/table-core' {
	interface TableMeta<TData extends RowData> {
		openAction: (action: RowAction, row: TData) => void;
	}
}

const columns = [
	{
		id: 'select',
		header: ({ table }) => (
			<Checkbox
				checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
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
	},
	{
		accessorKey: 'id',
		header: ({ column }) => column.id,
		id: 'ID',
	},
	{
		accessorKey: 'email',
		header: ({ column }) => (
			<Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
				Email
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
	},
	{
		accessorKey: 'hostname',
		header: ({ column }) => (
			<Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
				Hostname
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
	},
	{
		accessorKey: 'status',
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
	},
	{
		accessorKey: 'createdAt',
		accessorFn: (row) => extractTimestampFromUUIDv7(row.id),
		cell: ({ cell }) => dateAndTime(cell.getValue<ReturnType<typeof extractTimestampFromUUIDv7>>()),
		header: ({ column }) => (
			<Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
				{column.id}
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
		id: 'Date Added',
	},

	{
		id: 'actions',
		cell: ({ row, table }) => (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" className="h-8 w-8 p-0">
						<span className="sr-only">Open menu</span>
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuLabel>Actions</DropdownMenuLabel>
					<DropdownMenuItem
						onSelect={(e) => {
							e.preventDefault();
							table.options.meta?.openAction('edit', row.original);
						}}
					>
						<UserPen /> Edit Credentials
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onSelect={(e) => {
							e.preventDefault();
							table.options.meta?.openAction('delete', row.original);
						}}
					>
						<MailX /> Delete Email
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		),
		enableHiding: false,
		enableSorting: false,
	},
] satisfies ColumnDef<EmailAccount>[];

export default function EmailAccountsTable() {
	const [pagination, setPagination] = useState(defaultPagination);
	const {
		data: { data, rowCount },
	} = useSuspenseQuery(emailAccountsOptions(pagination));
	const [isLoadingData, transitionData] = useTransition();

	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ ID: false });
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

	const [activeAction, setActiveAction] = useState<RowAction>(null);
	const [activeRow, setActiveRow] = useState<EmailAccount | null>(null);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		onPaginationChange: (newPagination) => transitionData(() => setPagination(newPagination)),
		manualPagination: true,
		rowCount,
		getSortedRowModel: getSortedRowModel(),
		onSortingChange: setSorting,
		getFilteredRowModel: getFilteredRowModel(),
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
		<div className="flex flex-col gap-2 w-3/4">
			<div className="flex flex-col sm:flex-row justify-between">
				<ButtonGroup>
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
									<DropdownMenuTrigger asChild>
										<InputGroupButton variant="outline">
											<Columns3Cog />
											Columns
											<ChevronDown />
										</InputGroupButton>
									</DropdownMenuTrigger>
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
				</ButtonGroup>
				<div className="flex items-center justify-between gap-4">
					<Field orientation="horizontal" className="w-fit">
						<FieldLabel htmlFor="select-rows-per-page">Rows per page</FieldLabel>
						<Select
							value={`${table.getState().pagination.pageSize}`}
							onValueChange={(value) => table.setPageSize(Number(value))}
						>
							<SelectTrigger className="w-20" id="select-rows-per-page">
								<SelectValue placeholder={table.getState().pagination.pageSize} />
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
					<ButtonGroup aria-label="Pagination button group">
						<Button variant="outline" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
							<ChevronLeft />
						</Button>
						<Button variant="outline" className="opacity-100!" disabled>
							Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
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
										<Skeleton className="w-full h-8" />
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
				<div className="text-sm text-muted-foreground">
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
