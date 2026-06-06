import type { QueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { Suspense } from 'react';
import { Skeleton } from '~/components/ui/skeleton';
import { Table, TableBody, TableCell, TableRow } from '~/components/ui/table';
import authClient from '~/lib/authentication/client';
import auth from '~/lib/authentication/server';
import EmailAccounts, { defaultPagination, emailAccountsOptions } from './-email.table';
import Passkey from './-passkey';

const getUserData = createIsomorphicFn()
	.server(async (queryClient: QueryClient, userId: typeof auth.$Infer.Session.user.id) => {
		void queryClient.prefetchQuery(emailAccountsOptions({ pagination: defaultPagination, userId }));
		return await auth.api.listPasskeys({ headers: getRequestHeaders() });
	})
	.client(async (queryClient: QueryClient, userId: typeof auth.$Infer.Session.user.id) => {
		void queryClient.prefetchQuery(emailAccountsOptions({ pagination: defaultPagination, userId }));
		const passkeys = await authClient.passkey.listUserPasskeys();

		return Array.isArray(passkeys.data) ? passkeys.data : [];
	});

export const Route = createFileRoute('/account/settings/')({
	component: RouteComponent,
	loader: async ({ context: { queryClient, user } }) => {
		if (!user) {
			throw Route.redirect({ to: '/auth/sign-in' });
		}

		return { passkeys: await getUserData(queryClient, user.id), userId: user.id };
	},
});

function RouteComponent() {
	return (
		<div className="ml-2 space-y-2">
			<Passkey />
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
