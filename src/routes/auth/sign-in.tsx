import { mergeForm, useForm } from '@tanstack/react-form';
import { createServerValidate, ServerValidateError, useTransform } from '@tanstack/react-form-start';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { setResponseStatus } from '@tanstack/react-start/server';
import { Image } from '@unpic/react';
import { LoaderCircle, LogIn } from 'lucide-react';
import { useEffect, useRef } from 'react';
import z from 'zod';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { authenticationClient } from '~/lib/authentication/client';
import { auth } from '~/lib/authentication/server';
import { getFormDataFromServer, isInvalidField, listeners } from '~/lib/forms';
import logger from '~/lib/logger.server';
import { signInOptions, signInSchema } from './-form';

export const Route = createFileRoute('/auth/sign-in')({
	component: RouteComponent,
	loader: async () => await getFormDataFromServer(),
});

const serverValidate = createServerValidate({
	...signInOptions,
	onServerValidate: signInSchema,
});

export const handleForm = createServerFn({ method: 'POST' })
	.inputValidator(z.instanceof(FormData))
	.handler(async (ctx) => {
		try {
			const data = (await serverValidate(ctx.data)) as z.infer<typeof signInSchema>;
			const { user } = await auth.api.signInEmail({
				body: {
					email: data.email,
					password: data.password,
					rememberMe: true,
				},
			});

			logger.info('Signed in user%s via email and password', user.id);
			return redirect({ to: '/account/settings' });
		} catch (err) {
			if (err instanceof ServerValidateError) {
				return err.response;
			}

			logger.error('Internal error while signing in:', err);
			setResponseStatus(500);
		}
	});

function RouteComponent() {
	const state = Route.useLoaderData();
	const ref = useRef<HTMLFormElement>(null);
	const form = useForm({
		...signInOptions,
		validators: {
			onSubmit: signInSchema,
			onChange: signInSchema,
		},
		listeners,
		transform: useTransform((baseForm) => mergeForm(baseForm, state), [state]),
		onSubmit: () => ref.current?.submit(),
	});
	const navigate = useNavigate();

	useEffect(() => {
		if (!PublicKeyCredential.isConditionalMediationAvailable?.()) {
			return;
		}

		void authenticationClient.signIn.passkey({
			autoFill: true,
			fetchOptions: {
				onSuccess: () => {
					navigate({ to: '/account/settings' });
				},
			},
		});
	}, [navigate]);

	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
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
							<CardTitle className="text-xl">Sign In to Insight</CardTitle>
							<CardDescription>Enter your details below to log in to your account.</CardDescription>
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
								<FieldGroup>
									<form.Field
										name="email"
										children={(field) => {
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
														autoComplete="email webauthn"
														placeholder="john@doe.com"
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
														autoComplete="current-password webauthn"
													/>
													{isInvalid && <FieldError errors={field.state.meta.errors} />}
												</Field>
											);
										}}
									></form.Field>
									<Field>
										<form.Subscribe selector={(formState) => [formState.canSubmit, formState.isSubmitting]}>
											{([canSubmit, isSubmitting]) => (
												<Button type="submit" disabled={!canSubmit} aria-disabled={!canSubmit}>
													<LogIn />
													{isSubmitting && <LoaderCircle className="mr-2 size-4 animate-spin" />}
													{isSubmitting ? '...' : 'Sign In'}
												</Button>
											)}
										</form.Subscribe>
										<FieldDescription className="text-center">
											Don't have an account? <a href="/auth/sign-up">Sign Up</a>
										</FieldDescription>
									</Field>
								</FieldGroup>
							</form>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
