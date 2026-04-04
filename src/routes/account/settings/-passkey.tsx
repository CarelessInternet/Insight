import type { Passkey } from '@better-auth/passkey';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { authenticationClient } from '~/lib/authentication/client';

export default function PasskeySetting({ passkeys }: { passkeys: Passkey[] }) {
	const [disabled, setDisabled] = useState(passkeys.length > 0);

	return (
		<Button
			onClick={async () => {
				const { error } = await authenticationClient.passkey.addPasskey({
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
