import { mergeForm, useForm } from '@tanstack/react-form';
import { createServerValidate, initialFormState, ServerValidateError, useTransform } from '@tanstack/react-form-start';
import { useQueryClient } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-zod';
import { CircleX, Eraser, PencilLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import z from 'zod';
import type DropdownDialog from '~/components/DropdownDialog';
import { Button } from '~/components/ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '~/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { handleInteractOutside } from '~/components/ui/sonner';
import { Spinner } from '~/components/ui/spinner';
import { decrypt, encrypt, hash } from '~/lib/crypto.server';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import Email from '~/lib/email.server';
import {
	type FormDataServer,
	formResponse,
	getFormDataFromServer,
	isFormResponse,
	isInvalidField,
	listeners,
} from '~/lib/forms';
import logger from '~/lib/logger.server';
import { sessionMiddleware } from '~/lib/middleware';
import { type EmailAccount, emailAccountQueryKey } from './-email.table';

const emailSchema = createSelectSchema(emailAccount, {
	hostname: z.hostname().nonempty(),
	email: z.email().nonempty(),
}).pick({ email: true, hostname: true, id: true, password: true });

type EmailSchema = z.infer<typeof emailSchema>;

const serverValidate = createServerValidate({ onServerValidate: emailSchema });

const handleForm = createServerFn({ method: 'POST' })
	.middleware([sessionMiddleware])
	.inputValidator(z.instanceof(FormData))
	.handler(async (ctx) => {
		try {
			const data = (await serverValidate(ctx.data)) as EmailSchema;
			const userId = ctx.context.user.id;
			const currentEmail = await database.query.emailAccount.findFirst({
				where: (field, { and, eq }) => and(eq(field.id, data.id), eq(field.userId, userId)),
			});

			if (!currentEmail) {
				return formResponse({ message: 'The email account could not be found on your account.', success: false });
			}

			const newDecryptedCredentials = {
				email: data.email,
				hostname: data.hostname,
				password: data.password || (await decrypt(currentEmail.password)),
			} as const;
			await using imapEmail = new Email(newDecryptedCredentials);
			await imapEmail.connect();

			if (!imapEmail.authenticated) {
				return formResponse({
					message: 'Email account authentication failed. Are the credentials and hostname correct?',
					success: false,
				});
			}

			const [email] = await database
				.update(emailAccount)
				.set({
					email: await encrypt(data.email),
					emailLookup: await hash(data.email),
					hostname: await encrypt(data.hostname),
					password: data.password ? await encrypt(data.password) : currentEmail.password,
					status: 'valid',
				})
				.where(and(eq(emailAccount.userId, userId), eq(emailAccount.id, data.id)))
				.returning();

			logger.info('Email:%s account updated by user:%s', email?.id, email?.userId);
			return formResponse({ message: 'Email account successfully modified!', success: true });
		} catch (err) {
			if (err instanceof ServerValidateError) {
				return err.response;
			}

			logger.error('Internal error while updating an email account\n%s', err);
			return formResponse({ message: 'There was an internal error.', success: false });
		}
	});

export default function EmailEdit(properties: DropdownDialog<EmailAccount, true>) {
	if (!properties.row) {
		return null;
	}

	return <Component {...(properties as unknown as DropdownDialog<EmailAccount>)} />;
}

function Component({ open, row, setOpen }: DropdownDialog<EmailAccount>) {
	const queryClient = useQueryClient();
	// biome-ignore lint/style/noNonNullAssertion: useRef.
	const ref = useRef<HTMLFormElement>(null!);
	const [state, setState] = useState<FormDataServer>(initialFormState);
	const form = useForm({
		defaultValues: {
			id: row.id,
			email: row.email,
			hostname: row.hostname,
			password: '',
		} satisfies EmailSchema,
		validators: {
			onSubmit: emailSchema,
			onChange: emailSchema,
		},
		listeners,
		transform: useTransform((baseForm) => mergeForm(baseForm, state), [state]),
		onSubmit: async ({ formApi }) => {
			const data = new FormData(ref.current);
			const response = await handleForm({ data });
			const formState = await getFormDataFromServer();
			setState(formState);

			if (isFormResponse(response)) {
				if (response.success) {
					queryClient.invalidateQueries({ queryKey: [emailAccountQueryKey] });
					toast.dismiss();
					toast.success(response.message);
					setOpen(false);
					formApi.reset();
				} else {
					toast.error(response.message, { closeButton: true, duration: Infinity });
				}
			}
		},
	});

	// Change the form values when the user selects a different table row from the original.
	useEffect(
		() =>
			form.reset({
				id: row.id,
				email: row.email,
				hostname: row.hostname,
				password: '',
			}),
		[form.reset, row.id, row.email, row.hostname],
	);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent
				onInteractOutside={handleInteractOutside}
				// Don't highlight the first form field.
				onOpenAutoFocus={(e) => e.preventDefault()}
				className="sm:max-w-lg"
			>
				<form
					ref={ref}
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					method="post"
					encType="multipart/form-data"
					className="contents"
				>
					<DialogHeader>
						<DialogTitle className="inline-block">
							Edit <p className="inline underline">{row.email}</p>
						</DialogTitle>
						<DialogDescription>Modify the credentials to the email account.</DialogDescription>
					</DialogHeader>
					<FieldGroup>
						<form.Field name="id">
							{(field) => <Input id={field.name} type="hidden" name={field.name} value={field.state.value} />}
						</form.Field>
						<form.Field name="hostname">
							{(field) => {
								const isInvalid = isInvalidField(field);

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Hostname</FieldLabel>
										<Input
											id={field.name}
											type="text"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="mail.example.com"
										/>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						</form.Field>
						<form.Field name="email">
							{(field) => {
								const isInvalid = isInvalidField(field);

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Email Address</FieldLabel>
										<Input
											id={field.name}
											type="email"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="postmaster@example.com"
										/>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						</form.Field>
						<form.Field name="password">
							{(field) => {
								const isInvalid = isInvalidField(field);

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Password</FieldLabel>
										<FieldDescription>Leave this field empty to keep the same password.</FieldDescription>
										<Input
											id={field.name}
											type="password"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
										/>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						</form.Field>
					</FieldGroup>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">
								<CircleX />
								Cancel
							</Button>
						</DialogClose>
						<Button type="reset" variant="destructive" onClick={() => form.reset()}>
							<Eraser />
							Reset
						</Button>
						<form.Subscribe selector={(formState) => [formState.canSubmit, formState.isSubmitting]}>
							{([canSubmit, isSubmitting]) => (
								<Button type="submit" disabled={!canSubmit} aria-disabled={!canSubmit}>
									{isSubmitting ? <Spinner /> : <PencilLine />}
									Edit Account
								</Button>
							)}
						</form.Subscribe>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
