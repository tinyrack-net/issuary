import { afterEach, describe, expect, test } from 'vitest';
import {
  jsonRequestBody,
  mockJsonResponses,
  resetFetchMock,
} from '#admin/test-utils/query-test-utils.js';
import {
  createOAuthProvider,
  deleteOAuthProvider,
  listAdminUsers,
  listOAuthClients,
  listOAuthProviders,
  updateOAuthProvider,
} from './api.js';

afterEach(() => {
  resetFetchMock();
});

describe('admin API pagination helpers', () => {
  test('listAdminUsers sends pagination params and parses pagination metadata', async () => {
    const fetchMock = mockJsonResponses({
      url: '/admin/api/users?limit=10&offset=20&search=alice',
      method: 'GET',
      body: {
        items: [
          {
            sub: 'user-1',
            email: 'alice@example.com',
            email_verified: true,
            role: 'user',
            managed_by: 'database',
          },
        ],
        pagination: {
          limit: 10,
          offset: 20,
          total: 42,
        },
      },
    });

    const response = await listAdminUsers({
      limit: 10,
      offset: 20,
      search: 'alice',
    });

    expect(response).toEqual({
      items: [
        {
          sub: 'user-1',
          email: 'alice@example.com',
          email_verified: true,
          role: 'user',
          managed_by: 'database',
        },
      ],
      pagination: {
        limit: 10,
        offset: 20,
        total: 42,
      },
    });
    fetchMock.assertAllResponsesConsumed();
  });

  test('listOAuthClients sends pagination params and parses pagination metadata', async () => {
    const fetchMock = mockJsonResponses({
      url: '/admin/api/oauth-clients?limit=5&offset=10&search=web',
      method: 'GET',
      body: {
        items: [
          {
            id: 'client-1',
            client_id: 'web',
            name: 'Web app',
            redirect_uris: ['https://client.example/callback'],
            response_types: ['code'],
            grant_types: ['authorization_code'],
            scope: 'openid profile',
            enabled: true,
            managed_by: 'database',
          },
        ],
        pagination: {
          limit: 5,
          offset: 10,
          total: 17,
        },
      },
    });

    const response = await listOAuthClients({
      limit: 5,
      offset: 10,
      search: 'web',
    });

    expect(response).toEqual({
      items: [
        {
          id: 'client-1',
          client_id: 'web',
          name: 'Web app',
          redirect_uris: ['https://client.example/callback'],
          response_types: ['code'],
          grant_types: ['authorization_code'],
          scope: 'openid profile',
          enabled: true,
          managed_by: 'database',
        },
      ],
      pagination: {
        limit: 5,
        offset: 10,
        total: 17,
      },
    });
    fetchMock.assertAllResponsesConsumed();
  });

  test('listOAuthProviders sends pagination params and strips secret fields', async () => {
    const fetchMock = mockJsonResponses({
      url: '/admin/api/oauth-providers?limit=5&offset=10&search=google',
      method: 'GET',
      body: {
        items: [
          {
            id: 'google',
            type: 'google',
            issuer: 'https://accounts.google.com',
            display_name: 'Google',
            icon_url: null,
            client_id: 'google-client',
            client_secret: 'must-not-survive-parsing',
            client_secret_ciphertext: 'must-not-survive-parsing',
            has_client_secret: true,
            scopes: ['openid', 'email', 'profile'],
            authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
            token_url: 'https://oauth2.googleapis.com/token',
            userinfo_url: 'https://openidconnect.googleapis.com/v1/userinfo',
            jwks_url: 'https://www.googleapis.com/oauth2/v3/certs',
            email_url: null,
            response_mode: 'query',
            email_conflict_strategy: 'auto_link',
            userinfo_mapping: {
              id: 'sub',
              email: 'email',
              email_verified: 'email_verified',
              name: 'name',
              picture: 'picture',
            },
            enabled: true,
            managed_by: 'config',
            created_at: '1970-01-01T00:00:00.000Z',
            updated_at: '1970-01-01T00:00:00.000Z',
          },
        ],
        pagination: {
          limit: 5,
          offset: 10,
          total: 17,
        },
      },
    });

    const response = await listOAuthProviders({
      limit: 5,
      offset: 10,
      search: 'google',
    });

    expect(response).toEqual({
      items: [
        {
          id: 'google',
          type: 'google',
          issuer: 'https://accounts.google.com',
          display_name: 'Google',
          icon_url: null,
          client_id: 'google-client',
          has_client_secret: true,
          scopes: ['openid', 'email', 'profile'],
          authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
          token_url: 'https://oauth2.googleapis.com/token',
          userinfo_url: 'https://openidconnect.googleapis.com/v1/userinfo',
          jwks_url: 'https://www.googleapis.com/oauth2/v3/certs',
          email_url: null,
          response_mode: 'query',
          email_conflict_strategy: 'auto_link',
          userinfo_mapping: {
            id: 'sub',
            email: 'email',
            email_verified: 'email_verified',
            name: 'name',
            picture: 'picture',
          },
          enabled: true,
          managed_by: 'config',
          created_at: '1970-01-01T00:00:00.000Z',
          updated_at: '1970-01-01T00:00:00.000Z',
        },
      ],
      pagination: {
        limit: 5,
        offset: 10,
        total: 17,
      },
    });
    expect(JSON.stringify(response)).not.toContain('must-not-survive-parsing');
    fetchMock.assertAllResponsesConsumed();
  });

  test('OAuth provider mutations use the admin provider API without returned secrets', async () => {
    const provider = {
      id: 'database-google',
      type: 'google',
      issuer: 'https://accounts.google.com',
      display_name: 'Database Google',
      icon_url: null,
      client_id: 'database-google-client',
      has_client_secret: true,
      scopes: ['openid', 'email'],
      authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_url: 'https://oauth2.googleapis.com/token',
      userinfo_url: 'https://openidconnect.googleapis.com/v1/userinfo',
      jwks_url: null,
      email_url: null,
      response_mode: 'query',
      email_conflict_strategy: 'auto_link',
      userinfo_mapping: { id: 'sub', email: 'email' },
      enabled: true,
      managed_by: 'database',
      created_at: '2026-05-18T00:00:00.000Z',
      updated_at: '2026-05-18T00:00:00.000Z',
    };
    const fetchMock = mockJsonResponses(
      {
        url: '/admin/api/oauth-providers',
        method: 'POST',
        body: { oauth_provider: provider },
      },
      {
        url: '/admin/api/oauth-providers/database-google',
        method: 'PATCH',
        body: {
          oauth_provider: { ...provider, display_name: 'Updated Google' },
        },
      },
      {
        url: '/admin/api/oauth-providers/database-google',
        method: 'DELETE',
        body: {},
      },
    );

    await createOAuthProvider({
      id: 'database-google',
      type: 'google',
      issuer: 'https://accounts.google.com',
      display_name: 'Database Google',
      icon_url: null,
      client_id: 'database-google-client',
      client_secret: 'provider-secret',
      scopes: ['openid', 'email'],
      authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_url: 'https://oauth2.googleapis.com/token',
      userinfo_url: 'https://openidconnect.googleapis.com/v1/userinfo',
      jwks_url: null,
      email_url: null,
      response_mode: 'query',
      email_conflict_strategy: 'auto_link',
      userinfo_mapping: { id: 'sub', email: 'email' },
      enabled: true,
    });
    await updateOAuthProvider({
      id: 'database-google',
      display_name: 'Updated Google',
      client_secret: 'replacement-secret',
    });
    await deleteOAuthProvider('database-google');

    expect(jsonRequestBody(fetchMock.requests[0])).toEqual(
      expect.objectContaining({ client_secret: 'provider-secret' }),
    );
    expect(jsonRequestBody(fetchMock.requests[1])).toEqual({
      client_secret: 'replacement-secret',
      display_name: 'Updated Google',
    });
    expect(fetchMock.requests[2]).toEqual(
      expect.objectContaining({
        method: 'DELETE',
        url: '/admin/api/oauth-providers/database-google',
      }),
    );
    fetchMock.assertAllResponsesConsumed();
  });
});
