import { cookies } from 'next/headers';
import type { AuthState, TokenResponse } from '#example-next-basic/types/oidc';
import { assertTokenResponse } from './validators';

const TOKEN_COOKIE_NAME = 'oidc_tokens';
const STATE_COOKIE_NAME = 'oidc_state';

/**
 * Get tokens from cookie
 */
export async function getTokens(): Promise<TokenResponse | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);

  if (!tokenCookie) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(tokenCookie.value);
    assertTokenResponse(parsed);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Clear tokens from cookie
 */
export async function clearTokens(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE_NAME);
}

/**
 * Save auth state (state, code_verifier, nonce) for PKCE flow
 */
export async function saveAuthState(authState: AuthState): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, JSON.stringify(authState), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });
}
