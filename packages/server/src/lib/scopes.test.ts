import { describe, expect, test } from 'vitest';
import { parseScopesWithDescriptions } from './scopes.ts';

describe('parseScopesWithDescriptions', () => {
  test('should parse multiple scopes', () => {
    const result = parseScopesWithDescriptions('openid email profile');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      name: 'openid',
      description: 'Access your unique user identifier',
    });
    expect(result[1]).toEqual({
      name: 'email',
      description: 'Access your email address',
    });
    expect(result[2]).toEqual({
      name: 'profile',
      description: 'Access your profile information (name, picture, etc.)',
    });
  });

  test('should return empty array for undefined', () => {
    expect(parseScopesWithDescriptions(undefined)).toEqual([]);
  });

  test('should return empty array for empty string', () => {
    expect(parseScopesWithDescriptions('')).toEqual([]);
  });

  test('should use fallback description for unknown scopes', () => {
    const result = parseScopesWithDescriptions('custom_scope');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'custom_scope',
      description: 'Access to custom_scope data',
    });
  });

  test('should handle single scope', () => {
    const result = parseScopesWithDescriptions('openid');
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('openid');
  });

  test('should handle offline_access scope', () => {
    const result = parseScopesWithDescriptions('offline_access');
    expect(result[0]).toEqual({
      name: 'offline_access',
      description: 'Maintain access when you are not present',
    });
  });
});
