import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { ModeToggle } from '~/components/toggle';
import { auth } from '~/lib/authentication/server';

const getUser = createServerFn({ method: 'GET' }).handler(() => {
	return auth.api.getSession({ headers: getRequestHeaders() });
});

export const Route = createFileRoute('/')({
	component: Home,
	loader: async () => await getUser(),
});

function Home() {
	const state = Route.useLoaderData();

	return (
		<>
			User: {state?.user.email ?? 'None.'}
			<ModeToggle />
		</>
	);
}
