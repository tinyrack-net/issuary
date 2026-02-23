import { describe, expect, test } from 'vitest';
import {
  resolveOAuthConfig,
  WELL_KNOWN_OAUTH_PROVIDERS,
} from './oauth-resolver.js';
import type { AppConfigIdentityProvider } from './schema.js';

describe('resolveOAuthConfig', () => {
  describe('Google', () => {
    const base: AppConfigIdentityProvider = {
      id: 'google',
      type: 'google',
      enabled: true,
      display_name: 'Google',
      client_id: 'google-client-id',
      client_secret: 'google-client-secret',
      email_conflict_strategy: 'auto_link',
    };

    test('should resolve Google endpoints from well-known config', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.authorization_url).toBe(
        'https://accounts.google.com/o/oauth2/v2/auth',
      );
      expect(resolved.token_url).toBe('https://oauth2.googleapis.com/token');
      expect(resolved.userinfo_url).toBe(
        'https://openidconnect.googleapis.com/v1/userinfo',
      );
    });

    test('should resolve Google userinfo mapping', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.userinfo_mapping.id).toBe('sub');
      expect(resolved.userinfo_mapping.email).toBe('email');
      expect(resolved.userinfo_mapping.email_verified).toBe('email_verified');
      expect(resolved.userinfo_mapping.name).toBe('name');
      expect(resolved.userinfo_mapping.picture).toBe('picture');
    });

    test('should use default scopes', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.scopes).toEqual(['openid', 'email', 'profile']);
    });

    test('should not set response_mode', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.response_mode).toBeUndefined();
    });
  });

  describe('GitHub', () => {
    const base: AppConfigIdentityProvider = {
      id: 'github',
      type: 'github',
      enabled: true,
      display_name: 'GitHub',
      client_id: 'github-client-id',
      client_secret: 'github-client-secret',
      email_conflict_strategy: 'auto_link',
    };

    test('should resolve GitHub endpoints from well-known config', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.authorization_url).toBe(
        'https://github.com/login/oauth/authorize',
      );
      expect(resolved.token_url).toBe(
        'https://github.com/login/oauth/access_token',
      );
      expect(resolved.userinfo_url).toBe('https://api.github.com/user');
    });

    test('should resolve GitHub userinfo mapping with id (not sub)', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.userinfo_mapping.id).toBe('id');
      expect(resolved.userinfo_mapping.email).toBe('email');
      expect(resolved.userinfo_mapping.name).toBe('name');
      expect(resolved.userinfo_mapping.picture).toBe('avatar_url');
    });

    test('should not include email_verified in mapping', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.userinfo_mapping.email_verified).toBeUndefined();
    });

    test('should set email_url', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.email_url).toBe('https://api.github.com/user/emails');
    });

    test('should use default scopes', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.scopes).toEqual(['user:email']);
    });

    test('should not set response_mode', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.response_mode).toBeUndefined();
    });
  });

  describe('Apple', () => {
    const base: AppConfigIdentityProvider = {
      id: 'apple',
      type: 'apple',
      enabled: true,
      display_name: 'Apple',
      client_id: 'apple-client-id',
      client_secret: 'apple-client-secret',
      email_conflict_strategy: 'auto_link',
    };

    test('should resolve Apple endpoints with null userinfo_url', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.authorization_url).toBe(
        'https://appleid.apple.com/auth/authorize',
      );
      expect(resolved.token_url).toBe('https://appleid.apple.com/auth/token');
      expect(resolved.userinfo_url).toBeNull();
    });

    test('should set response_mode to form_post', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.response_mode).toBe('form_post');
    });

    test('should resolve Apple userinfo mapping without name/picture', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.userinfo_mapping.id).toBe('sub');
      expect(resolved.userinfo_mapping.email).toBe('email');
      expect(resolved.userinfo_mapping.email_verified).toBe('email_verified');
      expect(resolved.userinfo_mapping.name).toBeUndefined();
      expect(resolved.userinfo_mapping.picture).toBeUndefined();
    });

    test('should use default scopes', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.scopes).toEqual(['openid', 'email', 'name']);
    });
  });

  describe('Custom scope override', () => {
    test('should use config scopes over default scopes for well-known provider', () => {
      const config: AppConfigIdentityProvider = {
        id: 'google',
        type: 'google',
        enabled: true,
        display_name: 'Google',
        client_id: 'client-id',
        client_secret: 'client-secret',
        email_conflict_strategy: 'auto_link',
        scopes: ['openid', 'email'],
      };

      const resolved = resolveOAuthConfig(config);
      expect(resolved.scopes).toEqual(['openid', 'email']);
    });
  });

  describe('Generic OAuth', () => {
    const base: AppConfigIdentityProvider = {
      id: 'custom-idp',
      type: 'generic_oauth',
      enabled: true,
      display_name: 'Custom IDP',
      client_id: 'custom-client-id',
      client_secret: 'custom-client-secret',
      authorization_url: 'https://idp.example.com/authorize',
      token_url: 'https://idp.example.com/token',
      userinfo_url: 'https://idp.example.com/userinfo',
      scopes: ['openid', 'email'],
      email_conflict_strategy: 'auto_link',
      userinfo_mapping: {
        id: 'sub',
        email: 'email',
        email_verified: 'email_verified',
        name: 'name',
        picture: 'picture',
      },
    };

    test('should use config values directly for generic OAuth', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.authorization_url).toBe(
        'https://idp.example.com/authorize',
      );
      expect(resolved.token_url).toBe('https://idp.example.com/token');
      expect(resolved.userinfo_url).toBe('https://idp.example.com/userinfo');
      expect(resolved.scopes).toEqual(['openid', 'email']);
      expect(resolved.display_name).toBe('Custom IDP');
    });

    test('should use config userinfo_mapping for generic OAuth', () => {
      const resolved = resolveOAuthConfig(base);

      expect(resolved.userinfo_mapping.id).toBe('sub');
      expect(resolved.userinfo_mapping.email).toBe('email');
      expect(resolved.userinfo_mapping.email_verified).toBe('email_verified');
      expect(resolved.userinfo_mapping.name).toBe('name');
      expect(resolved.userinfo_mapping.picture).toBe('picture');
    });

    test('should handle generic OAuth without optional fields', () => {
      const minimal: AppConfigIdentityProvider = {
        id: 'minimal',
        type: 'generic_oauth',
        enabled: true,
        display_name: 'Minimal',
        client_id: 'client-id',
        client_secret: 'client-secret',
        authorization_url: 'https://idp.example.com/authorize',
        token_url: 'https://idp.example.com/token',
        scopes: ['openid'],
        email_conflict_strategy: 'auto_link',
        userinfo_mapping: {
          id: 'sub',
          email: 'email',
        },
      };

      const resolved = resolveOAuthConfig(minimal);

      expect(resolved.userinfo_url).toBeNull();
      expect(resolved.email_url).toBeUndefined();
      expect(resolved.response_mode).toBeUndefined();
      expect(resolved.userinfo_mapping.email_verified).toBeUndefined();
      expect(resolved.userinfo_mapping.name).toBeUndefined();
      expect(resolved.userinfo_mapping.picture).toBeUndefined();
    });
  });

  describe('WELL_KNOWN_OAUTH_PROVIDERS', () => {
    test('should define exactly three providers', () => {
      const providers = Object.keys(WELL_KNOWN_OAUTH_PROVIDERS);
      expect(providers).toEqual(['google', 'github', 'apple']);
    });

    test('Apple should have null userinfo_url', () => {
      expect(WELL_KNOWN_OAUTH_PROVIDERS.apple.userinfo_url).toBeNull();
    });
  });
});
