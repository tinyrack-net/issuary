import { describe, expect, test } from 'vitest';
import {
  isHttpsOrLocalHttpUrl,
  isPrivateUseSchemeRedirectUri,
  isRegistrableRedirectUri,
} from './url-policy.js';

describe('URL policy', () => {
  test.each([
    'http://localhost/callback',
    'http://foo.localhost/callback',
    'http://127.0.0.1/callback',
    'http://127.1.2.3/callback',
    'http://[::1]/callback',
  ])('allows local HTTP URL %s', (url) => {
    expect(isHttpsOrLocalHttpUrl(url)).toBe(true);
  });

  test.each(['http://127.evil/callback', 'http://127.0.0.1.evil/callback'])(
    'rejects lookalike 127 hostname %s',
    (url) => {
      expect(isHttpsOrLocalHttpUrl(url)).toBe(false);
    },
  );
});

describe('private-use scheme redirect URIs', () => {
  test.each([
    'bookorbit://oauth2-callback',
    'com.example.app:/oauth2redirect',
    'com.example.app:/oauth2redirect?tenant=alpha',
    'my-app+native.v2://callback/path',
  ])('allows native app redirect URI %s', (uri) => {
    expect(isPrivateUseSchemeRedirectUri(uri)).toBe(true);
    expect(isRegistrableRedirectUri(uri)).toBe(true);
  });

  test.each([
    'https://app.example/callback',
    'http://localhost/callback',
    'javascript:alert(1)',
    'JavaScript://comment%0Aalert(1)',
    'data:text/html,hello',
    'vbscript:msgbox',
    'file:///etc/passwd',
    'blob:https://app.example/uuid',
    'intent://callback#Intent;scheme=app;end',
    'mailto:user@example.com',
    'tel:+10000000000',
    'ws://app.example/socket',
    'about:blank',
  ])('rejects web or dangerous scheme %s', (uri) => {
    expect(isPrivateUseSchemeRedirectUri(uri)).toBe(false);
  });

  test.each([
    'bookorbit://oauth2-callback#token',
    'bookorbit://*/callback',
    'bookorbit://user:secret@oauth2-callback',
    'not a uri',
    '://missing-scheme',
  ])('rejects malformed or unsafe native redirect URI %s', (uri) => {
    expect(isPrivateUseSchemeRedirectUri(uri)).toBe(false);
    expect(isRegistrableRedirectUri(uri)).toBe(false);
  });

  test('keeps rejecting insecure remote HTTP', () => {
    expect(isRegistrableRedirectUri('http://app.example/callback')).toBe(false);
  });
});
