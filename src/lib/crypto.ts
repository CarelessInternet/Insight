// https://github.com/mdn/dom-examples/blob/main/web-crypto/encrypt-decrypt/aes-gcm.js
// https://github.com/bradyjoslin/webcrypto-example/blob/master/script.js

import { createServerFn, createServerOnlyFn } from '@tanstack/react-start';
import z from 'zod';
import { environment } from './environment';
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

const prefix = 'aes-256-gcm' as const;
const name = 'AES-GCM' as const;
const key = createServerOnlyFn(() =>
	crypto.subtle.importKey('raw', base64ToBytes.decode(environment.APP_SECRET), { name }, false, ['encrypt', 'decrypt']),
);

export const encrypt = createServerFn({ method: 'POST' })
	.inputValidator(z.string())
	.handler(async ({ data }) => {
		// IV (Initialization Vector) is required for AES-GCM.
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const ciphertext = await crypto.subtle.encrypt({ name, iv }, await key(), bytesToUtf8.encode(data));

		const encrypted = `${prefix}:${base64ToBytes.encode(iv)}:${base64ToBytes.encode(new Uint8Array(ciphertext))}`;
		logger.verbose('Encrypted a string to an AES-GCM key.');

		return encrypted;
	});

export const decrypt = createServerFn({ method: 'POST' })
	// Ensure the string has the same format as the encrypted data.
	.inputValidator(z.stringFormat('encrypted-data', new RegExp(`^${prefix}:(.+):(.+)$`)))
	.handler(async ({ data }) => {
		const [, iv, ciphertext] = data.split(':');
		const plaintext = await crypto.subtle.decrypt(
			{ name, iv: base64ToBytes.decode(iv as string) },
			await key(),
			base64ToBytes.decode(ciphertext as string),
		);

		const decrypted = bytesToUtf8.decode(new Uint8Array(plaintext));
		logger.verbose('Decrypted an AES-GCM key to a string.');

		return decrypted;
	});
