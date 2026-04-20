import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { Suspense } from 'react';
import { Skeleton } from '~/components/ui/skeleton';
import { Table, TableBody, TableCell, TableRow } from '~/components/ui/table';
import { auth } from '~/lib/authentication/server';
import { sessionMiddleware } from '~/lib/middleware';
import getQueryClient from '~/lib/query';
import EmailAccounts, { emailAccountsOptions } from './-email.table';
import Passkey from './-passkey';

const getUserData = createServerFn({ method: 'GET' })
	.middleware([sessionMiddleware])
	.handler(async () => {
		getQueryClient().ensureQueryData(emailAccountsOptions());
		const passkeys = await auth.api.listPasskeys({ headers: getRequestHeaders() });

		return passkeys;
	});

export const Route = createFileRoute('/account/settings/')({
	component: RouteComponent,
	loader: async () => await getUserData(),
});

function RouteComponent() {
	const passkeys = Route.useLoaderData();

	return (
		<div className="ml-2 space-y-2">
			<Passkey passkeys={passkeys} />
			<Suspense
				fallback={
					<Table>
						<TableBody>
							{Array.from({ length: 5 }, () => (
								<TableRow key={crypto.randomUUID()}>
									<TableCell>
										<Skeleton className="h-8 w-full" />
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				}
			>
				<EmailAccounts />
			</Suspense>
		</div>
	);
}
