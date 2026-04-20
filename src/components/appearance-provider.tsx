// https://github.com/shadcn-ui/ui/pull/7173#issuecomment-3655991797

import { useRouter } from '@tanstack/react-router';
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect } from 'react';
import { type Appearance, type Palette, setAppearanceServerFn, type Theme } from '~/lib/appearance';

const AppearanceContext = createContext<{
	theme: Theme;
	setTheme: (value: Theme) => void;
	palette: Palette;
	setPalette: (value: Palette) => void;
} | null>(null);

export function AppearanceProvider({ appearance, children }: PropsWithChildren<{ appearance: Appearance }>) {
	const router = useRouter();

	async function setAppearance(value: Partial<Appearance>) {
		await setAppearanceServerFn({ data: { ...appearance, ...value } });
		await router.invalidate();
	}

	useEffect(() => {
		const root = document.documentElement;
		root.dataset.palette = appearance.palette;

		const applyDark = (isDark: boolean) => root.classList.toggle('dark', isDark);

		if (appearance.theme === 'system') {
			const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
			const sync = () => applyDark(mediaQuery.matches);

			sync();
			mediaQuery.addEventListener('change', sync);

			return () => mediaQuery.removeEventListener('change', sync);
		}

		applyDark(appearance.theme === 'dark');
	}, [appearance]);

	return (
		<AppearanceContext.Provider
			value={{
				...appearance,
				setPalette: (palette) => setAppearance({ palette }),
				setTheme: (theme) => setAppearance({ theme }),
			}}
		>
			{children}
		</AppearanceContext.Provider>
	);
}

export function useAppearance() {
	const value = useContext(AppearanceContext);
	if (!value) throw new Error('useTheme called outside of ThemeProvider!');

	return value;
}
