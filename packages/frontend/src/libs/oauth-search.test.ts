import { beforeEach, describe, expect, test } from 'vitest';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
} from './oauth-search.ts';

describe('oauth-search helpers', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/login');
  });

  test('detects OAuth flow only when client_id and redirect_uri are both present', () => {
    expect(
      isOAuthFlow({
        client_id: 'web-client',
        redirect_uri: 'https://client.example.com/callback',
      }),
    ).toBe(true);

    expect(
      isOAuthFlow({
        client_id: 'web-client',
      }),
    ).toBe(false);

    expect(
      isOAuthFlow({
        redirect_uri: 'https://client.example.com/callback',
      }),
    ).toBe(false);
  });

  test('builds an authorize URL and preserves defined OAuth parameters', () => {
    const url = buildAuthorizeUrl({
      client_id: 'web-client',
      redirect_uri: 'https://client.example.com/callback',
      response_type: 'code',
      scope: 'openid email',
      state: 'state-123',
      nonce: 'nonce-123',
      code_challenge: 'challenge-123',
      code_challenge_method: 'S256',
      prompt: 'login',
      max_age: '300',
    });
    const parsed = new URL(url);

    expect(parsed.origin).toBe(window.location.origin);
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('web-client');
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://client.example.com/callback',
    );
    expect(parsed.searchParams.get('prompt')).toBe('login');
    expect(parsed.searchParams.get('max_age')).toBe('300');
  });

  test('extractOAuthParams removes only undefined values', () => {
    expect(
      extractOAuthParams({
        client_id: 'web-client',
        redirect_uri: 'https://client.example.com/callback',
        state: undefined,
        lang: 'ko',
      }),
    ).toEqual({
      client_id: 'web-client',
      redirect_uri: 'https://client.example.com/callback',
      lang: 'ko',
    });
  });
});
