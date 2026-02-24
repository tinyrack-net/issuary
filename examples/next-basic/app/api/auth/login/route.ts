import { redirect } from 'next/navigation';
import { buildAuthorizationUrl } from '#example-next-basic/lib/oidc-client';
import {
  generateNonce,
  generatePKCEPair,
  generateState,
} from '#example-next-basic/lib/pkce';
import { saveAuthState } from '#example-next-basic/lib/token-storage';

export async function GET() {
  // Generate PKCE pair, state, and nonce
  const { code_verifier, code_challenge } = await generatePKCEPair();
  const state = generateState();
  const nonce = generateNonce();

  // Save state for verification in callback
  await saveAuthState({ state, code_verifier, nonce });

  // Build authorization URL
  const authUrl = await buildAuthorizationUrl(state, code_challenge, nonce);

  // Redirect to authorization endpoint
  redirect(authUrl);
}
