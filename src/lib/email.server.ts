import { ImapFlow, type SearchObject } from 'imapflow';
import PostalMime from 'postal-mime';
import type z from 'zod';
import { decrypt } from './crypto.server';
import {
	type EmailCredentialsSchema,
	inbox as emailInbox,
	getMessageSchema,
	getSubject,
	paginatedEmailMessagesSchema,
	type searchMessageFilters,
	setMessageFlagsSchema,
} from './email';
import logger from './logger.server';
import type { PaginatedQueryResult } from './query';

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

	private async getMailbox(parameter: z.infer<typeof emailInbox>) {
		const inbox = emailInbox.parse(parameter);
		const lock = await this.client.getMailboxLock(inbox, { readOnly: false });

		return {
			[Symbol.dispose]() {
				lock.release();
			},
		};
	}

	public async getMailboxes() {
		return await this.client.listTree();
	}

	public async getPaginatedMailboxMessages(parameters: z.infer<typeof paginatedEmailMessagesSchema>) {
		const { inbox, page, rowsPerPage, search, seen, sortBy } = paginatedEmailMessagesSchema.parse(parameters);

		const limit = Math.max(1, rowsPerPage);
		const offset = Math.max(0, (Math.max(1, page) - 1) * limit);

		using _ = await this.getMailbox(inbox);
		// Seen: false = only unreads, otherwise all messages.
		const searchParameters: SearchObject = seen ? { all: true } : { seen };

		const searchParametersMap = { content: 'body', from: 'from', subject: 'subject' } satisfies Record<
			keyof typeof searchMessageFilters,
			keyof SearchObject
		>;
		const searchKey = search?.filterBy && searchParametersMap[search.filterBy];

		if (searchKey) {
			searchParameters[searchKey] = search.value;
		}

		const uids = (await this.client.search(searchParameters, { uid: true })) || [];

		if (uids.length === 0 || offset >= uids.length) {
			return { data: [], rowCount: 0 } satisfies PaginatedQueryResult<typeof data>;
		}

		const orderedUids = uids.sort((a, b) => (sortBy === 'ascending' ? a - b : b - a));
		const pageUids = orderedUids.slice(offset, offset + limit);

		const messages = await this.client.fetchAll(
			pageUids,
			{
				envelope: true,
				flags: true,
			},
			{ uid: true },
		);
		// The messages are returned unsorted despite the UIDs being sorted.
		const data = messages.sort((a, b) => (sortBy === 'ascending' ? a.uid - b.uid : b.uid - a.uid));

		return { data, rowCount: uids.length } satisfies PaginatedQueryResult<typeof data>;
	}

	public async getMessage(parameters: z.infer<typeof getMessageSchema>) {
		const { inbox, messageId } = getMessageSchema.parse(parameters);
		using _ = await this.getMailbox(inbox);

		const message = await this.client.fetchOne(messageId, { flags: true, source: true }, { uid: true });

		// biome-ignore lint/complexity/useOptionalChain: Optional chaining does not work on type false.
		if (!message || !message.source) {
			return null;
		}

		const email = await PostalMime.parse(message.source, {
			// https://postal-mime.postalsys.com/docs/getting-started/configuration#security-recommendations
			forceRfc822Attachments: true,
			maxHeadersSize: 524288,
			maxNestingDepth: 50,
		});

		return {
			imap: { ...message },
			// https://postal-mime.postalsys.com/docs/examples/basic-parsing#complete-email-parser-function
			source: {
				...email,
				subject: getSubject(email.subject),
				date: email.date ? new Date(email.date) : null,
			},
		};
	}

	public async addMessageFlags(parameters: z.infer<typeof setMessageFlagsSchema>) {
		const { flags, inbox, messageId } = setMessageFlagsSchema.parse(parameters);
		using _ = await this.getMailbox(inbox);

		return await this.client.messageFlagsAdd(messageId, [...flags], { uid: true });
	}

	public async [Symbol.asyncDispose]() {
		this.client.usable ? await this.client.logout() : this.client.close();
	}
}
