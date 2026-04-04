import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { beforeLoad } from '~/lib/authentication/middleware';
import { auth } from '~/lib/authentication/server';
import queryClient from '~/lib/query';
import Email from './-email';
import { emailAccountsOptions } from './-email.table';
import Passkey from './-passkey';

const getUserData = createServerFn({ method: 'GET' })
	.inputValidator((data: typeof auth.$Infer.Session) => data)
	.handler(async ({ data }) => {
		const [, passkeys] = await Promise.all([
			queryClient.prefetchQuery(emailAccountsOptions),
			auth.api.listPasskeys({ headers: getRequestHeaders() }),
		]);

		return { passkeys, ...data };
	});

export const Route = createFileRoute('/account/settings/')({
	beforeLoad: async () => await beforeLoad(),
	component: RouteComponent,
	loader: async ({ context }) => await getUserData({ data: context }),
});

function RouteComponent() {
	const { passkeys } = Route.useLoaderData();

	return (
		<div>
			<Passkey passkeys={passkeys} />
			<Email />
		</div>
	);
}
