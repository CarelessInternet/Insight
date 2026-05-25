import { mergeForm, useForm } from '@tanstack/react-form';
import {
	createServerValidate,
	formOptions,
	initialFormState,
	ServerValidateError,
	useTransform,
} from '@tanstack/react-form-start';
import { useQueryClient } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { CircleX, Eraser, MailPlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import z from 'zod';
import { Button } from '~/components/ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { handleInteractOutside } from '~/components/ui/sonner';
import { Spinner } from '~/components/ui/spinner';
import { encrypt, hash } from '~/lib/crypto.server';
import { database } from '~/lib/database/drizzle.server';
import { emailAccount } from '~/lib/database/schema';
import { type EmailInsertSchema, emailInsertSchema } from '~/lib/email';
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
import { emailAccountsOptions } from './-email.table';

const accountOptions = formOptions({
	defaultValues: {
		label: '',
		hostname: '',
		email: '',
		password: '',
	} satisfies EmailInsertSchema,
});

const serverValidate = createServerValidate({
	...accountOptions,
	onServerValidate: emailInsertSchema,
});

export const handleForm = createServerFn({ method: 'POST' })
	.middleware([sessionMiddleware])
	.inputValidator(z.instanceof(FormData))
	.handler(async ({ context, data: formData }) => {
		try {
			const { label, ...data } = (await serverValidate(formData)) as EmailInsertSchema;
			const userId = context.user.id;
			const emailLookup = await hash(data.email);
			const email = await database.query.emailAccount.findFirst({
				where: (field, { and, eq }) => and(eq(field.userId, userId), eq(field.emailLookup, emailLookup)),
			});

			if (email) {
				return formResponse({ message: 'This email already exists on your account.', success: false });
			}

			await using imapEmail = new Email(data);
			await imapEmail.connect();

			if (!imapEmail.authenticated) {
				return formResponse({
					message: 'Email account authentication failed. Are the credentials and hostname correct?',
					success: false,
				});
			}

			await database.insert(emailAccount).values({
				email: await encrypt(data.email),
				emailLookup: await hash(data.email),
				hostname: await encrypt(data.hostname),
				label,
				password: await encrypt(data.password),
				status: 'valid',
				userId,
			});

			logger.info('Email account added by user:%s', userId);
			return formResponse({ message: 'Email account successfully added!', success: true });
		} catch (err) {
			if (err instanceof ServerValidateError) {
				return err.response;
			}

			logger.error('Internal error while adding an email account\n%s', err);
			return formResponse({ message: 'There was an internal error.', success: false });
		}
	});

export default function AddEmailAccount() {
	const queryClient = useQueryClient();
	// biome-ignore lint/style/noNonNullAssertion: useRef.
	const ref = useRef<HTMLFormElement>(null!);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [state, setState] = useState<FormDataServer>(initialFormState);
	const form = useForm({
		...accountOptions,
		validators: {
			onSubmit: emailInsertSchema,
			onChange: emailInsertSchema,
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
					queryClient.invalidateQueries({ queryKey: [emailAccountsOptions().queryKey.at(0)] });
					toast.dismiss();
					toast.success(response.message);
					setDialogOpen(false);
					formApi.reset();
				} else {
					toast.error(response.message, { closeButton: true, duration: Infinity });
				}
			}
		},
	});

	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<DialogTrigger asChild>
				<Button>
					<MailPlus />
					Add Email
				</Button>
			</DialogTrigger>
			<DialogContent onInteractOutside={handleInteractOutside} className="sm:max-w-lg">
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
						<DialogTitle>Add Email Account</DialogTitle>
						<DialogDescription>Add an email account to your Insight account.</DialogDescription>
					</DialogHeader>
					<FieldGroup>
						<form.Field name="label">
							{(field) => {
								const isInvalid = isInvalidField(field);

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Label</FieldLabel>
										<FieldDescription>You may choose a custom account name.</FieldDescription>
										<Input
											id={field.name}
											type="text"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="My Email Account"
										/>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						</form.Field>
						<form.Field name="hostname">
							{(field) => {
								const isInvalid = isInvalidField(field);

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>
											Hostname <span className="text-destructive">*</span>
										</FieldLabel>
										<Input
											id={field.name}
											type="text"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="mail.example.com"
											required
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
										<FieldLabel htmlFor={field.name}>
											Email Address <span className="text-destructive">*</span>
										</FieldLabel>
										<Input
											id={field.name}
											type="email"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="postmaster@example.com"
											required
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
										<FieldLabel htmlFor={field.name}>
											Password <span className="text-destructive">*</span>
										</FieldLabel>
										<Input
											id={field.name}
											type="password"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											required
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
									{isSubmitting ? <Spinner /> : <MailPlus />}
									Add Account
								</Button>
							)}
						</form.Subscribe>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
