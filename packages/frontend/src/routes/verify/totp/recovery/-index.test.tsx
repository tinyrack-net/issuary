import { describe, expect, test } from 'vitest';
import source from './index.tsx?raw';

describe('/verify/totp/recovery', () => {
  test('uses authenticated authorize continuation after successful recovery-code verification', () => {
    expect(source).toContain('buildAuthenticatedAuthorizeUrl');
    expect(source).toContain(
      'window.location.href = buildAuthenticatedAuthorizeUrl(search)',
    );
    expect(source).not.toContain(
      'window.location.href = buildAuthorizeUrl(search)',
    );
  });
});
