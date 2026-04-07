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

const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
	timeStyle: 'medium',
	dateStyle: 'short',
});

export function dateAndTime(date: Date) {
	return dateFormatter.format(date);
}
