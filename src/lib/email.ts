import type { MessageEnvelopeObject, MessageStructureObject } from 'imapflow';
import { addHook, type ElementHook, removeHook, sanitize, type UponSanitizeAttributeHook } from 'isomorphic-dompurify';
import type { Address, Attachment } from 'postal-mime';
import z from 'zod';
import { emailAccountInsertSchema, type emailAccountSelectSchema } from './database/schema';
import type { ValueOf } from './utils';

export const emailInsertSchema = emailAccountInsertSchema
	.pick({
		hostname: true,
		email: true,
		label: true,
		password: true,
	})
	.extend({ label: emailAccountInsertSchema.shape.label.unwrap().unwrap() });
export const emailCredentialsSchema = emailInsertSchema.omit({ label: true });

export type EmailInsertSchema = z.infer<typeof emailInsertSchema>;
export type EmailCredentialsSchema = z.infer<typeof emailCredentialsSchema>;
export type EmailId = z.infer<typeof emailAccountSelectSchema>['id'];

export const inbox = z.string();
export const messageId = z.number();

export const getMessageSchema = z.object({ inbox, messageId });
export type GetMessageSchema = z.infer<typeof getMessageSchema>;

export const searchMessageSchema = z.object({
	value: z.string(),
	filterBy: z.enum(['from', 'subject', 'content']).default('subject'),
});
export type SearchMessageSchema = z.infer<typeof searchMessageSchema>;
export const searchMessageFilters = searchMessageSchema.shape.filterBy.unwrap().enum;

export const paginatedEmailMessagesSchema = z.object({
	inbox,
	page: z.number().gte(1).default(1),
	rowsPerPage: z.literal([5, 10, 25, 50, 100]).default(25),
	search: searchMessageSchema.optional(),
	seen: z.boolean().default(true),
	sortBy: z.enum(['ascending', 'descending']).default('descending'),
});

export const messageFlags = z.enum({
	Seen: '\\Seen',
	Flagged: '\\Flagged',
});
export const messageFlagsSet = z.set(messageFlags);
export type MessageFlagsValues = ValueOf<typeof messageFlags.enum>;

export const setMessageFlagsSchema = getMessageSchema.extend({
	flags: messageFlagsSet,
});

// https://www.ietf.org/archive/id/draft-eggert-mailflagcolors-00.html#name-definition-of-the-mailflagb
export const messageFlagColours = z.enum({
	Red: 'red',
	Orange: 'orange',
	Yellow: 'yellow',
	Green: 'green',
	Blue: 'blue',
	Purple: 'purple',
	// Grey, not gray: https://imapflow.com/docs/api/imapflow-client/#setflagcolorrange-color-options
	Grey: 'grey',
});
export type MessageFlagColoursValues = ValueOf<typeof messageFlagColours.enum>;

export const messageFlagColoursSchema = getMessageSchema.extend({
	colour: messageFlagColours.optional(),
});

export const moveMessageSchema = getMessageSchema.extend({ path: z.string() });

export function getSubject(subject: string | undefined) {
	return subject || '(no subject)';
}

export function getSenderInfo(address: MessageEnvelopeObject['from'] | Address) {
	const from = Array.isArray(address) ? address : [address];

	const rawInitials =
		from
			?.at(0)
			?.name?.split(' ')
			.map((name) => name.at(0))
			.join('') || from?.at(0)?.address?.at(0);

	return {
		initials: rawInitials?.toWellFormed().slice(0, 2),
		from: from?.map((sender) => sender?.name || sender?.address).join(', '),
	};
}

export function getAttachmentBytes(content: Attachment['content']) {
	return typeof content === 'string' ? Uint8Array.fromBase64(content) : new Uint8Array(content);
}

export interface MessageBodyAttachment {
	contentId?: string;
	filename?: string;
	inline: boolean;
	part: string;
	size?: number;
	type: string;
}

// https://imapflow.com/docs/examples/fetching-messages/#fetch-recent-messages-with-attachments
// Note: ImapFlow stores Content-Type as a single string like "text/plain"
// or "multipart/mixed" in node.type — there is no separate `subtype` field.
export function findAttachments(node: MessageStructureObject): MessageBodyAttachment[] {
	const attachments: MessageBodyAttachment[] = [];
	const topType = (node.type || '').split('/').at(0);

	const isAttachment =
		['attachment', 'inline'].includes(node.disposition ?? '') ||
		(node.type && topType !== 'text' && topType !== 'multipart' && !node.disposition);

	if (isAttachment) {
		attachments.push({
			contentId: node.dispositionParameters?.contentId || node.id,
			filename: node.dispositionParameters?.filename || node.parameters?.name,
			inline: node.disposition === 'inline',
			part: node.part || '1',
			size: Number(node.dispositionParameters?.size) || node.size,
			type: node.type,
		} satisfies MessageBodyAttachment);
	}

	if (node.childNodes) {
		for (const child of node.childNodes) {
			attachments.push(...findAttachments(child));
		}
	}

	return attachments;
}

export function sanitizeMessageHtml(html: string | undefined, allowRemoteSrc: boolean) {
	if (!html) {
		return { messageHtml: '', sawRemoteSrc: false };
	}

	let sawRemoteSrc = false;

	// https://github.com/cure53/DOMPurify/tree/main/demos#hook-to-open-all-links-in-a-new-window-link
	// Add a hook to make all links open a new window.
	const afterSanitizeAttributes: ElementHook = (node) => {
		if ('target' in node) {
			node.setAttribute('target', '_blank');
		}

		if (!node.hasAttribute('target') && (node.hasAttribute('xlink:href') || node.hasAttribute('href'))) {
			node.setAttribute('xlink:show', 'new');
		}
	};

	const uponSanitizeAttribute: UponSanitizeAttributeHook = (_, { attrName }) => {
		if (attrName === 'src') {
			sawRemoteSrc = true;
		}
	};

	addHook('afterSanitizeAttributes', afterSanitizeAttributes);
	addHook('uponSanitizeAttribute', uponSanitizeAttribute);

	// https://postal-mime.postalsys.com/docs/guides/security#5-sanitize-html-content
	const iframe = sanitize(html, {
		FORBID_ATTR: allowRemoteSrc ? [] : ['src'],
		RETURN_DOM: true,
		WHOLE_DOCUMENT: true,
	}) as HTMLHtmlElement;

	// I really do not like doing this security-wise but it is necessary for a better experience.
	const script = iframe.ownerDocument.createElement('script');
	// https://iframe-resizer.com/setup/child/#usage
	script.src = '/node_modules/@iframe-resizer/child/index.umd.js';
	script.async = true;
	iframe.querySelector('head')?.appendChild(script);

	removeHook('afterSanitizeAttributes', afterSanitizeAttributes);
	removeHook('uponSanitizeAttribute', uponSanitizeAttribute);

	return { messageHtml: iframe.outerHTML, sawRemoteSrc };
}
