import { afterEach, describe, expect, test } from 'vitest';
import { mockOAuthProviderFetch } from './oauth-mock.js';

const TOKEN_URL = 'https://provider.example/token';
const USERINFO_URL = 'https://provider.example/userinfo';

describe('mockOAuthProviderFetch', () => {
  let restore: (() => void) | undefined;

  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  test('matches concurrent token and userinfo responses by request identity', async () => {
    const oauthMock = mockOAuthProviderFetch({
      tokenUrl: TOKEN_URL,
      userInfoUrl: USERINFO_URL,
      tokensByCode: new Map([
        ['code-1', { access_token: 'access-1' }],
        ['code-2', { access_token: 'access-2' }],
      ]),
      userInfoByAccessToken: new Map([
        ['access-1', { id: 'user-1', email: 'one@example.com' }],
        ['access-2', { id: 'user-2', email: 'two@example.com' }],
      ]),
    });
    restore = oauthMock.restore;

    const tokenResponses = await Promise.all(
      ['code-2', 'code-1'].map(async (code) => {
        const response = await fetch(TOKEN_URL, {
          method: 'POST',
          body: new URLSearchParams({ code }),
        });
        return response.json();
      }),
    );

    expect(tokenResponses).toEqual([
      expect.objectContaining({ access_token: 'access-2' }),
      expect.objectContaining({ access_token: 'access-1' }),
    ]);

    const userInfoResponses = await Promise.all(
      ['access-2', 'access-1'].map(async (accessToken) => {
        const response = await fetch(USERINFO_URL, {
          headers: { authorization: `Bearer ${accessToken}` },
        });
        return response.json();
      }),
    );

    expect(userInfoResponses).toEqual([
      expect.objectContaining({ sub: 'user-2', email: 'two@example.com' }),
      expect.objectContaining({ sub: 'user-1', email: 'one@example.com' }),
    ]);
  });
});
