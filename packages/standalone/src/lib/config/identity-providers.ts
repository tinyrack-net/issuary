import z from 'zod';
import { StandaloneBooleanSchema } from './coerce.js';

const StandaloneGithubIdentityProviderConfigSchema = z
  .object({
    id: z.string().min(1).describe('Unique identifier for this provider.'),
    type: z.literal('github').describe('Identity provider type: GitHub.'),
    enabled: StandaloneBooleanSchema.default(false).describe(
      'Whether this identity provider is enabled.',
    ),
    display_name: z
      .string()
      .optional()
      .describe('Display name shown on the login page.'),
    icon_url: z
      .string()
      .optional()
      .describe('URL to the provider icon shown on the login page.'),
    client_id: z.string().min(1).describe('OAuth client ID from the provider.'),
    client_secret: z
      .string()
      .min(1)
      .describe('OAuth client secret from the provider.'),
    scopes: z
      .array(z.string())
      .optional()
      .describe('OAuth scopes to request from the provider.'),
    email_conflict_strategy: z
      .enum(['auto_link', 'require_link'])
      .default('auto_link')
      .describe(
        'Strategy when a matching email already exists. ' +
          '"auto_link" links automatically, "require_link" requires user confirmation.',
      ),
  })
  .strict()
  .describe('GitHub identity provider configuration.');

const StandaloneGoogleIdentityProviderConfigSchema = z
  .object({
    id: z.string().min(1).describe('Unique identifier for this provider.'),
    type: z.literal('google').describe('Identity provider type: Google.'),
    enabled: StandaloneBooleanSchema.default(false).describe(
      'Whether this identity provider is enabled.',
    ),
    display_name: z
      .string()
      .optional()
      .describe('Display name shown on the login page.'),
    icon_url: z
      .string()
      .optional()
      .describe('URL to the provider icon shown on the login page.'),
    client_id: z.string().min(1).describe('OAuth client ID from the provider.'),
    client_secret: z
      .string()
      .min(1)
      .describe('OAuth client secret from the provider.'),
    scopes: z
      .array(z.string())
      .optional()
      .describe('OAuth scopes to request from the provider.'),
    email_conflict_strategy: z
      .enum(['auto_link', 'require_link'])
      .default('auto_link')
      .describe(
        'Strategy when a matching email already exists. ' +
          '"auto_link" links automatically, "require_link" requires user confirmation.',
      ),
  })
  .strict()
  .describe('Google identity provider configuration.');

const StandaloneAppleIdentityProviderConfigSchema = z
  .object({
    id: z.string().min(1).describe('Unique identifier for this provider.'),
    type: z.literal('apple').describe('Identity provider type: Apple.'),
    enabled: StandaloneBooleanSchema.default(false).describe(
      'Whether this identity provider is enabled.',
    ),
    display_name: z
      .string()
      .optional()
      .describe('Display name shown on the login page.'),
    icon_url: z
      .string()
      .optional()
      .describe('URL to the provider icon shown on the login page.'),
    client_id: z.string().min(1).describe('OAuth client ID from the provider.'),
    client_secret: z
      .string()
      .min(1)
      .describe('OAuth client secret from the provider.'),
    scopes: z
      .array(z.string())
      .optional()
      .describe('OAuth scopes to request from the provider.'),
    response_mode: z
      .enum(['query', 'fragment', 'form_post'])
      .optional()
      .describe('OAuth response mode for the authorization callback.'),
    email_conflict_strategy: z
      .enum(['auto_link', 'require_link'])
      .default('auto_link')
      .describe(
        'Strategy when a matching email already exists. ' +
          '"auto_link" links automatically, "require_link" requires user confirmation.',
      ),
  })
  .strict()
  .describe('Apple identity provider configuration.');

const StandaloneGenericIdentityProviderConfigSchema = z
  .object({
    id: z.string().min(1).describe('Unique identifier for this provider.'),
    type: z
      .literal('generic_oauth')
      .describe('Identity provider type: generic OAuth.'),
    enabled: StandaloneBooleanSchema.default(false).describe(
      'Whether this identity provider is enabled.',
    ),
    display_name: z
      .string()
      .min(1)
      .describe('Display name shown on the login page.'),
    icon_url: z
      .string()
      .optional()
      .describe('URL to the provider icon shown on the login page.'),
    client_id: z.string().min(1).describe('OAuth client ID from the provider.'),
    client_secret: z
      .string()
      .min(1)
      .describe('OAuth client secret from the provider.'),
    authorization_url: z.url().describe('OAuth authorization endpoint URL.'),
    token_url: z.url().describe('OAuth token endpoint URL.'),
    userinfo_url: z.url().nullish().describe('OAuth userinfo endpoint URL.'),
    email_url: z
      .url()
      .optional()
      .describe('Separate endpoint URL for fetching user email.'),
    scopes: z
      .array(z.string())
      .min(1)
      .describe('OAuth scopes to request from the provider.'),
    response_mode: z
      .enum(['query', 'fragment', 'form_post'])
      .optional()
      .describe('OAuth response mode for the authorization callback.'),
    email_conflict_strategy: z
      .enum(['auto_link', 'require_link'])
      .default('auto_link')
      .describe(
        'Strategy when a matching email already exists. ' +
          '"auto_link" links automatically, "require_link" requires user confirmation.',
      ),
    userinfo_mapping: z
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
          .describe(
            'Field name for the display name in the userinfo response.',
          ),
        picture: z
          .string()
          .optional()
          .describe(
            'Field name for the profile picture URL in the userinfo response.',
          ),
      })
      .strict()
      .describe('Mapping of userinfo response fields to user attributes.'),
  })
  .strict()
  .describe('Generic OAuth identity provider configuration.');

export const StandaloneIdentityProviderConfigSchema = z.discriminatedUnion(
  'type',
  [
    StandaloneGithubIdentityProviderConfigSchema,
    StandaloneGoogleIdentityProviderConfigSchema,
    StandaloneAppleIdentityProviderConfigSchema,
    StandaloneGenericIdentityProviderConfigSchema,
  ],
);

export const StandaloneIdentityProviderConfigsSchema = z
  .array(StandaloneIdentityProviderConfigSchema)
  .default([])
  .describe('List of external identity provider configurations.');

export type StandaloneIdentityProviderConfig = z.infer<
  typeof StandaloneIdentityProviderConfigSchema
>;
