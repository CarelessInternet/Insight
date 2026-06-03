import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import {
	ArrowUpDown,
	BellRing,
	CalendarArrowDown,
	CalendarArrowUp,
	Filter,
	ListOrdered,
	RefreshCcw,
	Search,
	StepBack,
	StepForward,
} from 'lucide-react';
import { type ReactNode, Suspense } from 'react';
import { Button } from '~/components/ui/button';
import { Field, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '~/components/ui/popover';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
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
	const { messageId: _, ...search } = Route.useSearch();
	const navigate = Route.useNavigate();

	const { isRefetching, refetch } = useQuery({ ...inboxOptions({ ...parameters, ...search }), select: () => null });
	const page = search.offset / search.limit + 1;

	// TODO: fix focus-visible not revealing all of the box shadow.
	return (
		<div className="@container flex h-full max-h-[calc(100dvh-var(--header-height))] flex-col overflow-hidden">
			<div className="flex-none">
				<div className="flex @sm:flex-row flex-col">
					<div className="flex flex-row">
						<Button
							className="grow rounded-none border-none"
							onClick={() => refetch()}
							disabled={isRefetching}
							aria-disabled={isRefetching}
						>
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
												search: (previous) => ({
													...previous,
													sortBy: value ?? routeSearchSchema.shape.sortBy.def.defaultValue,
												}),
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
											routeSearchSchema.shape.limit
												.unwrap()
												.values.values()
												.map((pageSize) => [pageSize, pageSize]),
										)}
										value={search.limit}
										onValueChange={(value) =>
											navigate({
												replace: true,
												search: (previous) => ({
													...previous,
													limit: value ?? routeSearchSchema.shape.limit.def.defaultValue,
												}),
											})
										}
									>
										<SelectTrigger id="rows-per-page" size="sm">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												{[...routeSearchSchema.shape.limit.unwrap().values].map((pageSize) => (
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
										checked={search.seen}
										onCheckedChange={(seen) =>
											navigate({
												replace: true,
												search: (previous) => ({ ...previous, seen }),
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
					<Button variant="ghost" className="grow rounded-none border-none">
						<StepBack />
						<span className="@sm:inline-block hidden">Previous</span>
					</Button>
					<Separator orientation="vertical" />
					<span className="inline-flex grow flex-row place-content-center gap-2 px-2 text-sm">
						Page <Input type="text" inputMode="numeric" value={page} className="h-5 w-10 px-2 text-sm" /> of 1
					</span>
					<Separator orientation="vertical" />
					<Button variant="ghost" className="grow rounded-none border-none">
						<span className="@sm:inline-block hidden">Next</span>
						<StepForward />
					</Button>
				</div>
			</div>
		</div>
	);
}
