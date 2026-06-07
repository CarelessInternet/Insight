// Original code from @mantine/hooks:
// https://github.com/mantinedev/mantine/blob/master/packages/@mantine/hooks/src/use-media-query/use-media-query.ts

import { useEffect, useState } from 'react';

type State = boolean | undefined;

export const matchesMediaQuery = (mql: MediaQueryList | MediaQueryListEvent) => mql.matches;

export function useMediaQuery(query: string, initialValue?: () => State | State) {
	const [matches, setMatches] = useState<State>(initialValue);

	useEffect(() => {
		try {
			const mql = window.matchMedia(query);
			const callback = (event: MediaQueryListEvent) => setMatches(matchesMediaQuery(event));

			mql.addEventListener('change', callback);
			setMatches(matchesMediaQuery(mql));

			return () => mql.removeEventListener('change', callback);
		} catch {
			// Safari iframe compatibility issue.
			return undefined;
		}
	}, [query]);

	return matches;
}
