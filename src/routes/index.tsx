import { createFileRoute } from '@tanstack/react-router';
import { getSession } from '~/lib/middleware';

export const Route = createFileRoute('/')({
	beforeLoad: async () => await getSession(),
	component: Home,
});

function Home() {
	const state = Route.useRouteContext();

	return (
		<div>
			User: {state?.user?.email ?? 'None.'}
			<Route.Link to="/account/settings">Settings</Route.Link>
		</div>
	);
}
