import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/react';

export const authenticationClient = createAuthClient({ plugins: [passkeyClient()] });
