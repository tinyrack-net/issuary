import { OAuthCodeRepository } from '@backend/repositories/oauth-code.repository.js';
import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { BaseSchema } from './base.entity.js';
import { OAuthClientEntitySchema } from './oauth-client.entity.js';
import { UserEntity } from './user.entity.js';

export const OAUTH_CODE_CHALLENGE_METHOD = {
  S256: 'S256',
  plain: 'plain',
} as const;

export type OAuthCodeChallengeMethods =
  (typeof OAUTH_CODE_CHALLENGE_METHOD)[keyof typeof OAUTH_CODE_CHALLENGE_METHOD];

export const OAuthCodeEntitySchema = defineEntity({
  name: 'OAuthCodeEntity',
  tableName: 'oauth_code',
  comment: 'Issued OAuth authorization codes',
  extends: BaseSchema,
  repository: () => OAuthCodeRepository,
  properties: (p) => ({
    id: p
      .uuid()
      .primary()
      .comment('Primary key as UUID')
      .onCreate(() => crypto.randomUUID()),
    codeHash: p
      .string()
      .comment('Hash of the issued authorization code')
      .unique(),
    client: () =>
      p
        .manyToOne(OAuthClientEntitySchema)
        .comment('Reference to the OAuth client that requested the code'),
    user: () =>
      p
        .manyToOne(UserEntity)
        .ref()
        .comment('Reference to the resource owner (user)'),
    redirectUri: p
      .string()
      .comment('Redirect URI used during the authorization request')
      .nullable(),
    scope: p
      .json<string[]>()
      .comment('Scopes granted by the authorization code')
      .default([]),
    nonce: p
      .string()
      .comment('Nonce value associated with the authorization request'),
    codeChallenge: p.string().comment('PKCE code challenge value'),
    codeChallengeMethod: p
      .enum(() => OAUTH_CODE_CHALLENGE_METHOD)
      .comment('PKCE code challenge method')
      .default(OAUTH_CODE_CHALLENGE_METHOD.S256),
    expiredAt: p.datetime().comment('Absolute expiry timestamp for the code'),
    consumedAt: p
      .datetime()
      .comment('Timestamp when the code was redeemed')
      .nullable(),

    /**
     * OIDC Authentication Metadata
     * These fields store authentication context from the user's session
     * to be included in the ID Token when the code is exchanged.
     */
    authTime: p
      .integer()
      .comment(
        'Time when the End-User authentication occurred (Unix timestamp). Used for auth_time claim in ID Token (OIDC Core 1.0 §2)',
      )
      .nullable(),
  }),
  indexes: [
    {
      name: 'auth_code_hash_idx',
      properties: ['codeHash'],
    },
    {
      name: 'oauth_code_client_consumed_idx',
      properties: ['client', 'consumedAt'],
    },
    {
      name: 'oauth_code_expired_at_idx',
      properties: ['expiredAt'],
    },
  ],
});

export type IOAuthCodeEntity = InferEntity<typeof OAuthCodeEntitySchema>;
