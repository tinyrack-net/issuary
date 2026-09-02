import { describe, expect, test } from 'vitest';
import { isHttpsOrLocalHttpUrl } from './url-policy.js';

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
