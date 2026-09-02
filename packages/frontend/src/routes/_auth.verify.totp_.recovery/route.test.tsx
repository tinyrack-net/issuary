import { describe, expect, test } from 'vitest';
import source from './route.tsx?raw';

describe('/verify/totp/recovery', () => {
  test('uses authenticated authorize continuation after successful recovery-code verification', () => {
    expect(source).toContain('buildAuthenticatedAuthorizeUrl');
    expect(source).toContain(
      'navigateDocument(buildAuthenticatedAuthorizeUrl(search))',
    );
    expect(source).not.toContain('navigateDocument(buildAuthorizeUrl(search))');
  });
});
