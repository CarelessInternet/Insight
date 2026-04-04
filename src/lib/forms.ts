import type { AnyFieldApi } from '@tanstack/react-form';
import { getFormData } from '@tanstack/react-form-start';
import { createServerFn } from '@tanstack/react-start';
import z from 'zod';

export const listeners = {
	onChange({ fieldApi }: { fieldApi: AnyFieldApi }) {
		if (fieldApi.state.meta.errorMap.onServer) {
			fieldApi.setErrorMap({
				...fieldApi.state.meta.errorMap,
				onServer: undefined,
			});
		}
	},
} as const;

export function isInvalidField(field: AnyFieldApi) {
	const { errorMap, isBlurred } = field.state.meta;
	const { submissionAttempts } = field.form.state;
	const { onServer, ...clientErrors } = errorMap;

	const hasClientError = (submissionAttempts > 0 || isBlurred) && Object.values(clientErrors).some(Boolean);
	const hasServerError = !!onServer;

	return hasClientError || hasServerError;
}

export const getFormDataFromServer = createServerFn({ method: 'GET' }).handler(async () => {
	return await getFormData();
});

export type FormDataServer = Awaited<ReturnType<typeof getFormDataFromServer>>;

const formResponseSchema = z.object({
	message: z.string(),
	success: z.boolean(),
});

export function formResponse(response: z.infer<typeof formResponseSchema>) {
	return formResponseSchema.parse(response);
}

export function isFormResponse(response: unknown): response is z.infer<typeof formResponseSchema> {
	return !formResponseSchema.safeParse(response).error;
}
