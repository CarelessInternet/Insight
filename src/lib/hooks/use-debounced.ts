import { useEffect, useEffectEvent, useState } from 'react';

function useDebouncedValue<T>(value: T, delay = 250) {
	const [stableValue, setStableValue] = useState(value);

	useEffect(() => {
		const timeout = setTimeout(() => {
			setStableValue(value);
		}, delay);

		return () => clearTimeout(timeout);
	}, [value, delay]);

	return stableValue;
}

export function useDebouncedSyncedState<T>(value: T, onDebouncedChange: (value: T) => unknown, delay = 250) {
	const [input, setInput] = useState(value);
	const debouncedValue = useDebouncedValue(input, delay);

	useEffect(() => {
		setInput(value);
	}, [value]);

	const handleChange = useEffectEvent(onDebouncedChange);

	useEffect(() => {
		handleChange(debouncedValue);
	}, [debouncedValue]);

	return [input, setInput] as const;
}
