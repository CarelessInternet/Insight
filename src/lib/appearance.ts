import { createClientOnlyFn } from '@tanstack/react-start';
import z from 'zod';

const storageKey = 'ui-theme';
// https://zod.dev/codecs#jsonschema
const appearance = z.codec(
	z.string(),
	z.object({
		theme: z.enum(['light', 'dark', 'system']),
		palette: z.enum(['default', 'rose', 'orange', 'green', 'sky']),
	}),
	{
		decode: (jsonString, ctx) => {
			try {
				return JSON.parse(jsonString);
			} catch (err) {
				ctx.issues.push({
					code: 'invalid_format',
					format: 'json',
					input: jsonString,
					message: (err as Error).message,
				});

				return z.NEVER;
			}
		},
		encode: (value) => JSON.stringify(value),
	},
);

export type Appearance = z.output<typeof appearance>;
export const defaultAppearance = { theme: 'system', palette: 'default' } as const satisfies Appearance;

export type Theme = Appearance['theme'];
export type Palette = Appearance['palette'];

export const getAppearance = createClientOnlyFn(() => {
	try {
		return appearance.decode(localStorage.getItem(storageKey) || '');
	} catch {
		return defaultAppearance;
	}
});

export const setAppearance = createClientOnlyFn((data: Appearance) =>
	localStorage.setItem(storageKey, appearance.encode(data)),
);

export const appearanceScript = `
	const storage = localStorage.getItem('${storageKey}');
	const appearance = storage ? JSON.parse(storage) : ${JSON.stringify(defaultAppearance)};
	const dark = appearance.theme === 'system'
		? matchMedia('(prefers-color-scheme: dark)').matches
		: appearance.theme === 'dark';

	const root = document.documentElement;
	root.dataset.palette = appearance.palette;
	root.classList.toggle('dark', dark);
`;
