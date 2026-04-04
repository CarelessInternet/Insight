import { createServerFn } from '@tanstack/react-start';
import { getCookie, setCookie } from '@tanstack/react-start/server';
import z from 'zod';

const theme = z.union([z.literal('light'), z.literal('dark'), z.literal('system')]);
const storageKey = 'ui-theme';

export type Theme = z.infer<typeof theme>;
export const getThemeServerFn = createServerFn().handler(() => {
	return (getCookie(storageKey) || 'system') as Theme;
});

export const setThemeServerFn = createServerFn({ method: 'POST' })
	.inputValidator(theme)
	.handler(({ data }) => {
		setCookie(storageKey, data);
	});
