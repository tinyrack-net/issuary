import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/oidc-client';
import type { AuthState } from '@/types/oidc';

const STATE_COOKIE_NAME = 'oidc_state';
const TOKEN_COOKIE_NAME = 'oidc_tokens';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Check for error response
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/error?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || 'Unknown error')}`,
        request.url,
      ),
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      new URL(
        `/error?error=invalid_request&description=${encodeURIComponent('Missing code or state parameter')}`,
        request.url,
      ),
    );
  }

  // Get and verify auth state
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE_NAME);

  if (!stateCookie) {
    return NextResponse.redirect(
      new URL(
        `/error?error=invalid_state&description=${encodeURIComponent('No state found in cookie')}`,
        request.url,
      ),
    );
  }

  let authState: AuthState;
  try {
    authState = JSON.parse(stateCookie.value) as AuthState;
  } catch {
    return NextResponse.redirect(
      new URL(
        `/error?error=invalid_state&description=${encodeURIComponent('Failed to parse state cookie')}`,
        request.url,
      ),
    );
  }

  // Verify state matches
  if (authState.state !== state) {
    return NextResponse.redirect(
      new URL(
        `/error?error=state_mismatch&description=${encodeURIComponent('State parameter mismatch - possible CSRF attack')}`,
        request.url,
      ),
    );
  }

  // Clear state cookie immediately after verification
  cookieStore.delete(STATE_COOKIE_NAME);

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, authState.code_verifier);

    // Save tokens in httpOnly cookie
    cookieStore.set(TOKEN_COOKIE_NAME, JSON.stringify(tokens), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: MAX_AGE,
      path: '/',
    });

    // Redirect to profile page
    return NextResponse.redirect(new URL('/profile', request.url));
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.redirect(
      new URL(
        `/error?error=token_exchange_failed&description=${encodeURIComponent(errorMessage)}`,
        request.url,
      ),
    );
  }
}
