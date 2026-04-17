import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { emailAccountSelectSchema } from '~/lib/database/schema';
import { sessionMiddleware } from '~/lib/middleware';
import getQueryClient from '~/lib/query';
import Inbox, { inboxOptions } from './-inbox';

const getMessages = createServerFn({ method: 'GET' })
	.middleware([sessionMiddleware])
	.inputValidator(emailAccountSelectSchema.shape.id)
	.handler(({ data: id }) => getQueryClient().ensureQueryData(inboxOptions(id)));

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
