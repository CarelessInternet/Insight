// https://github.com/mdn/dom-examples/blob/main/web-crypto/encrypt-decrypt/aes-gcm.js
// https://github.com/bradyjoslin/webcrypto-example/blob/master/script.js

import { createServerOnlyFn } from '@tanstack/react-start';
import z from 'zod';
import { aesPrefix, hmacPrefix, type user } from './database/schema';
import { environment } from './environment.server';
import { base64ToBytes, bytesToUtf8 } from './formatter';
import logger from './logger.server';

const rootKey = await crypto.subtle.importKey(
	'raw',
	bytesToUtf8.encode(environment.APPLICATION_SECRET),
	'HKDF',
	false,
	['deriveKey'],
);

const hmacName = 'HMAC' as const;
const aesName = 'AES-GCM' as const;
const createDerivedKey = async (context: string, usage: 'encryption' | 'hash' | 'verification') =>
	await crypto.subtle.deriveKey(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: bytesToUtf8.encode('insight-v1'),
			// Info is required but may be empty: https://developer.mozilla.org/en-US/docs/Web/API/HkdfParams#info
			info: bytesToUtf8.encode(context),
		},
		rootKey,
		usage === 'encryption' ? { name: aesName, length: 256 } : { name: hmacName, hash: 'SHA-256' },
		false,
		usage === 'encryption' ? ['decrypt', 'encrypt'] : usage === 'hash' ? ['sign'] : ['sign', 'verify'],
	);

const aesKey = await createDerivedKey('database', 'encryption');
const aesEncryptedSchema = z.stringFormat('encrypted-data', new RegExp(`^${aesPrefix}:(.+):(.+)$`));

export const encrypt = createServerOnlyFn(async (text: string) => {
	const data = z.string().parse(text);
	// IV (Initialization Vector, a nonce: number used once) is required for AES-GCM.
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt({ name: aesName, iv }, aesKey, bytesToUtf8.encode(data));

	const encrypted = aesEncryptedSchema.parse(
		`${aesPrefix}:${base64ToBytes.encode(iv)}:${base64ToBytes.encode(new Uint8Array(ciphertext))}`,
	);
	logger.verbose('Encrypted a string to an AES-GCM key');

	return encrypted;
});

export const decrypt = createServerOnlyFn(async (encrypted: string) => {
	const data = aesEncryptedSchema.parse(encrypted);
	const [, iv, ciphertext] = data.split(':');
	const plaintext = await crypto.subtle.decrypt(
		{ name: aesName, iv: base64ToBytes.decode(iv as string) },
		aesKey,
		base64ToBytes.decode(ciphertext as string),
	);

	const decrypted = bytesToUtf8.decode(new Uint8Array(plaintext));
	logger.debug('Decrypted an AES-GCM key to a string');

	return decrypted;
});

const hmacKey = await createDerivedKey('lookup', 'hash');
const hmacEncryptedSchema = z.stringFormat('encrypted-data', new RegExp(`^${hmacPrefix}:(.+)$`));

export const hash = createServerOnlyFn(async (text: string) => {
	const data = z.string().parse(text);
	const hmac = await crypto.subtle.sign(hmacName, hmacKey, bytesToUtf8.encode(data));

	const hashed = hmacEncryptedSchema.parse(`${hmacPrefix}:${base64ToBytes.encode(new Uint8Array(hmac))}`);
	logger.debug('Hashed a string to HMAC');

	return hashed;
});

export interface PasskeyContextPayload {
	username: typeof user.$inferSelect.name;
	email: typeof user.$inferSelect.email;
	nonce: string;
	/**
	 * The expiration is in milliseconds.
	 */
	expiration: number;
}

interface PasskeyContext {
	payload: PasskeyContextPayload;
	token: string;
}

const passkeyContextKey = await createDerivedKey('passkey-context', 'verification');
const passkeyContextSchema = z.stringFormat('passkey-context-data', (value) => {
	const [body, signature] = value.split('.');

	return z.base64().safeParse(body).success && z.base64().safeParse(signature).success;
});

/**
 * The TTL is in seconds.
 */
export const passkeyContextPayloadTTL = 10 * 60;

export const createPasskeyContext = createServerOnlyFn(
	async (context: Pick<PasskeyContextPayload, 'email' | 'username'>) => {
		const payload = {
			...context,
			expiration: Date.now() + passkeyContextPayloadTTL * 1000,
			nonce: crypto.randomUUID(),
		} satisfies PasskeyContextPayload;

		const body = base64ToBytes.encode(bytesToUtf8.encode(JSON.stringify(payload)));
		const signature = await crypto.subtle.sign(hmacName, passkeyContextKey, bytesToUtf8.encode(body));

		return {
			payload,
			token: passkeyContextSchema.parse(`${body}.${base64ToBytes.encode(new Uint8Array(signature))}`),
		} satisfies PasskeyContext;
	},
);

export const verifyPasskeyContext = createServerOnlyFn(async (token: PasskeyContext['token']) => {
	const data = passkeyContextSchema.parse(token);
	const [body, signature] = data.split('.');

	const ok = await crypto.subtle.verify(
		hmacName,
		passkeyContextKey,
		base64ToBytes.decode(signature as string),
		bytesToUtf8.encode(body as string),
	);

	if (!ok) {
		throw new Error('Invalid context token signature.');
	}

	const payload = JSON.parse(bytesToUtf8.decode(base64ToBytes.decode(body as string))) as PasskeyContextPayload;

	if (payload.expiration < Date.now()) {
		throw new Error('Context token expired.');
	}

	return payload;
});
