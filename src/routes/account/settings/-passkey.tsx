import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import authClient from '~/lib/authentication/client';

const Route = getRouteApi('/account/settings/');

export default function PasskeySetting() {
	const passkeys = Route.useLoaderData();
	const [disabled, setDisabled] = useState(passkeys.length > 0);

	return (
		<Button
			onClick={async () => {
				const { error } = await authClient.passkey.addPasskey({
					name: 'Insight Passkey',
					authenticatorAttachment: 'cross-platform',
				});

				if (!error) {
					setDisabled(true);
				}
			}}
			disabled={disabled}
		>
			Add Passkey ({passkeys?.length ?? '?'})
		</Button>
	);
}
