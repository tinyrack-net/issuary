import z from 'zod';
import { isHttpsOrLocalHttpUrl } from './url-policy.js';

const SecureEndpointUrlSchema = z.string().refine(isHttpsOrLocalHttpUrl, {
  message: 'URL must use HTTPS or local HTTP.',
});

const JwksUrlSchema = SecureEndpointUrlSchema.describe(
  'JWKS endpoint URL for providers that verify ID tokens.',
);

const UserinfoMappingConfigSchema = z
  .object({
    id: z
      .string()
      .describe('Field name for the user ID in the userinfo response.'),
    email: z
      .string()
      .describe('Field name for the email in the userinfo response.'),
    email_verified: z
      .string()
      .optional()
      .describe(
        'Field name for the email verified flag in the userinfo response.',
      ),
    name: z
      .string()
      .optional()
      .describe('Field name for the display name in the userinfo response.'),
    picture: z
      .string()
      .optional()
      .describe(
        'Field name for the profile picture URL in the userinfo response.',
      ),
  })
  .strict()
  .describe('Mapping of userinfo response fields to user attributes.');

export const IdentityProviderConfigSchema = z
  .object({
    id: z.string().describe('Unique identifier for this provider.'),
    type: z
      .enum(['github', 'google', 'apple', 'generic_oauth'])
      .describe('Identity provider type.'),
    enabled: z.boolean().describe('Whether this identity provider is enabled.'),
    display_name: z.string().describe('Display name shown on the login page.'),
    icon_url: z
      .string()
      .optional()
      .describe('URL to the provider icon shown on the login page.'),
    client_id: z.string().describe('OAuth client ID from the provider.'),
    client_secret: z
      .string()
      .describe('OAuth client secret from the provider.'),
    authorization_url: SecureEndpointUrlSchema.describe(
      'OAuth authorization endpoint URL.',
    ),
    token_url: SecureEndpointUrlSchema.describe('OAuth token endpoint URL.'),
    userinfo_url: SecureEndpointUrlSchema.nullable().describe(
      'OAuth userinfo endpoint URL.',
    ),
    jwks_url: JwksUrlSchema.optional(),
    issuer: z
      .string()
      .url()
      .optional()
      .describe('Expected issuer for ID tokens verified with JWKS.'),
    email_url: SecureEndpointUrlSchema.optional().describe(
      'Separate endpoint URL for fetching user email.',
    ),
    scopes: z
      .array(z.string())
      .describe('OAuth scopes to request from the provider.'),
    response_mode: z
      .string()
      .optional()
      .describe('OAuth response mode for the authorization callback.'),
    email_conflict_strategy: z
      .enum(['auto_link', 'require_link'])
      .describe(
        'Strategy when a matching email already exists. ' +
          '"auto_link" links automatically, "require_link" requires user confirmation.',
      ),
    userinfo_mapping: UserinfoMappingConfigSchema,
  })
  .superRefine((provider, ctx) => {
    if (
      provider.type === 'generic_oauth' &&
      provider.userinfo_url === null &&
      provider.jwks_url &&
      !provider.issuer
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['issuer'],
        message:
          'Issuer is required for generic ID-token-only providers with JWKS.',
      });
    }
  })
  .strict()
  .describe('Resolved identity provider configuration.');

export type IdentityProviderConfig = z.infer<
  typeof IdentityProviderConfigSchema
>;

export const IDENTITY_PROVIDER_CONFIGS_DEFAULT: IdentityProviderConfig[] = [];

export const IdentityProviderConfigsSchema = z
  .array(IdentityProviderConfigSchema)
  .default(IDENTITY_PROVIDER_CONFIGS_DEFAULT)
  .describe('List of resolved identity provider configurations.');
