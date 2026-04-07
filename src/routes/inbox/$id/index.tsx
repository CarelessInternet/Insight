import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { emailAccountSchema } from '~/lib/database/schema';
import { sessionMiddleware } from '~/lib/middleware';
import queryClient from '~/lib/query';
import Inbox, { inboxOptions } from './-inbox';

const getMessages = createServerFn({ method: 'GET' })
	.middleware([sessionMiddleware])
	.inputValidator(emailAccountSchema.shape.id)
	.handler(async ({ data: id }) => await queryClient.prefetchQuery(inboxOptions(id)));

export const Route = createFileRoute('/inbox/$id/')({
	component: RouteComponent,
	loader: async ({ params: { id } }) => await getMessages({ data: id }),
});

function RouteComponent() {
	const { id } = Route.useParams();

	return (
		<>
			<div>Hello "/inbox/$id/"!</div>
			<Inbox id={id} />
		</>
	);
}
