import { NextResponse } from 'next/server';
import { revokeToken } from '@/lib/oidc-client';
import { clearTokens, getTokens } from '@/lib/token-storage';

/**
 * POST /api/auth/revoke
 *
 * Revokes tokens using RFC 7009 Token Revocation endpoint.
 *
 * Request body:
 * - token: string (required) - The token to revoke
 * - token_type_hint?: 'access_token' | 'refresh_token' - Hint about token type
 * - clear_local?: boolean - Whether to also clear local token storage
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, token_type_hint, clear_local } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Revoke the token on the OIDC provider
    await revokeToken(token, token_type_hint);

    // Optionally clear local token storage
    if (clear_local) {
      await clearTokens();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Revocation error:', error);
    return NextResponse.json(
      { error: 'Token revocation failed' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/auth/revoke
 *
 * Revokes all tokens (access + refresh) and clears local storage.
 * Convenience endpoint for full logout with token revocation.
 */
export async function DELETE() {
  try {
    const tokens = await getTokens();

    if (!tokens) {
      return NextResponse.json({ error: 'No tokens found' }, { status: 400 });
    }

    // Revoke access token
    await revokeToken(tokens.access_token, 'access_token');

    // Revoke refresh token if present
    if (tokens.refresh_token) {
      await revokeToken(tokens.refresh_token, 'refresh_token');
    }

    // Clear local token storage
    await clearTokens();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Full revocation error:', error);
    return NextResponse.json(
      { error: 'Token revocation failed' },
      { status: 500 },
    );
  }
}
