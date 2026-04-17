import { ImapFlow } from 'imapflow';
import { decrypt } from './crypto.server';
import type { EmailCredentialsSchema } from './email';
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
			logger.info('Authenticated to an email client');
		} catch (err) {
			logger.warn('Failed to authenticate an email client: %s', err);
		}
	}

	private async getMailbox(inbox: string) {
		const lock = await this.client.getMailboxLock(inbox);

		return {
			[Symbol.dispose]() {
				lock.release();
			},
		};
	}

	public async getMailboxMessages(inbox: string) {
		using _ = await this.getMailbox(inbox);
		return await this.client.fetchAll('1:*', { bodyStructure: true, envelope: true });
	}

	async [Symbol.asyncDispose]() {
		this.client.usable ? await this.client.logout() : this.client.close();
	}
}
