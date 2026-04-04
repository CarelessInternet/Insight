import { redirect } from '@tanstack/react-router';
import { createMiddleware, createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import logger from '../logger.server';
import { auth } from './server';

export const getSession = createServerFn({ method: 'GET' }).handler(() => {
	return auth.api.getSession({ headers: getRequestHeaders() });
});

export const ensureSession = createServerFn({ method: 'GET' }).handler(async () => {
	const session = await auth.api.getSession({ headers: getRequestHeaders() });

	if (!session) {
		logger.warn('User unauthorized.');
		throw new Error('Unauthorized.');
	}

	return session;
});

export const beforeLoad = createServerFn({ method: 'GET' }).handler(async () => {
	const session = await getSession();

	if (!session) {
		logger.warn('User unauthorized, redirecting to /auth/sign-in');
		throw redirect({ to: '/auth/sign-in' });
	}

	return session;
});

export const sessionMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
	return next({ context: await ensureSession() });
});
