import { createIsomorphicFn } from '@tanstack/react-start';
import { getCookie, setCookie } from '@tanstack/react-start/server';

export const getIsomorphicCookie = createIsomorphicFn()
	.client((key: string) => {
		const cookies = document.cookie.split(';');

		for (const cookie of cookies) {
			const [name, value] = cookie.trim().split('=');

			if (name === key) {
				return value ?? null;
			}
		}

		return null;
	})
	.server((key: string) => getCookie(key) ?? null);

type SetCookieOptions = Pick<CookieInit, 'name' | 'value'> & { expires?: number };

export const setIsomorphicCookie = createIsomorphicFn()
	.client(
		({ name, value, expires }: SetCookieOptions) =>
			void cookieStore.set({ name, value, expires: expires ? Date.now() + expires : null }),
	)
	.server(({ name, value, expires }: SetCookieOptions) => setCookie(name, value, { maxAge: expires }));
