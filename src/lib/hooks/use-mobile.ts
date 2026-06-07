import { createClientOnlyFn } from '@tanstack/react-start';
import { useEffect } from 'react';
import { getIsomorphicCookie, setIsomorphicCookie } from '../cookie';
import { matchesMediaQuery, useMediaQuery } from './use-media-query';

const MOBILE_BREAKPOINT = 768;
const MOBILE_COOKIE_NAME = 'is_mobile';
const matchMediaQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

export function isWidthMobile(width: number) {
	return width < MOBILE_BREAKPOINT;
}

export const isClientMobile = createClientOnlyFn((mql?: Parameters<typeof matchesMediaQuery>[0]) =>
	matchesMediaQuery(mql ?? window.matchMedia(matchMediaQuery)),
);

export function useIsMobile() {
	const isMobile = useMediaQuery(matchMediaQuery, () => {
		// Using a cookie as the initial state prevents sudden layout shifts.
		const cookieState = getIsomorphicCookie(MOBILE_COOKIE_NAME);
		return cookieState !== null ? (JSON.parse(cookieState) as boolean) : undefined;
	});

	useEffect(() => {
		setIsomorphicCookie({ name: MOBILE_COOKIE_NAME, value: String(isMobile) });
	}, [isMobile]);

	return !!isMobile;
}
