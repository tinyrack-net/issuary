import { vi } from 'vitest';

export interface OAuthMockTokens {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface OAuthMockUserInfo {
  id: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export interface OAuthProviderFetchMockOptions {
  tokenUrl: string;
  userInfoUrl: string;
  tokens?: Partial<OAuthMockTokens>;
  userInfo?: Partial<OAuthMockUserInfo>;
}

export interface OAuthProviderFetchMock {
  tokens: OAuthMockTokens;
  userInfo: OAuthMockUserInfo;
  restore: () => void;
}

function jsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function getRequestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function getAuthorizationHeader(
  input: string | URL | Request,
  init?: RequestInit,
): string | null {
  if (init?.headers) {
    return new Headers(init.headers).get('authorization');
  }
  if (input instanceof Request) {
    return input.headers.get('authorization');
  }
  return null;
}

/**
 * Mock OAuth provider token and userinfo network calls used by OAuth callback
 * tests. Any unexpected fetch request throws to keep test behavior deterministic.
 */
export function mockOAuthProviderFetch(
  options: OAuthProviderFetchMockOptions,
): OAuthProviderFetchMock {
  const tokens: OAuthMockTokens = {
    access_token: options.tokens?.access_token ?? 'mock-access-token',
    token_type: options.tokens?.token_type ?? 'Bearer',
    ...(options.tokens?.refresh_token
      ? { refresh_token: options.tokens.refresh_token }
      : {}),
    ...(options.tokens?.expires_in
      ? { expires_in: options.tokens.expires_in }
      : { expires_in: 3600 }),
  };

  const userInfo: OAuthMockUserInfo = {
    id: options.userInfo?.id ?? 'mock-oauth-user-id',
    email: options.userInfo?.email ?? 'mock-oauth-user@example.com',
    email_verified: options.userInfo?.email_verified ?? true,
    ...(options.userInfo?.name ? { name: options.userInfo.name } : {}),
    ...(options.userInfo?.picture ? { picture: options.userInfo.picture } : {}),
  };

  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const url = getRequestUrl(input);

      if (url === options.tokenUrl) {
        return jsonResponse(tokens);
      }

      if (url === options.userInfoUrl) {
        const authorization = getAuthorizationHeader(input, init);
        if (authorization !== `Bearer ${tokens.access_token}`) {
          return jsonResponse({ error: 'invalid_token' }, 401);
        }
        return jsonResponse({
          sub: userInfo.id,
          email: userInfo.email,
          email_verified: userInfo.email_verified,
          name: userInfo.name,
          picture: userInfo.picture,
        });
      }

      throw new Error(`Unexpected OAuth mock fetch request: ${url}`);
    });

  return {
    tokens,
    userInfo,
    restore: () => fetchSpy.mockRestore(),
  };
}
