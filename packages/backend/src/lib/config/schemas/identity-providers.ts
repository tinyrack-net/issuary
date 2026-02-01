import z from 'zod/v4';

/**
 * GitHub OAuth provider schema.
 * Uses pre-configured endpoints from WELL_KNOWN_OAUTH_PROVIDERS.
 */
export const GithubOAuthSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this OAuth provider'),
  type: z.literal('github'),
  enabled: z.boolean().default(false),
  display_name: z.string().optional().describe('Display name shown in UI'),
  icon_url: z.string().optional().describe('Icon URL shown in UI'),
  client_id: z.string().min(1).describe('OAuth client ID'),
  client_secret: z.string().min(1).describe('OAuth client secret'),
  scopes: z
    .array(z.string())
    .optional()
    .describe('OAuth scopes (defaults to provider defaults)'),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link')
    .describe('Email conflict resolution strategy'),
});

export type GithubOAuthSchema = z.infer<typeof GithubOAuthSchema>;

/**
 * Google OAuth provider schema.
 * Uses pre-configured endpoints from WELL_KNOWN_OAUTH_PROVIDERS.
 */
export const GoogleOAuthSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this OAuth provider'),
  type: z.literal('google'),
  enabled: z.boolean().default(false),
  display_name: z.string().optional().describe('Display name shown in UI'),
  icon_url: z.string().optional().describe('Icon URL shown in UI'),
  client_id: z.string().min(1).describe('OAuth client ID'),
  client_secret: z.string().min(1).describe('OAuth client secret'),
  scopes: z
    .array(z.string())
    .optional()
    .describe('OAuth scopes (defaults to provider defaults)'),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link')
    .describe('Email conflict resolution strategy'),
});

export type GoogleOAuthSchema = z.infer<typeof GoogleOAuthSchema>;

/**
 * Apple OAuth provider schema.
 * Uses pre-configured endpoints from WELL_KNOWN_OAUTH_PROVIDERS.
 * Apple uses form_post response mode by default.
 */
export const AppleOAuthSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this OAuth provider'),
  type: z.literal('apple'),
  enabled: z.boolean().default(false),
  display_name: z.string().optional().describe('Display name shown in UI'),
  icon_url: z.string().optional().describe('Icon URL shown in UI'),
  client_id: z.string().min(1).describe('OAuth client ID'),
  client_secret: z.string().min(1).describe('OAuth client secret'),
  scopes: z
    .array(z.string())
    .optional()
    .describe('OAuth scopes (defaults to provider defaults)'),
  response_mode: z
    .enum(['query', 'fragment', 'form_post'])
    .optional()
    .describe('Response mode (defaults to form_post for Apple)'),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link')
    .describe('Email conflict resolution strategy'),
});

export type AppleOAuthSchema = z.infer<typeof AppleOAuthSchema>;

/**
 * Generic OAuth provider schema for custom OAuth providers.
 * Requires all endpoint URLs and userinfo mapping to be specified.
 */
export const GenericOAuthSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this OAuth provider'),
  type: z.literal('generic_oauth'),
  enabled: z.boolean().default(false),
  display_name: z.string().min(1).describe('Display name shown in UI'),
  icon_url: z.string().optional().describe('Icon URL shown in UI'),
  client_id: z.string().min(1).describe('OAuth client ID'),
  client_secret: z.string().min(1).describe('OAuth client secret'),
  authorization_url: z.url().describe('Authorization endpoint URL'),
  token_url: z.url().describe('Token endpoint URL'),
  userinfo_url: z.url().nullish().describe('UserInfo endpoint URL'),
  email_url: z
    .url()
    .optional()
    .describe('Additional URL for fetching email (e.g., GitHub)'),
  scopes: z.array(z.string()).min(1).describe('OAuth scopes to request'),
  response_mode: z
    .enum(['query', 'fragment', 'form_post'])
    .optional()
    .describe('Response mode'),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link')
    .describe('Email conflict resolution strategy'),
  userinfo_mapping: z
    .object({
      id: z.string().describe('Field name for user ID'),
      email: z.string().describe('Field name for email'),
      email_verified: z
        .string()
        .optional()
        .describe('Field name for email_verified'),
      name: z.string().optional().describe('Field name for name'),
      picture: z.string().optional().describe('Field name for picture'),
    })
    .describe('Mapping from provider userinfo response to standard fields'),
});

export type GenericOAuthSchema = z.infer<typeof GenericOAuthSchema>;

/**
 * Identity provider configuration.
 * Discriminated union based on 'type' field.
 * Well-known providers (github, google, apple) use pre-configured endpoints.
 * Generic OAuth requires all endpoints to be specified.
 */
export const AppConfigIdentityProvider = z.discriminatedUnion('type', [
  GithubOAuthSchema,
  GoogleOAuthSchema,
  AppleOAuthSchema,
  GenericOAuthSchema,
]);

export type AppConfigIdentityProvider = z.infer<
  typeof AppConfigIdentityProvider
>;

/**
 * Identity providers configuration.
 * Array of external OAuth/OIDC provider configurations for social login.
 */
export const AppConfigIdentityProviders = z
  .array(AppConfigIdentityProvider)
  .default([]);

export type AppConfigIdentityProviders = z.infer<
  typeof AppConfigIdentityProviders
>;
