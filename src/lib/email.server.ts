import { ImapFlow } from 'imapflow';
import type { EmailSchema } from './email';
import logger from './logger.server';

export default class Email implements AsyncDisposable {
	private client: ImapFlow;

	constructor(private credentials: EmailSchema) {
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

	public static async connect(credentials: EmailSchema) {
		await using email = new Email(credentials);
		await email.establishConnection();

		return email;
	}

	private async establishConnection() {
		try {
			await this.client.connect();
			logger.info('Connected and authenticated to email client on the hostname %s', this.credentials.hostname);
		} catch (err) {
			logger.warn('Failed to authenticate email client on the hostname %s\n%s', this.credentials.hostname, err);
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
