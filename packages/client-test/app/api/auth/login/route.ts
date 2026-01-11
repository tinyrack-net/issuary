import { redirect } from 'next/navigation';
import { buildAuthorizationUrl } from '@/lib/oidc-client';
import { generateNonce, generatePKCEPair, generateState } from '@/lib/pkce';
import { saveAuthState } from '@/lib/token-storage';

export async function GET() {
  // Generate PKCE pair, state, and nonce
  const { code_verifier, code_challenge } = await generatePKCEPair();
  const state = generateState();
  const nonce = generateNonce();

  // Save state for verification in callback
  await saveAuthState({ state, code_verifier, nonce });

  // Build authorization URL
  const authUrl = buildAuthorizationUrl(state, code_challenge, nonce);

  // Redirect to authorization endpoint
  redirect(authUrl);
}
