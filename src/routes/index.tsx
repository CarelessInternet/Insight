import { createFileRoute, Link } from '@tanstack/react-router';
import { getSession } from '~/lib/middleware';

export const Route = createFileRoute('/')({
	beforeLoad: async () => await getSession(),
	component: Home,
});

function Home() {
	const state = Route.useRouteContext();

	return (
		<>
			User: {state?.user?.email ?? 'None.'}
			<Link to="/account/settings">Settings</Link>
		</>
	);
}
