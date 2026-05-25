import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/react';

const authClient = createAuthClient({ plugins: [passkeyClient()] });

export default authClient;
