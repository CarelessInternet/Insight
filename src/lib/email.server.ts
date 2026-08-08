import { Readable } from 'node:stream';
import { ImapFlow, type SearchObject } from 'imapflow';
import PostalMime from 'postal-mime';
import z from 'zod';
import { decrypt } from './crypto.server';
import {
	type EmailCredentialsSchema,
	inbox as emailInbox,
	findAttachments,
	getMessageSchema,
	getSubject,
	messageFlagColoursSchema,
	moveMessageSchema,
	paginatedEmailMessagesSchema,
	type searchMessageFilters,
	setMessageFlagsSchema,
} from './email';
import logger from './logger.server';
import type { PaginatedQueryResult } from './query';

const getAttachmentSchema = getMessageSchema.extend({ part: z.string() });

// TODO: rewrite to allow for a cache of IMAP connections. May change from class to function.
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
		return await this.client.listTree({ statusQuery: { unseen: true } });
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

		const message = await this.client.fetchOne(
			messageId,
			{ bodyStructure: true, flags: true, source: true },
			{ uid: true },
		);

		// biome-ignore lint/complexity/useOptionalChain: Optional chaining does not work on type false.
		if (!message || !message.bodyStructure || !message.source) {
			return null;
		}

		const email = await PostalMime.parse(message.source, {
			// https://postal-mime.postalsys.com/docs/getting-started/configuration#security-recommendations
			attachmentEncoding: 'arraybuffer',
			forceRfc822Attachments: true,
			maxHeadersSize: 524288,
			maxNestingDepth: 50,
		});

		return {
			flags: message.flags,
			// https://postal-mime.postalsys.com/docs/examples/basic-parsing#complete-email-parser-function
			source: {
				...email,
				attachments: findAttachments(message.bodyStructure),
				date: email.date ? new Date(email.date) : undefined,
				subject: getSubject(email.subject),
			},
			uid: message.uid,
		};
	}

	public async getMessageSource(parameters: z.infer<typeof getMessageSchema>) {
		const { inbox, messageId } = getMessageSchema.parse(parameters);
		using _ = await this.getMailbox(inbox);

		const message = await this.client.fetchOne(messageId, { source: true }, { uid: true });

		return message ? message.source : null;
	}

	public async getMessageAttachment(parameters: z.infer<typeof getAttachmentSchema>) {
		const { inbox, messageId, part } = getAttachmentSchema.parse(parameters);
		using _ = await this.getMailbox(inbox);

		const attachment = await this.client.download(messageId, part, { uid: true });

		return attachment ? { blob: await Readable.toWeb(attachment.content).blob(), meta: attachment.meta } : null;
	}

	public async addMessageFlags(parameters: z.infer<typeof setMessageFlagsSchema>) {
		const { flags, inbox, messageId } = setMessageFlagsSchema.parse(parameters);
		using _ = await this.getMailbox(inbox);

		return await this.client.messageFlagsAdd(messageId, [...flags], { uid: true });
	}

	public async removeMessageFlags(parameters: z.infer<typeof setMessageFlagsSchema>) {
		const { flags, inbox, messageId } = setMessageFlagsSchema.parse(parameters);
		using _ = await this.getMailbox(inbox);

		return await this.client.messageFlagsRemove(messageId, [...flags], { uid: true });
	}

	public async setMessageFlagColour(parameters: z.infer<typeof messageFlagColoursSchema>) {
		const { colour, inbox, messageId } = messageFlagColoursSchema.parse(parameters);
		using _ = await this.getMailbox(inbox);

		return await this.client.setFlagColor(messageId, colour ?? '', { uid: true });
	}

	public async moveMessage(parameters: z.infer<typeof moveMessageSchema>) {
		const { inbox, messageId, path } = moveMessageSchema.parse(parameters);
		using _ = await this.getMailbox(inbox);

		return await this.client.messageMove(messageId, path, { uid: true });
	}

	public async [Symbol.asyncDispose]() {
		this.client.usable ? await this.client.logout() : this.client.close();
	}
}
