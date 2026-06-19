import { getIsomorphicCookie } from './cookie';

// https://park.is/blog_posts/20240803_extracting_timestamp_from_uuid_v7/
export function extractTimestampFromUUIDv7(uuid: string): Date {
	const [unix_1, unix_2] = uuid.split('-');

	if (!unix_1 || !unix_2) {
		throw new TypeError('Missing the Unix timestamp epoch in the UUIDv7.');
	}

	// The second part of the UUID contains the high bits of the timestamp (48 bits in total).
	const highBitsHex = unix_1 + unix_2.slice(0, 4);
	// Convert the high bits from hex to decimal.
	// The UUID v7 timestamp is the number of milliseconds since Unix epoch (January 1, 1970).
	const timestampInMilliseconds = parseInt(highBitsHex, 16);

	return new Date(timestampInMilliseconds);
}

export function dateAndTime(date: Date) {
	const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
		dateStyle: 'short',
		timeStyle: 'medium',
		timeZone: getIsomorphicCookie('timezone') ?? 'UTC',
	});

	return dateFormatter.format(date);
}

// https://blog.webdevsimplified.com/2020-07/relative-time-format/
const formatter = new Intl.RelativeTimeFormat(undefined, {
	numeric: 'auto',
});

const DIVISIONS = [
	{ amount: 60, name: 'seconds' },
	{ amount: 60, name: 'minutes' },
	{ amount: 24, name: 'hours' },
	{ amount: 7, name: 'days' },
	{ amount: 4.34524, name: 'weeks' },
	{ amount: 12, name: 'months' },
	{ amount: Number.POSITIVE_INFINITY, name: 'years' },
] as const;

export function relativeTime(timestamp: Date) {
	let duration = (timestamp.getTime() - Date.now()) / 1000;

	for (const division of DIVISIONS) {
		if (Math.abs(duration) < division.amount) {
			return formatter.format(Math.round(duration), division.name);
		}

		duration /= division.amount;
	}
}
