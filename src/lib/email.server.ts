import { ImapFlow } from 'imapflow';
import type z from 'zod';
import { decrypt } from './crypto.server';
import type { EmailCredentialsSchema, paginatedEmailMessagesSchema } from './email';
import logger from './logger.server';

export default class Email implements AsyncDisposable {
	private client: ImapFlow;

	constructor(credentials: EmailCredentialsSchema) {
		this.client = new ImapFlow({
			auth: {
				user: credentials.email,
				pass: credentials.password,
			},
			host: credentials.hostname,
			port: 993,
			logger: false,
		});
	}

	public get authenticated() {
		return this.client.authenticated;
	}

	public static async decryptCredentials(account: EmailCredentialsSchema) {
		const [email, hostname, password] = await Promise.all([
			decrypt(account.email),
			decrypt(account.hostname),
			decrypt(account.password),
		]);

		return { email, hostname, password } satisfies EmailCredentialsSchema;
	}

	public async connect() {
		try {
			await this.client.connect();
			logger.verbose('Authenticated to an email client');
		} catch (err) {
			logger.warn('Failed to authenticate an email client: %s', err);
		}
	}

	private async getMailbox(inbox: string) {
		const lock = await this.client.getMailboxLock(inbox, { readOnly: true });

		return {
			[Symbol.dispose]() {
				lock.release();
			},
		};
	}

	public async getMailboxes() {
		return await this.client.listTree();
	}

	public async getPaginatedMailboxMessages({
		inbox,
		limit,
		offset,
		sortBy,
		seen,
	}: z.infer<typeof paginatedEmailMessagesSchema>) {
		using _ = await this.getMailbox(inbox);
		const amount = (this.client.mailbox || null)?.exists ?? 0;

		if (amount === 0 || offset >= amount) {
			return [];
		}

		const end = sortBy === 'descending' ? amount - offset : Math.min(amount, offset + limit);
		const start = sortBy === 'descending' ? Math.max(1, end - limit + 1) : offset + 1;

		if (!seen) {
			const messages = await this.client.fetchAll(`${start}:${end}`, { envelope: true, flags: true });

			return messages.sort((a, b) => (sortBy === 'ascending' ? a.uid - b.uid : b.uid - a.uid));
		}

		const uids = (await this.client.search({ seen }, { uid: true })) || [];
		const page = uids.sort((a, b) => b - a).slice(offset, offset + limit);

		const messages = await this.client.fetchAll(
			page,
			{
				envelope: true,
				flags: true,
			},
			{ uid: true },
		);

		return messages;
	}

	public async [Symbol.asyncDispose]() {
		this.client.usable ? await this.client.logout() : this.client.close();
	}
}
