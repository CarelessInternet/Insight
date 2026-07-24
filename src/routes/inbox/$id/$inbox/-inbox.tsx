import { useForm } from '@tanstack/react-form';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, useHydrated } from '@tanstack/react-router';
import {
	ArrowUpDown,
	BellRing,
	BookText,
	CalendarArrowDown,
	CalendarArrowUp,
	Captions,
	ChevronDown,
	Columns3Cog,
	Contact,
	Filter,
	ListFilter,
	ListOrdered,
	MailSearch,
	PanelLeftClose,
	PanelLeftOpen,
	RefreshCcw,
	StepBack,
	StepForward,
	TextSearch,
	View,
} from 'lucide-react';
import { type ReactNode, Suspense, useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Field, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '~/components/ui/input-group';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '~/components/ui/popover';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import { useSidebar } from '~/components/ui/sidebar';
import { Skeleton } from '~/components/ui/skeleton';
import { Spinner } from '~/components/ui/spinner';
import { Switch } from '~/components/ui/switch';
import { type SearchMessageSchema, searchMessageFilters, searchMessageSchema } from '~/lib/email';
import { isInvalidField } from '~/lib/forms';
import { useDebouncedSyncedState } from '~/lib/hooks/use-debounced';
import InboxMessages, { inboxOptions } from './-inbox.messages';
import { type RouteSearchSchema, routeSearchSchema } from './-route.schema';
import { invalidateInboxAndFolders } from './-utils';

const Route = getRouteApi('/inbox/$id/$inbox/');

const sortByItems = {
	descending: (
		<>
			<CalendarArrowDown /> Descending
		</>
	),
	ascending: (
		<>
			<CalendarArrowUp /> Ascending
		</>
	),
} as const satisfies Record<RouteSearchSchema['sortBy'], ReactNode>;

const searchByItems = {
	from: (
		<>
			<Contact /> From
		</>
	),
	subject: (
		<>
			<BookText /> Subject
		</>
	),
	content: (
		<>
			<Captions /> Content
		</>
	),
} as const satisfies Record<keyof typeof searchMessageFilters, ReactNode>;

export default function Inbox() {
	const parameters = Route.useParams();
	const { messageId: _, ...search } = Route.useSearch();
	const navigate = Route.useNavigate();

	const { openMobile, isMobile, toggleSidebar } = useSidebar();
	const hydrated = useHydrated();

	const queryClient = useQueryClient();
	const { data: rowCount, isRefetching } = useQuery({
		...inboxOptions({ ...parameters, ...search }),
		// Keep the previous data while the current data is being refetched.
		// Useful for keeping the row count as is instead of defaulting back to undefined.
		placeholderData: keepPreviousData,
		select: ({ rowCount }) => rowCount,
	});
	const pageCount = rowCount !== undefined ? Math.ceil((rowCount !== 0 ? rowCount : 1) / search.rowsPerPage) : null;

	const [pageInput, setPageInput] = useDebouncedSyncedState(search.page, (page) =>
		navigate({ replace: true, search: { page } }),
	);
	const [persistMessageView, setPersistMessageView] = useState(false);

	const initialSearchValues: SearchMessageSchema = {
		filterBy: searchMessageFilters.from,
		value: search.search?.value ?? '',
	};

	const form = useForm({
		defaultValues: initialSearchValues,
		validators: {
			// onChange: searchMessageSchema,
			// onSubmit: searchMessageSchema,
			// The properties above cause a type error due to undefined being possible.
			onChange: ({ value }) => searchMessageSchema.safeParse(value).error,
			onSubmit: ({ value }) => searchMessageSchema.safeParse(value).error,
		},
		onSubmit: ({ value: options }) => {
			navigate({
				replace: true,
				search: (previous) => ({
					messageId: persistMessageView ? previous.messageId : undefined,
					page: undefined,
					search: options.value ? options : undefined,
				}),
			});
		},
	});

	// Reset the search value on navigation to a new inbox.
	useEffect(() => {
		if (!search.search) {
			form.resetField('value');
		}
	}, [search.search, form.resetField]);

	// TODO: add only flagged setting to filters.
	return (
		<div className="@container flex h-full max-h-[calc(100dvh-var(--header-height))] flex-col overflow-hidden">
			<div className="flex-none">
				<div className="flex @md:flex-row flex-col">
					<div className="flex flex-row">
						{isMobile && (
							<Button variant="secondary" className="grow rounded-none border-none" onClick={toggleSidebar}>
								{openMobile ? <PanelLeftOpen data-icon="inline-start" /> : <PanelLeftClose data-icon="inline-start" />}
								Sidebar
							</Button>
						)}
						<Button
							className="grow rounded-none border-none"
							onClick={() => void invalidateInboxAndFolders(queryClient, parameters)}
							disabled={isRefetching}
						>
							{isRefetching ? <Spinner data-icon="inline-start" /> : <RefreshCcw data-icon="inline-start" />}
							Refresh
						</Button>
						<Separator orientation="vertical" />
						<Popover>
							<PopoverTrigger
								render={
									<Button variant="ghost" className="grow rounded-none border-none">
										<Filter data-icon="inline-start" /> Filters
									</Button>
								}
							/>
							<PopoverContent>
								<PopoverHeader>
									<PopoverTitle>Configure Inbox Filters</PopoverTitle>
								</PopoverHeader>
								<Field orientation="horizontal">
									<FieldLabel htmlFor="sort-by">
										<ArrowUpDown className="size-4" />
										Sort By
									</FieldLabel>
									<Select
										items={sortByItems}
										value={search.sortBy}
										onValueChange={(value) =>
											navigate({
												replace: true,
												search: {
													page: 1,
													sortBy: value ?? routeSearchSchema.shape.sortBy.def.defaultValue,
												},
											})
										}
									>
										<SelectTrigger id="sort-by" size="sm">
											<SelectValue className="gap-2!" />
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												{Object.entries(sortByItems).map(([value, label]) => (
													<SelectItem key={value} value={value} className="[&>div]:items-center">
														{label}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
								</Field>
								<Field orientation="horizontal">
									<FieldLabel htmlFor="rows-per-page">
										<ListOrdered className="size-4" />
										Rows Per Page
									</FieldLabel>
									<Select
										items={Object.fromEntries(
											routeSearchSchema.shape.rowsPerPage
												.unwrap()
												.values.values()
												.map((pageSize) => [pageSize, pageSize]),
										)}
										value={search.rowsPerPage}
										onValueChange={(value) =>
											navigate({
												replace: true,
												search: {
													page: 1,
													rowsPerPage: value ?? routeSearchSchema.shape.rowsPerPage.def.defaultValue,
												},
											})
										}
									>
										<SelectTrigger id="rows-per-page" size="sm">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												{[...routeSearchSchema.shape.rowsPerPage.unwrap().values].map((pageSize) => (
													<SelectItem key={pageSize} value={pageSize}>
														{pageSize}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
								</Field>
								<Field orientation="horizontal">
									<FieldLabel htmlFor="only-unreads">
										<BellRing className="size-4" />
										Only Unreads
									</FieldLabel>
									<Switch
										id="only-unreads"
										checked={!search.seen}
										onCheckedChange={(seen) =>
											navigate({
												replace: true,
												search: { page: 1, seen: !seen },
											})
										}
									/>
								</Field>
							</PopoverContent>
						</Popover>
					</div>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							void form.handleSubmit();
						}}
						method="get"
						encType="multipart/form-data"
						className="contents"
					>
						<InputGroup className="max-w-full rounded-none border-none">
							<InputGroupAddon align="inline-start">
								<MailSearch />
							</InputGroupAddon>
							<form.Field name="value">
								{(field) => (
									<InputGroupInput
										id={field.name}
										name={field.name}
										type="text"
										inputMode="search"
										placeholder="Search..."
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalidField(field)}
										disabled={isRefetching}
									/>
								)}
							</form.Field>
							<form.Field name="filterBy">
								{(field) => (
									<InputGroupAddon align="inline-end">
										<Popover>
											<PopoverTrigger
												render={
													<InputGroupButton variant="secondary">
														<ListFilter data-icon="inline-start" />
														Options
														<ChevronDown data-icon="inline-end" />
													</InputGroupButton>
												}
											/>
											<PopoverContent>
												<PopoverHeader>
													<PopoverTitle>Configure Search</PopoverTitle>
												</PopoverHeader>
												<Field orientation="horizontal">
													<FieldLabel htmlFor={field.name}>
														<Columns3Cog className="size-4" />
														Search By
													</FieldLabel>
													<Select
														items={searchByItems}
														value={field.state.value}
														onValueChange={(value) => field.handleChange(value ?? initialSearchValues.filterBy)}
													>
														<SelectTrigger id={field.name} size="sm">
															<SelectValue className="gap-2!" />
														</SelectTrigger>
														<SelectContent>
															<SelectGroup>
																{Object.entries(searchByItems).map(([value, label]) => (
																	<SelectItem key={value} value={value} className="[&>div]:items-center">
																		{label}
																	</SelectItem>
																))}
															</SelectGroup>
														</SelectContent>
													</Select>
												</Field>
												<Field orientation="horizontal">
													<FieldLabel htmlFor="persist-message-view">
														<View className="size-4" />
														Persist Message View
													</FieldLabel>
													<Switch
														id="persist-message-view"
														checked={persistMessageView}
														onCheckedChange={setPersistMessageView}
													/>
												</Field>
												<Button onClick={field.form.handleSubmit}>
													<TextSearch data-icon="inline-start" />
													Search
												</Button>
											</PopoverContent>
										</Popover>
									</InputGroupAddon>
								)}
							</form.Field>
						</InputGroup>
					</form>
				</div>
				<Separator />
			</div>
			{/* The class "contents" allows the custom ScrollBar to appear. */}
			<div className="contents grow *:h-full">
				<Suspense
					fallback={
						<div className="flex flex-col gap-4 p-4">
							{Array.from({ length: 10 }, () => (
								<Skeleton key={crypto.randomUUID()} className="size-full" />
							))}
						</div>
					}
				>
					<InboxMessages />
				</Suspense>
			</div>
			<div className="flex-none">
				<Separator />
				<div className="flex flex-row items-center">
					<Button
						variant="ghost"
						className="grow rounded-none border-none"
						disabled={isRefetching || search.page <= 1}
						onClick={() =>
							navigate({
								replace: true,
								search: { page: search.page - 1 },
							})
						}
					>
						<StepBack data-icon="inline-start" />
						<span className="@sm:inline-block hidden">Previous</span>
					</Button>
					<Separator orientation="vertical" />
					<span className="inline-flex grow flex-row place-content-center gap-2 px-2 text-sm">
						Page
						<Input
							type="text"
							inputMode="numeric"
							className="h-5 w-10 px-2 text-sm"
							disabled={hydrated && (isRefetching || rowCount === 0)}
							value={pageInput}
							onValueChange={(rawPage, event) => {
								const page = Number(rawPage);

								if (Number.isNaN(page) || pageCount === null) {
									return event.cancel();
								}

								if (page > pageCount || page < 1) {
									return page < 1 ? setPageInput(1) : event.cancel();
								}

								setPageInput(page);
							}}
						/>
						of {hydrated ? pageCount : '...'}
					</span>
					<Separator orientation="vertical" />
					<Button
						variant="ghost"
						className="grow rounded-none border-none"
						disabled={hydrated && (isRefetching || search.page === pageCount)}
						onClick={() =>
							navigate({
								replace: true,
								search: { page: search.page + 1 },
							})
						}
					>
						<span className="@sm:inline-block hidden">Next</span>
						<StepForward data-icon="inline-end" />
					</Button>
				</div>
			</div>
		</div>
	);
}
