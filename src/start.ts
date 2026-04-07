import { createMiddleware, createStart } from '@tanstack/react-start';

const loggingFunctionMiddleware = createMiddleware({ type: 'function' }).server(
	async ({ method, next, serverFnMeta: { name, filename } }) => {
		// The logger needs to be imported here as opposed to top-level
		// to prevent it from being bundled on the client-side.
		const { default: logger } = await import('~/lib/logger.server');
		logger.http('[%s] %s %s', name, method, filename);

		return next();
	},
);

export const startInstance = createStart(() => ({ functionMiddleware: [loggingFunctionMiddleware] }));
