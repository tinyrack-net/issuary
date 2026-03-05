import { describe, expect, test } from 'vitest';
import { apple, genericOAuth, github, google } from './identity-provider.js';

describe('google', () => {
  const base = {
    id: 'google',
    enabled: true,
    display_name: 'Google',
    client_id: 'google-client-id',
    client_secret: 'google-client-secret',
    email_conflict_strategy: 'auto_link' as const,
  };

  test('should resolve Google endpoints', () => {
    const resolved = google(base);

    expect(resolved.authorization_url).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(resolved.token_url).toBe('https://oauth2.googleapis.com/token');
    expect(resolved.userinfo_url).toBe(
      'https://openidconnect.googleapis.com/v1/userinfo',
    );
  });

  test('should resolve Google userinfo mapping', () => {
    const resolved = google(base);

    expect(resolved.userinfo_mapping.id).toBe('sub');
    expect(resolved.userinfo_mapping.email).toBe('email');
    expect(resolved.userinfo_mapping.email_verified).toBe('email_verified');
    expect(resolved.userinfo_mapping.name).toBe('name');
    expect(resolved.userinfo_mapping.picture).toBe('picture');
  });

  test('should use default scopes', () => {
    const resolved = google(base);

    expect(resolved.scopes).toEqual(['openid', 'email', 'profile']);
  });

  test('should allow custom scopes', () => {
    const resolved = google({ ...base, scopes: ['openid', 'email'] });

    expect(resolved.scopes).toEqual(['openid', 'email']);
  });

  test('should not set response_mode', () => {
    const resolved = google(base);

    expect(resolved.response_mode).toBeUndefined();
  });

  test('should set type to google', () => {
    const resolved = google(base);

    expect(resolved.type).toBe('google');
  });

  test('should fall back to id for display_name', () => {
    const resolved = google({ ...base, display_name: undefined });

    expect(resolved.display_name).toBe('google');
  });
});

describe('github', () => {
  const base = {
    id: 'github',
    enabled: true,
    display_name: 'GitHub',
    client_id: 'github-client-id',
    client_secret: 'github-client-secret',
    email_conflict_strategy: 'auto_link' as const,
  };

  test('should resolve GitHub endpoints', () => {
    const resolved = github(base);

    expect(resolved.authorization_url).toBe(
      'https://github.com/login/oauth/authorize',
    );
    expect(resolved.token_url).toBe(
      'https://github.com/login/oauth/access_token',
    );
    expect(resolved.userinfo_url).toBe('https://api.github.com/user');
  });

  test('should resolve GitHub userinfo mapping with id (not sub)', () => {
    const resolved = github(base);

    expect(resolved.userinfo_mapping.id).toBe('id');
    expect(resolved.userinfo_mapping.email).toBe('email');
    expect(resolved.userinfo_mapping.name).toBe('name');
    expect(resolved.userinfo_mapping.picture).toBe('avatar_url');
  });

  test('should not include email_verified in mapping', () => {
    const resolved = github(base);

    expect(resolved.userinfo_mapping.email_verified).toBeUndefined();
  });

  test('should set email_url', () => {
    const resolved = github(base);

    expect(resolved.email_url).toBe('https://api.github.com/user/emails');
  });

  test('should use default scopes', () => {
    const resolved = github(base);

    expect(resolved.scopes).toEqual(['user:email']);
  });

  test('should not set response_mode', () => {
    const resolved = github(base);

    expect(resolved.response_mode).toBeUndefined();
  });
});

describe('apple', () => {
  const base = {
    id: 'apple',
    enabled: true,
    display_name: 'Apple',
    client_id: 'apple-client-id',
    client_secret: 'apple-client-secret',
    email_conflict_strategy: 'auto_link' as const,
  };

  test('should resolve Apple endpoints with null userinfo_url', () => {
    const resolved = apple(base);

    expect(resolved.authorization_url).toBe(
      'https://appleid.apple.com/auth/authorize',
    );
    expect(resolved.token_url).toBe('https://appleid.apple.com/auth/token');
    expect(resolved.userinfo_url).toBeNull();
  });

  test('should set response_mode to form_post by default', () => {
    const resolved = apple(base);

    expect(resolved.response_mode).toBe('form_post');
  });

  test('should allow overriding response_mode', () => {
    const resolved = apple({ ...base, response_mode: 'query' });

    expect(resolved.response_mode).toBe('query');
  });

  test('should resolve Apple userinfo mapping without name/picture', () => {
    const resolved = apple(base);

    expect(resolved.userinfo_mapping.id).toBe('sub');
    expect(resolved.userinfo_mapping.email).toBe('email');
    expect(resolved.userinfo_mapping.email_verified).toBe('email_verified');
    expect(resolved.userinfo_mapping.name).toBeUndefined();
    expect(resolved.userinfo_mapping.picture).toBeUndefined();
  });

  test('should use default scopes', () => {
    const resolved = apple(base);

    expect(resolved.scopes).toEqual(['openid', 'email', 'name']);
  });
});

describe('genericOAuth', () => {
  const base = {
    id: 'custom-idp',
    enabled: true,
    display_name: 'Custom IDP',
    client_id: 'custom-client-id',
    client_secret: 'custom-client-secret',
    authorization_url: 'https://idp.example.com/authorize',
    token_url: 'https://idp.example.com/token',
    userinfo_url: 'https://idp.example.com/userinfo',
    scopes: ['openid', 'email'],
    email_conflict_strategy: 'auto_link' as const,
    userinfo_mapping: {
      id: 'sub',
      email: 'email',
      email_verified: 'email_verified',
      name: 'name',
      picture: 'picture',
    },
  };

  test('should use config values directly', () => {
    const resolved = genericOAuth(base);

    expect(resolved.authorization_url).toBe(
      'https://idp.example.com/authorize',
    );
    expect(resolved.token_url).toBe('https://idp.example.com/token');
    expect(resolved.userinfo_url).toBe('https://idp.example.com/userinfo');
    expect(resolved.scopes).toEqual(['openid', 'email']);
    expect(resolved.display_name).toBe('Custom IDP');
  });

  test('should use config userinfo_mapping', () => {
    const resolved = genericOAuth(base);

    expect(resolved.userinfo_mapping.id).toBe('sub');
    expect(resolved.userinfo_mapping.email).toBe('email');
    expect(resolved.userinfo_mapping.email_verified).toBe('email_verified');
    expect(resolved.userinfo_mapping.name).toBe('name');
    expect(resolved.userinfo_mapping.picture).toBe('picture');
  });

  test('should handle without optional fields', () => {
    const minimal = {
      id: 'minimal',
      enabled: true,
      display_name: 'Minimal',
      client_id: 'client-id',
      client_secret: 'client-secret',
      authorization_url: 'https://idp.example.com/authorize',
      token_url: 'https://idp.example.com/token',
      scopes: ['openid'],
      email_conflict_strategy: 'auto_link' as const,
      userinfo_mapping: {
        id: 'sub',
        email: 'email',
      },
    };

    const resolved = genericOAuth(minimal);

    expect(resolved.userinfo_url).toBeNull();
    expect(resolved.email_url).toBeUndefined();
    expect(resolved.response_mode).toBeUndefined();
    expect(resolved.userinfo_mapping.email_verified).toBeUndefined();
    expect(resolved.userinfo_mapping.name).toBeUndefined();
    expect(resolved.userinfo_mapping.picture).toBeUndefined();
  });

  test('should set type to generic_oauth', () => {
    const resolved = genericOAuth(base);

    expect(resolved.type).toBe('generic_oauth');
  });
});
