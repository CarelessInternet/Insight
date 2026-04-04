import { createFileRoute } from '@tanstack/react-router';
import { auth } from '~/lib/authentication/server';

export const Route = createFileRoute('/api/auth/$')({
	server: {
		handlers: {
			async GET({ request }) {
				return await auth.handler(request);
			},
			async POST({ request }) {
				return await auth.handler(request);
			},
		},
	},
});
