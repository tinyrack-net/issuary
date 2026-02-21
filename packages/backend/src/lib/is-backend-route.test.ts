import { describe, expect, test } from 'vitest';
import { isBackendRoute } from './is-backend-route.js';

describe('isBackendRoute', () => {
  test('should match /api paths', () => {
    expect(isBackendRoute('/api/users')).toBe(true);
    expect(isBackendRoute('/api')).toBe(true);
    expect(isBackendRoute('/api/v1/health')).toBe(true);
  });

  test('should match /oauth paths', () => {
    expect(isBackendRoute('/oauth/authorize')).toBe(true);
    expect(isBackendRoute('/oauth/token')).toBe(true);
  });

  test('should match /.well-known paths', () => {
    expect(isBackendRoute('/.well-known/openid-configuration')).toBe(true);
    expect(isBackendRoute('/.well-known/jwks.json')).toBe(true);
  });

  test('should not match frontend routes', () => {
    expect(isBackendRoute('/login')).toBe(false);
    expect(isBackendRoute('/register')).toBe(false);
    expect(isBackendRoute('/profile')).toBe(false);
    expect(isBackendRoute('/')).toBe(false);
  });

  test('should not match paths that contain but do not start with prefixes', () => {
    expect(isBackendRoute('/page/api')).toBe(false);
    expect(isBackendRoute('/my-oauth')).toBe(false);
  });
});
