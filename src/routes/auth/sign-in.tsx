import { useForm } from '@tanstack/react-form';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Image } from '@unpic/react';
import { UserKey } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Field, FieldDescription, FieldGroup } from '~/components/ui/field';
import { Spinner } from '~/components/ui/spinner';
import authClient from '~/lib/authentication/client';

export const Route = createFileRoute('/auth/sign-in')({
	component: RouteComponent,
});

function RouteComponent() {
	const [error, setError] = useState<string | null>(null);
	const navigate = Route.useNavigate();
	const router = useRouter();
	const form = useForm({
		onSubmit: async () => {
			setError(null);

			const hasPasskeyFunctionality = await PublicKeyCredential.isConditionalMediationAvailable?.();

			if (!hasPasskeyFunctionality) {
				return setError('Passkey functionality is missing.');
			}

			const { error } = await authClient.signIn.passkey();

			if (error) {
				setError(error.message ?? error.statusText);
			} else {
				router.invalidate({ filter: (match) => match.routeId === '__root__' });
				navigate({ to: '/inbox' });
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
					<Card className="min-h-48">
						<CardHeader className="text-center">
							<CardTitle className="text-xl">Authenticate to Insight</CardTitle>
							<CardDescription>Click the button below to sign in.</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-1 items-center">
							<form
								onSubmit={(e) => {
									e.preventDefault();
									e.stopPropagation();
									form.handleSubmit();
								}}
								className="contents"
							>
								<FieldGroup>
									{error && <p className="text-center font-bold text-destructive">{error}</p>}
									<Field>
										<form.Subscribe selector={(formState) => [formState.canSubmit, formState.isSubmitting]}>
											{([canSubmit, isSubmitting]) => (
												<Button type="submit" disabled={!canSubmit}>
													{isSubmitting ? <Spinner /> : <UserKey />}
													Sign In with Passkey
												</Button>
											)}
										</form.Subscribe>
										<FieldDescription className="text-center">
											Don't have an account? <Route.Link to="/auth/sign-up">Sign Up</Route.Link>
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
