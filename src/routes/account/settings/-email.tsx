import { mergeForm, useForm } from '@tanstack/react-form';
import {
	createServerValidate,
	formOptions,
	initialFormState,
	ServerValidateError,
	useTransform,
} from '@tanstack/react-form-start';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { CircleX, Eraser, LoaderCircle, MailPlus } from 'lucide-react';
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
import { Field, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { handleInteractOutside } from '~/components/ui/sonner';
import { sessionMiddleware } from '~/lib/authentication/middleware';
import { encrypt } from '~/lib/crypto';
import { database } from '~/lib/database/drizzle';
import { emailAccount } from '~/lib/database/schema';
import {
	type FormDataServer,
	formResponse,
	getFormDataFromServer,
	isFormResponse,
	isInvalidField,
	listeners,
} from '~/lib/forms';
import logger from '~/lib/logger.server';
import { emailAccountsOptions } from './-email.table';

const schema = z.object({
	hostname: z.hostname().nonempty(),
	email: z.email().nonempty(),
	password: z.string().nonempty(),
});

const accountOptions = formOptions({
	defaultValues: {
		hostname: '',
		email: '',
		password: '',
	} satisfies z.infer<typeof schema>,
});

const serverValidate = createServerValidate({
	...accountOptions,
	onServerValidate: schema,
});

export const handleForm = createServerFn({ method: 'POST' })
	.middleware([sessionMiddleware])
	.inputValidator(z.instanceof(FormData))
	.handler(async (ctx) => {
		try {
			const { password, ...data } = (await serverValidate(ctx.data)) as z.infer<typeof schema>;
			const userId = ctx.context.user.id;
			const [email] = await database
				.select()
				.from(emailAccount)
				.where(and(eq(emailAccount.userId, userId), eq(emailAccount.email, data.email)));

			if (email) {
				return formResponse({ message: 'This email already exists on your account.', success: false });
			}

			await database.insert(emailAccount).values({
				...data,
				password: await encrypt({ data: password }),
				userId,
			});

			logger.info('Email account added by user:%s', userId);
			return formResponse({ message: 'Email account successfully added!', success: true });
		} catch (err) {
			if (err instanceof ServerValidateError) {
				return err.response;
			}

			logger.error('Internal error while adding an email account:', err);
			return formResponse({ message: 'There was an internal error.', success: false });
		}
	});

export default function Email() {
	const queryClient = useQueryClient();
	const { data: accounts } = useSuspenseQuery(emailAccountsOptions);
	// biome-ignore lint/style/noNonNullAssertion: useRef.
	const ref = useRef<HTMLFormElement>(null!);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [state, setState] = useState<FormDataServer>(initialFormState);
	const form = useForm({
		...accountOptions,
		validators: {
			onSubmit: schema,
			onChange: schema,
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
					setDialogOpen(false);
					toast.success(response.message);
					formApi.reset();
					queryClient.invalidateQueries({ queryKey: emailAccountsOptions.queryKey });
				} else {
					toast.error(response.message, { closeButton: true, duration: Infinity });
				}
			}
		},
	});

	return (
		<div>
			{accounts.map((account) => (
				<pre key={account.id}>{JSON.stringify(account)}</pre>
			))}

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogTrigger asChild>
					<Button variant="outline">Add Email</Button>
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
							<form.Field
								name="hostname"
								children={(field) => {
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
							></form.Field>
							<form.Field
								name="email"
								children={(field) => {
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
							></form.Field>
							<form.Field
								name="password"
								children={(field) => {
									const isInvalid = isInvalidField(field);

									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Password</FieldLabel>
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
							></form.Field>
						</FieldGroup>
						<DialogFooter>
							<DialogClose asChild>
								<Button variant="outline">
									<CircleX />
									Cancel
								</Button>
							</DialogClose>
							<Button type="button" variant="destructive" onClick={() => form.reset()}>
								<Eraser />
								Reset
							</Button>
							<form.Subscribe selector={(formState) => [formState.canSubmit, formState.isSubmitting]}>
								{([canSubmit, isSubmitting]) => (
									<Button type="submit" disabled={!canSubmit} aria-disabled={!canSubmit}>
										<MailPlus />
										{isSubmitting && <LoaderCircle className="mr-2 size-4 animate-spin" />}
										{isSubmitting ? '...' : 'Add Account'}
									</Button>
								)}
							</form.Subscribe>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
