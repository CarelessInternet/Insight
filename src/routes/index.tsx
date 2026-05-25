import { createFileRoute, getRouteApi } from '@tanstack/react-router';

const root = getRouteApi('__root__');

export const Route = createFileRoute('/')({
	component: Home,
});

function Home() {
	const state = root.useRouteContext();

	return (
		<div>
			User: {state?.user?.email ?? 'None.'}
			<Route.Link to="/account/settings">Settings</Route.Link>
		</div>
	);
}
