import { createServerFn } from '@tanstack/react-start';
import { getCookie, setCookie } from '@tanstack/react-start/server';
import z from 'zod';

const storageKey = 'ui-theme';

const appearance = z.object({
	theme: z.enum(['light', 'dark', 'system']),
	palette: z.enum(['default', 'greenery']),
});

export type Appearance = z.infer<typeof appearance>;
export const defaultAppearance = { theme: 'system', palette: 'default' } as const satisfies Appearance;

export type Theme = z.infer<typeof appearance.shape.theme>;
export type Palette = z.infer<typeof appearance.shape.palette>;

export const getAppearanceServerFn = createServerFn({ method: 'GET' }).handler(() => {
	const cookie = getCookie(storageKey);

	if (!cookie) {
		return defaultAppearance;
	}

	const parsed = appearance.safeParse(JSON.parse(cookie));
	return parsed.success ? parsed.data : defaultAppearance;
});

export const setAppearanceServerFn = createServerFn({ method: 'POST' })
	.inputValidator(appearance)
	.handler(({ data }) => setCookie(storageKey, JSON.stringify(data)));
