import { type ErrorComponentProps, getRouteApi } from '@tanstack/react-router';
import { RefreshCcwDot } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { ScrollArea, ScrollAreaContent, ScrollAreaViewport, ScrollBar } from './ui/scroll-area';

const Route = getRouteApi('__root__');

export default function ErrorComponent({ error, reset }: ErrorComponentProps) {
	return (
		<div className="flex flex-1 items-center justify-center p-6 md:p-10">
			<Card className="size-full max-w-4xl">
				<CardHeader className="text-center">
					<CardTitle>An Unexpected Error Occurred!</CardTitle>
					<CardDescription className="whitespace-pre-wrap">{error.name}</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="font-extrabold">{error.message}</p>
					{!!error.stack && (
						<>
							<p className="mt-4 text-muted-foreground">Error stack:</p>
							<div className="max-h-96 overflow-y-auto">
								<ScrollArea>
									<ScrollAreaViewport>
										<ScrollAreaContent>
											<pre>{error.stack}</pre>
										</ScrollAreaContent>
									</ScrollAreaViewport>
									<ScrollBar />
								</ScrollArea>
							</div>
						</>
					)}
				</CardContent>
				<CardFooter className="flex-col justify-center gap-2">
					<Button onClick={() => reset()}>
						<RefreshCcwDot data-icon="inline-start" />
						Retry
					</Button>
					<Route.Link to="/" className="underline">
						Go to Homepage
					</Route.Link>
				</CardFooter>
			</Card>
		</div>
	);
}
