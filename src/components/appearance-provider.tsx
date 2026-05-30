// https://github.com/shadcn-ui/ui/pull/7173#issuecomment-3655991797
// https://ui.shadcn.com/docs/dark-mode/tanstack-start

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import {
	type Appearance,
	defaultAppearance,
	getAppearance,
	type Palette,
	setAppearance,
	type Theme,
} from '~/lib/appearance';

const AppearanceContext = createContext<{
	theme: Theme;
	setTheme: (value: Theme) => void;
	palette: Palette;
	setPalette: (value: Palette) => void;
} | null>(null);

export function AppearanceProvider({ children }: PropsWithChildren) {
	const [appearance, setAppearanceState] = useState<Appearance>(defaultAppearance);
	const [mounted, setMounted] = useState(false);

	function setAppearanceFn(value: Partial<Appearance>) {
		const newAppearance = { ...appearance, ...value };

		setAppearance(newAppearance);
		setAppearanceState(newAppearance);
	}

	useEffect(() => {
		setAppearanceState(getAppearance());
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!mounted) {
			return;
		}

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
	}, [appearance, mounted]);

	return (
		<AppearanceContext.Provider
			value={{
				...appearance,
				setPalette: (palette) => setAppearanceFn({ palette }),
				setTheme: (theme) => setAppearanceFn({ theme }),
			}}
		>
			{children}
		</AppearanceContext.Provider>
	);
}

export function useAppearance() {
	const value = useContext(AppearanceContext);

	if (!value) {
		throw new Error('useAppearance called outside of AppearanceProvider!');
	}

	return value;
}
