import { defineEntity, type InferEntity } from '@mikro-orm/core';
export const OAuthGrantEntitySchema = defineEntity({
  name: 'OAuthGrantEntity',
  tableName: 'oauth_grant',
  properties: (p) => ({
    id: p.string().primary(),
    user_sub: p.string(),
    client_id: p.string(),
    current_refresh_jti: p.string().nullable(),
    revoked_at: p.datetime().nullable(),
    expires_at: p.datetime(),
    revision: p.integer().default(0),
  }),
  indexes: [
    { properties: ['expires_at'] },
    { properties: ['user_sub', 'client_id'] },
  ],
});
export type OAuthGrant = InferEntity<typeof OAuthGrantEntitySchema>;
