import { mergeForm, useForm } from '@tanstack/react-form';
import { createServerValidate, ServerValidateError, useTransform } from '@tanstack/react-form-start';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Image } from '@unpic/react';
import { UserPlus } from 'lucide-react';
import { useRef, useState } from 'react';
import z from 'zod';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Spinner } from '~/components/ui/spinner';
import { auth } from '~/lib/authentication/server';
import { formResponse, getFormDataFromServer, isFormResponse, isInvalidField, listeners } from '~/lib/forms';
import logger from '~/lib/logger.server';
import { signUpOptions, signUpSchema } from './-form';

export const Route = createFileRoute('/auth/sign-up')({
	component: RouteComponent,
	loader: async () => await getFormDataFromServer(),
});

const serverValidate = createServerValidate({
	...signUpOptions,
	onServerValidate: signUpSchema,
});

export const handleForm = createServerFn({ method: 'POST' })
	.inputValidator(z.instanceof(FormData))
	.handler(async (ctx) => {
		try {
			const data = (await serverValidate(ctx.data)) as z.infer<typeof signUpSchema>;
			const { user } = await auth.api.signUpEmail({
				body: {
					email: data.email,
					name: data.username,
					password: data.password,
					rememberMe: true,
				},
			});

			logger.info('Created a new user:%s', user.id);
			return formResponse({ message: 'Succcessfully signed up!', success: true });
		} catch (err) {
			if (err instanceof ServerValidateError) {
				return err.response;
			}

			logger.error('Internal error while signing up: %s', err);
			return formResponse({
				message: err instanceof Error ? err.message : 'There was an internal error.',
				success: false,
			});
		}
	});

function RouteComponent() {
	const state = Route.useLoaderData();
	// biome-ignore lint/style/noNonNullAssertion: useRef.
	const ref = useRef<HTMLFormElement>(null!);
	const [error, setError] = useState('');
	const navigate = useNavigate();
	const form = useForm({
		...signUpOptions,
		validators: {
			onSubmit: signUpSchema,
			onChange: signUpSchema,
		},
		listeners,
		transform: useTransform((baseForm) => mergeForm(baseForm, state), [state]),
		onSubmit: async () => {
			const data = new FormData(ref.current);
			const response = await handleForm({ data });

			if (isFormResponse(response)) {
				if (response.success) {
					navigate({ to: '/account/settings' });
				} else {
					setError(response.message);
				}
			}
		},
	});

	return (
		<main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 md:p-10">
			<div className="flex w-full max-w-md flex-col gap-6">
				<a href="/" className="flex items-center gap-2 self-center font-medium text-2xl">
					<div className="flex size-8 items-center justify-center rounded-md">
						<Image src="/insight.png" width={32} height={32} alt="Insight logo" />
					</div>
					Insight
				</a>
				<div className="flex flex-col gap-6">
					<Card>
						<CardHeader className="text-center">
							<CardTitle className="text-xl">Create Your Insight Account</CardTitle>
							<CardDescription>Enter your details below to create your account.</CardDescription>
						</CardHeader>
						<CardContent>
							<form
								ref={ref}
								action={handleForm.url}
								onSubmit={(e) => {
									e.preventDefault();
									e.stopPropagation();
									form.handleSubmit();
								}}
								method="post"
								encType="multipart/form-data"
							>
								{error && <p className="mb-6 text-center text-destructive">{error}</p>}
								<FieldGroup>
									<form.Field name="username">
										{(field) => {
											const isInvalid = isInvalidField(field);

											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor={field.name}>Display Name</FieldLabel>
													<Input
														id={field.name}
														type="text"
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														aria-invalid={isInvalid}
														placeholder="John Doe"
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
													<FieldLabel htmlFor={field.name}>Email</FieldLabel>
													<Input
														id={field.name}
														type="email"
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														aria-invalid={isInvalid}
														placeholder="john@doe.com"
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
									<Field>
										<form.Subscribe selector={(formState) => [formState.canSubmit, formState.isSubmitting]}>
											{([canSubmit, isSubmitting]) => (
												<Button type="submit" disabled={!canSubmit} aria-disabled={!canSubmit}>
													{isSubmitting ? <Spinner /> : <UserPlus />}
													Create Account
												</Button>
											)}
										</form.Subscribe>
										<FieldDescription className="text-center">
											Already have an account? <a href="/auth/sign-in">Sign in</a>
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
