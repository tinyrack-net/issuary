import z from 'zod/v4';
import { f } from './field.js';

export const r = {
  UserSession: z
    .object({
      managed: z.literal(['database', 'config']),
      id: f.userId,
      email: f.userEmail,
      email_verified: f.emailVerified,
    })
    .describe('UserSession'),

  OAuthClient: z
    .object({
      id: z.string(),
      clientId: z.string(),
      name: z.string(),
      managed: z.enum(['config', 'database']),
      enabled: z.boolean(),
      redirectUris: z.array(z.string()),
      responseTypes: z.array(z.string()),
      scopes: z.array(z.string()),
      grantTypes: z.array(z.string()),
    })
    .describe('OAuth Client Information'),
};
