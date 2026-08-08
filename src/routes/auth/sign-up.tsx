import { mergeForm, useForm } from '@tanstack/react-form';
import { useTransform } from '@tanstack/react-form-start';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';
import { Image } from '@unpic/react';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import z from 'zod';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Spinner } from '~/components/ui/spinner';
import authClient from '~/lib/authentication/client';
import { toContext } from '~/lib/authentication/passkeyContext';
import auth from '~/lib/authentication/server';
import { createPasskeyContext, passkeyContextPayloadTTL } from '~/lib/crypto.server';
import { getFormDataFromServer, isInvalidField, listeners } from '~/lib/forms';
import logger from '~/lib/logger.server';

export const Route = createFileRoute('/auth/sign-up')({
	component: RouteComponent,
	loader: async () => await getFormDataFromServer(),
});

const signUpServerSchema = z.object({
	username: z.string().nonempty().max(100),
	email: z.email().nonempty(),
});

const signUpClientSchema = signUpServerSchema.extend({
	passkeyName: z.string(),
});

const passkeyServerSignUp = createServerFn({ method: 'POST' })
	.validator(signUpServerSchema)
	.handler(async ({ data }) => {
		const { payload, token } = await createPasskeyContext(data);
		await auth.options.secondaryStorage.set(toContext(payload.nonce), '1', passkeyContextPayloadTTL);

		logger.verbose('A passkey context token was generated');
		return token;
	});

function RouteComponent() {
	const state = Route.useLoaderData();
	const [error, setError] = useState<string | null>();
	const navigate = Route.useNavigate();

	const passkeySignUp = useServerFn(passkeyServerSignUp);
	const form = useForm({
		defaultValues: {
			username: '',
			email: '',
			passkeyName: '',
		} satisfies z.infer<typeof signUpClientSchema>,
		validators: {
			onChange: signUpClientSchema,
			onSubmit: signUpClientSchema,
		},
		listeners,
		transform: useTransform((baseForm) => mergeForm(baseForm, state), [state]),
		onSubmit: async ({ value: { email, passkeyName, username } }) => {
			try {
				setError(null);

				const context = await passkeySignUp({ data: { email, username } });
				const { error } = await authClient.passkey.addPasskey({
					context,
					createSession: true,
					name: passkeyName,
				});

				if (error) {
					setError(error?.message ?? error.statusText);
				} else {
					navigate({ to: '/inbox' });
				}
			} catch (err) {
				setError(Error.isError(err) ? err.message : 'An error occurred while creating the account/passkey.');
			}
		},
	});

	return (
		<main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 md:p-10">
			<div className="flex w-full max-w-md flex-col gap-6">
				<Route.Link to="/" className="flex items-center gap-2 self-center font-medium text-2xl">
					<div className="flex size-8 items-center justify-center rounded-md">
						<Image src="/insight.png" width={32} height={32} alt="Insight logo" />
					</div>
					Insight
				</Route.Link>
				<div className="flex flex-col gap-6">
					<Card>
						<CardHeader className="text-center">
							<CardTitle className="text-xl">Create Your Insight Account</CardTitle>
							<CardDescription>Enter your details below to create your account.</CardDescription>
						</CardHeader>
						<CardContent>
							<form
								onSubmit={(event) => {
									event.preventDefault();
									event.stopPropagation();
									void form.handleSubmit();
								}}
								method="post"
								encType="multipart/form-data"
							>
								{error && <p className="mb-6 text-center font-bold text-destructive">{error}</p>}
								<FieldGroup>
									<form.Field name="username">
										{(field) => {
											const isInvalid = isInvalidField(field);

											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor={field.name}>
														Display Name <span className="text-destructive">*</span>
													</FieldLabel>
													<Input
														id={field.name}
														type="text"
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														aria-invalid={isInvalid}
														placeholder="John Doe"
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
														Email <span className="text-destructive">*</span>
													</FieldLabel>
													<Input
														id={field.name}
														type="email"
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														aria-invalid={isInvalid}
														placeholder="john@doe.com"
														required
													/>
													{isInvalid && <FieldError errors={field.state.meta.errors} />}
												</Field>
											);
										}}
									</form.Field>
									<form.Field name="passkeyName">
										{(field) => {
											const isInvalid = isInvalidField(field);

											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor={field.name}>Passkey Name</FieldLabel>
													<FieldDescription>
														Leave the passkey name empty to use the default name by your authenticator of choice.
													</FieldDescription>
													<Input
														id={field.name}
														type="text"
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														aria-invalid={isInvalid}
														placeholder="Insight Passkey"
													/>
													{isInvalid && <FieldError errors={field.state.meta.errors} />}
												</Field>
											);
										}}
									</form.Field>
									<Field>
										<form.Subscribe selector={(formState) => [formState.canSubmit, formState.isSubmitting]}>
											{([canSubmit, isSubmitting]) => (
												<Button type="submit" disabled={!canSubmit}>
													{isSubmitting ? <Spinner data-icon="inline-start" /> : <UserPlus data-icon="inline-start" />}
													Create Account
												</Button>
											)}
										</form.Subscribe>
										<FieldDescription className="text-center">
											Already have an account? <Route.Link to="/auth/sign-in">Sign in</Route.Link>
										</FieldDescription>
									</Field>
								</FieldGroup>
							</form>
						</CardContent>
					</Card>
				</div>
			</div>
		</main>
	);
}
