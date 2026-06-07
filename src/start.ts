import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start';

const csrfMiddleware = createCsrfMiddleware({
	filter: ({ handlerType }) => handlerType === 'serverFn',
});

const viewportMiddleware = createMiddleware({ type: 'request' }).server(async ({ next }) => {
	const result = await next();
	// Allow accepting the viewport as a header to later prevent layout shifts for resizable panels.
	result.response.headers.set('Accept-CH', 'Sec-CH-Viewport-Width');

	return result;
});

const loggingFunctionMiddleware = createMiddleware({ type: 'function' }).server(
	async ({ method, next, serverFnMeta: { name, filename } }) => {
		// The logger needs to be imported here as opposed to top-level
		// to prevent it from being bundled on the client-side.
		const { default: logger } = await import('~/lib/logger.server');
		logger.http('[%s] %s %s', name, method, filename);

		return next();
	},
);

export const startInstance = createStart(() => ({
	functionMiddleware: [loggingFunctionMiddleware],
	requestMiddleware: [csrfMiddleware, viewportMiddleware],
}));
