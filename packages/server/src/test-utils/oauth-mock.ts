import { vi } from 'vitest';

export interface OAuthMockTokens {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
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
  /** Set to null for providers without a userinfo endpoint (e.g. Apple). */
  userInfoUrl: string | null;
  tokens?: Partial<OAuthMockTokens>;
  tokensByCode?: ReadonlyMap<string, Partial<OAuthMockTokens>>;
  userInfo?: Partial<OAuthMockUserInfo>;
  userInfoByAccessToken?: ReadonlyMap<string, Partial<OAuthMockUserInfo>>;
  /**
   * Raw userinfo response body returned by the mock.
   * Use this to supply provider-specific field names
   * (e.g. GitHub: `{ id: 123, avatar_url: '...' }`).
   * When omitted, a Google-style response is returned.
   */
  rawUserInfoResponse?: Record<string, unknown>;
  jwksUrl?: string;
  jwks?: unknown;
}

export interface OAuthProviderFetchMock {
  tokens: OAuthMockTokens;
  userInfo: OAuthMockUserInfo;
  countRequests: (url?: string) => number;
  requestUrls: () => string[];
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

async function getRequestFormField(
  input: string | URL | Request,
  init: RequestInit | undefined,
  field: string,
): Promise<string | null> {
  const request =
    input instanceof Request ? input.clone() : new Request(input, init);
  const value = (await request.formData()).get(field);
  return typeof value === 'string' ? value : null;
}

function createOAuthMockUserInfo(
  userInfo?: Partial<OAuthMockUserInfo>,
): OAuthMockUserInfo {
  return {
    id: userInfo?.id ?? 'mock-oauth-user-id',
    email: userInfo?.email ?? 'mock-oauth-user@example.com',
    email_verified: userInfo?.email_verified ?? true,
    ...(userInfo?.name ? { name: userInfo.name } : {}),
    ...(userInfo?.picture ? { picture: userInfo.picture } : {}),
  };
}

function createOAuthMockTokens(
  tokens?: Partial<OAuthMockTokens>,
): OAuthMockTokens {
  return {
    access_token: tokens?.access_token ?? 'mock-access-token',
    token_type: tokens?.token_type ?? 'Bearer',
    ...(tokens?.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
    ...(tokens?.expires_in
      ? { expires_in: tokens.expires_in }
      : { expires_in: 3600 }),
    ...(tokens?.id_token ? { id_token: tokens.id_token } : {}),
  };
}

/**
 * Mock OAuth provider token and userinfo network calls used by OAuth callback
 * tests. Any unexpected fetch request throws to keep test behavior deterministic.
 */
export function mockOAuthProviderFetch(
  options: OAuthProviderFetchMockOptions,
): OAuthProviderFetchMock {
  const tokens = createOAuthMockTokens(options.tokens);
  const issuedAccessTokens = new Set([tokens.access_token]);

  const userInfo = createOAuthMockUserInfo(options.userInfo);
  const requestUrls: string[] = [];

  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const url = getRequestUrl(input);
      requestUrls.push(url);

      if (url === options.tokenUrl) {
        if (options.tokensByCode) {
          const code = await getRequestFormField(input, init, 'code');
          const configuredTokens = code
            ? options.tokensByCode.get(code)
            : undefined;
          if (!configuredTokens) {
            throw new Error(`OAuth mock has no tokens for code: ${code}`);
          }
          const responseTokens = createOAuthMockTokens(configuredTokens);
          issuedAccessTokens.add(responseTokens.access_token);
          return jsonResponse(responseTokens);
        }

        return jsonResponse(tokens);
      }

      if (options.userInfoUrl && url === options.userInfoUrl) {
        const authorization = getAuthorizationHeader(input, init);
        const token = authorization?.startsWith('Bearer ')
          ? authorization.slice('Bearer '.length)
          : null;
        if (!token || !issuedAccessTokens.has(token)) {
          return jsonResponse({ error: 'invalid_token' }, 401);
        }

        // Use rawUserInfoResponse if provided, otherwise default to
        // Google-style field names for backward compatibility.
        let responseUserInfo = userInfo;
        if (options.userInfoByAccessToken) {
          const configuredUserInfo = options.userInfoByAccessToken.get(token);
          if (!configuredUserInfo) {
            throw new Error(
              `OAuth mock has no userinfo for access token: ${token}`,
            );
          }
          responseUserInfo = createOAuthMockUserInfo(configuredUserInfo);
        }
        const body = options.rawUserInfoResponse ?? {
          sub: responseUserInfo.id,
          email: responseUserInfo.email,
          email_verified: responseUserInfo.email_verified,
          name: responseUserInfo.name,
          picture: responseUserInfo.picture,
        };

        return jsonResponse(body);
      }

      if (options.jwksUrl && url === options.jwksUrl) {
        return jsonResponse(options.jwks ?? { keys: [] });
      }

      throw new Error(`Unexpected OAuth mock fetch request: ${url}`);
    });

  return {
    tokens,
    userInfo,
    countRequests: (url?: string) =>
      url
        ? requestUrls.filter((requestUrl) => requestUrl === url).length
        : requestUrls.length,
    requestUrls: () => [...requestUrls],
    restore: () => fetchSpy.mockRestore(),
  };
}
