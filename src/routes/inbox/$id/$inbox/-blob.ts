import type { Attachment } from 'postal-mime';
import { useEffect, useState } from 'react';
import { getAttachmentBytes } from '~/lib/email';

// https://postal-mime.postalsys.com/docs/examples/email-viewer/#react-email-viewer-component
export function downloadAttachment(url: string, name: string) {
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	a.click();
}

export function useEmailAttachments(attachments: Attachment[] = []) {
	const [files, setFiles] = useState<Array<Attachment & { blobUrl: string }>>([]);

	useEffect(() => {
		const nextFiles = attachments.map((attachment) => ({
			...attachment,
			blobUrl: URL.createObjectURL(new Blob([getAttachmentBytes(attachment.content)], { type: attachment.mimeType })),
		}));

		setFiles(nextFiles);

		return () => {
			for (const { blobUrl } of nextFiles) {
				URL.revokeObjectURL(blobUrl);
			}
		};
	}, [attachments]);

	return files;
}
