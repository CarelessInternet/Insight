import z from 'zod';
import type { PasskeyContextPayload } from '../crypto.server';

const contextPrefix = 'passkey-context' as const;
const contextSchema = z.stringFormat(contextPrefix, new RegExp(`^${contextPrefix}:(.+)$`));

export function resolveContext(context: string) {
	const data = contextSchema.parse(context);
	const [, token] = data.split(':');

	return token;
}

export function toContext(nonce: PasskeyContextPayload['nonce']) {
	return contextSchema.parse(`passkey-context:${nonce}`);
}
