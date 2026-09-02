import { beforeEach, describe, expect, test } from 'vitest';
import {
  buildAuthenticatedAuthorizeUrl,
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
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

  test('builds a post-login authorize URL with a fresh authentication marker', () => {
    const parsed = new URL(
      buildAuthenticatedAuthorizeUrl({
        client_id: 'web-client',
        redirect_uri: 'https://client.example.com/callback',
        response_type: 'code',
        scope: 'openid email',
        state: 'state-123',
        nonce: 'nonce-123',
        code_challenge: 'challenge-123',
        code_challenge_method: 'S256',
      }),
    );

    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('reauthenticated')).toBe('1');
    expect(parsed.searchParams.get('account_selected')).toBe('1');
    expect(parsed.searchParams.get('prompt')).toBeNull();
  });

  test('does not mark account selected after login when prompt explicitly requests account selection', () => {
    const parsed = new URL(
      buildAuthenticatedAuthorizeUrl({
        client_id: 'web-client',
        redirect_uri: 'https://client.example.com/callback',
        response_type: 'code',
        prompt: 'select_account',
      }),
    );

    expect(parsed.searchParams.get('reauthenticated')).toBe('1');
    expect(parsed.searchParams.get('account_selected')).toBeNull();
    expect(parsed.searchParams.get('prompt')).toBe('select_account');
  });

  test('accepts and preserves valid multi-value prompt combinations', () => {
    const search = OAuthSearchSchema.parse({
      client_id: 'web-client',
      redirect_uri: 'https://client.example.com/callback',
      prompt: 'login consent',
    });

    const parsed = new URL(buildAuthorizeUrl(search));

    expect(parsed.searchParams.get('prompt')).toBe('login consent');
  });

  test('accepts prompt=none by itself', () => {
    const search = OAuthSearchSchema.parse({
      client_id: 'web-client',
      redirect_uri: 'https://client.example.com/callback',
      prompt: 'none',
    });

    expect(search.prompt).toBe('none');
  });

  test('accepts non-interactive account-selection prompt combination', () => {
    const search = OAuthSearchSchema.parse({
      client_id: 'web-client',
      redirect_uri: 'https://client.example.com/callback',
      prompt: 'none select_account',
    });

    expect(search.prompt).toBe('none select_account');
  });

  test.each(['invalid', 'login invalid', 'none login', 'none consent'])(
    'rejects invalid prompt value %s',
    (prompt) => {
      expect(OAuthSearchSchema.safeParse({ prompt }).success).toBe(false);
    },
  );

  test('normalizes quoted account_selected values from router link serialization', () => {
    const parsed = OAuthSearchSchema.parse({
      client_id: 'client-web',
      redirect_uri: 'https://client.example/callback',
      account_selected: '"1"',
      account_selection_state: 'chooser-state-123',
    });

    expect(parsed.account_selected).toBe(1);
    expect(buildAuthorizeUrl(parsed)).toContain('account_selected=1');
  });

  test('preserves account-selection and OIDC compatibility parameters', () => {
    const search = OAuthSearchSchema.parse({
      client_id: 'web-client',
      redirect_uri: 'https://client.example.com/callback',
      response_type: 'code',
      response_mode: 'form_post',
      login_hint: 'user@example.com',
      ui_locales: 'ko en',
      id_token_hint: 'id-token-hint',
      acr_values: 'urn:mace:incommon:iap:silver',
      account_selected: 1,
      account_selection_state: 'chooser-state-123',
    });

    const parsed = new URL(buildAuthorizeUrl(search));

    expect(parsed.searchParams.get('response_mode')).toBe('form_post');
    expect(parsed.searchParams.get('login_hint')).toBe('user@example.com');
    expect(parsed.searchParams.get('ui_locales')).toBe('ko en');
    expect(parsed.searchParams.get('id_token_hint')).toBe('id-token-hint');
    expect(parsed.searchParams.get('acr_values')).toBe(
      'urn:mace:incommon:iap:silver',
    );
    expect(parsed.searchParams.get('account_selected')).toBe('1');
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
