// https://github.com/shadcn-ui/ui/pull/7173#issuecomment-3655991797

import { useRouter } from '@tanstack/react-router';
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect } from 'react';
import { setThemeServerFn, type Theme } from '~/lib/theme';

type ThemeContextVal = { theme: Theme; setTheme: (val: Theme) => void };
type Props = PropsWithChildren<{ theme: Theme }>;

const ThemeContext = createContext<ThemeContextVal | null>(null);

export function ThemeProvider({ children, theme }: Props) {
	const router = useRouter();

	async function setTheme(val: Theme) {
		await setThemeServerFn({ data: val });
		await router.invalidate();
	}

	useEffect(() => {
		const root = document.documentElement;

		if (theme === 'dark') {
			root.classList.add('dark');
			return;
		}

		if (theme === 'light') {
			root.classList.remove('dark');
			return;
		}

		const mq = window.matchMedia('(prefers-color-scheme: dark)');

		const apply = () => {
			root.classList.toggle('dark', mq.matches);
		};

		apply();
		mq.addEventListener('change', apply);

		return () => mq.removeEventListener('change', apply);
	}, [theme]);

	return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
	const value = useContext(ThemeContext);
	if (!value) throw new Error('useTheme called outside of ThemeProvider!');

	return value;
}
