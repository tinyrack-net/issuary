import type { AuthState, TokenResponse } from '@/types/oidc';
import { assertAuthState, assertTokenResponse } from './validators';

const TOKEN_STORAGE_KEY = 'oidc_tokens';
const AUTH_STATE_KEY = 'oidc_auth_state';

/**
 * Save tokens to localStorage
 */
export function saveTokens(tokens: TokenResponse): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

/**
 * Get tokens from localStorage
 */
export function getTokens(): TokenResponse | null {
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    assertTokenResponse(parsed);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Clear tokens from localStorage
 */
export function clearTokens(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Save auth state (state, code_verifier, nonce) for PKCE flow
 * Uses sessionStorage for security (cleared when tab closes)
 */
export function saveAuthState(authState: AuthState): void {
  sessionStorage.setItem(AUTH_STATE_KEY, JSON.stringify(authState));
}

/**
 * Get auth state from sessionStorage
 */
export function getAuthState(): AuthState | null {
  const stored = sessionStorage.getItem(AUTH_STATE_KEY);
  if (!stored) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    assertAuthState(parsed);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Clear auth state from sessionStorage
 */
export function clearAuthState(): void {
  sessionStorage.removeItem(AUTH_STATE_KEY);
}
