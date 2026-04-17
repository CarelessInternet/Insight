// https://github.com/mdn/dom-examples/blob/main/web-crypto/encrypt-decrypt/aes-gcm.js
// https://github.com/bradyjoslin/webcrypto-example/blob/master/script.js

import { createServerOnlyFn } from '@tanstack/react-start';
import z from 'zod';
import { aesPrefix, hmacPrefix } from './database/schema';
import { environment } from './environment.server';
import logger from './logger.server';

// https://zod.dev/codecs?id=base64tobytes
const base64ToBytes = z.codec(z.base64(), z.instanceof(Uint8Array), {
	decode: (base64String) => z.util.base64ToUint8Array(base64String),
	encode: (bytes) => z.util.uint8ArrayToBase64(bytes),
});

// https://zod.dev/codecs?id=bytestoutf8
const bytesToUtf8 = z.codec(z.instanceof(Uint8Array), z.string(), {
	decode: (bytes) => new TextDecoder().decode(bytes),
	encode: (str) => new TextEncoder().encode(str),
});

const aesName = 'AES-GCM' as const;
const aesKey = await crypto.subtle.importKey(
	'raw',
	base64ToBytes.decode(environment.ENCRYPTION_SECRET),
	{ name: aesName },
	false,
	['encrypt', 'decrypt'],
);

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
	logger.verbose('Decrypted an AES-GCM key to a string');

	return decrypted;
});

const hmacName = 'HMAC' as const;
const hmacKey = await crypto.subtle.importKey(
	'raw',
	base64ToBytes.decode(environment.LOOKUP_SECRET),
	{
		hash: 'SHA-256',
		name: hmacName,
	} satisfies HmacImportParams,
	false,
	['sign'],
);

const hmacEncryptedSchema = z.stringFormat('encrypted-data', new RegExp(`^${hmacPrefix}:(.+)$`));

export const hash = createServerOnlyFn(async (text: string) => {
	const data = z.string().parse(text);
	const hmac = await crypto.subtle.sign(hmacName, hmacKey, bytesToUtf8.encode(data));

	const hashed = hmacEncryptedSchema.parse(`${hmacPrefix}:${base64ToBytes.encode(new Uint8Array(hmac))}`);
	logger.verbose('Hashed a string to HMAC');

	return hashed;
});
