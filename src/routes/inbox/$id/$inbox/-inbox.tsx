import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import {
	ArrowUpDown,
	BellRing,
	CalendarArrowDown,
	CalendarArrowUp,
	Filter,
	ListOrdered,
	PanelLeftClose,
	PanelLeftOpen,
	RefreshCcw,
	Search,
	StepBack,
	StepForward,
} from 'lucide-react';
import { type ReactNode, Suspense, useMemo } from 'react';
import { Button } from '~/components/ui/button';
import { Field, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '~/components/ui/popover';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import { useSidebar } from '~/components/ui/sidebar';
import { Skeleton } from '~/components/ui/skeleton';
import { Spinner } from '~/components/ui/spinner';
import { Switch } from '~/components/ui/switch';
import InboxMessages, { inboxOptions } from './-inbox.messages';
import { type RouteSearchSchema, routeSearchSchema } from './-route.schema';

const Route = getRouteApi('/inbox/$id/$inbox/');

const sortByItems = {
	descending: (
		<>
			<CalendarArrowDown />
			Descending
		</>
	),
	ascending: (
		<>
			<CalendarArrowUp />
			Ascending
		</>
	),
} as const satisfies Record<RouteSearchSchema['sortBy'], ReactNode>;

export default function Inbox() {
	const parameters = Route.useParams();
	const { messageId: _, ...search } = Route.useSearch();
	const navigate = Route.useNavigate();

	const { openMobile, isMobile, toggleSidebar } = useSidebar();

	const {
		data: rowCount,
		isRefetching,
		refetch,
	} = useQuery({
		...inboxOptions({ ...parameters, ...search }),
		select: ({ rowCount }) => rowCount,
		placeholderData: keepPreviousData,
	});
	const pageCount = useMemo(
		() => (rowCount ? Math.ceil(rowCount / search.rowsPerPage) : 1),
		[rowCount, search.rowsPerPage],
	);

	// TODO: fix focus-visible not revealing all of the box shadow.
	return (
		<div className="@container flex h-full max-h-[calc(100dvh-var(--header-height))] flex-col overflow-hidden">
			<div className="flex-none">
				<div className="flex @md:flex-row flex-col">
					<div className="flex flex-row">
						{isMobile && (
							<Button variant="secondary" className="grow rounded-none border-none" onClick={toggleSidebar}>
								{openMobile ? <PanelLeftOpen /> : <PanelLeftClose />} Sidebar
							</Button>
						)}
						<Button className="grow rounded-none border-none" onClick={() => refetch()} disabled={isRefetching}>
							{isRefetching ? <Spinner /> : <RefreshCcw />}
							Refresh
						</Button>
						<Separator orientation="vertical" />
						<Popover>
							<PopoverTrigger
								render={
									<Button variant="ghost" className="grow rounded-none border-none">
										<Filter />
										Filters
									</Button>
								}
							/>
							<PopoverContent>
								<PopoverHeader>
									<PopoverTitle>Configure Filters</PopoverTitle>
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
					<InputGroup className="max-w-full rounded-none border-none">
						<InputGroupInput placeholder="Search..." />
						<InputGroupAddon>
							<Search />
						</InputGroupAddon>
					</InputGroup>
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
						disabled={isRefetching || search.page === 1}
						onClick={() =>
							navigate({
								replace: true,
								search: { page: search.page - 1 },
							})
						}
					>
						<StepBack />
						<span className="@sm:inline-block hidden">Previous</span>
					</Button>
					<Separator orientation="vertical" />
					<span className="inline-flex grow flex-row place-content-center gap-2 px-2 text-sm">
						Page
						<Input
							type="text"
							inputMode="numeric"
							className="h-5 w-10 px-2 text-sm"
							disabled={isRefetching || rowCount === 0}
							value={search.page}
							onValueChange={(rawPage, event) => {
								const page = Number(rawPage);

								if (page > pageCount || page < 1) {
									return event.cancel();
								}

								navigate({
									replace: true,
									search: { page },
								});
							}}
						/>
						of {pageCount}
					</span>
					<Separator orientation="vertical" />
					<Button
						variant="ghost"
						className="grow rounded-none border-none"
						disabled={isRefetching || search.page === pageCount}
						onClick={() =>
							navigate({
								replace: true,
								search: { page: search.page + 1 },
							})
						}
					>
						<span className="@sm:inline-block hidden">Next</span>
						<StepForward />
					</Button>
				</div>
			</div>
		</div>
	);
}
