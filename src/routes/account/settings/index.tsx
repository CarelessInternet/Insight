import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from '~/lib/authentication/server';
import { sessionMiddleware } from '~/lib/middleware';
import queryClient from '~/lib/query';
import EmailAccounts, { emailAccountsOptions } from './-email.table';
import Passkey from './-passkey';

const getUserData = createServerFn({ method: 'GET' })
	.middleware([sessionMiddleware])
	.handler(async () => {
		const [, passkeys] = await Promise.all([
			queryClient.prefetchQuery(emailAccountsOptions()),
			auth.api.listPasskeys({ headers: getRequestHeaders() }),
		]);

		return passkeys;
	});

export const Route = createFileRoute('/account/settings/')({
	component: RouteComponent,
	loader: async () => await getUserData(),
});

function RouteComponent() {
	const passkeys = Route.useLoaderData();

	return (
		<div className="space-y-2 ml-2">
			<Passkey passkeys={passkeys} />
			<EmailAccounts />
		</div>
	);
}
