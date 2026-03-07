import z from 'zod';

const StandaloneGithubOAuthConfigSchema = z.object({
  id: z.string().min(1),
  type: z.literal('github'),
  enabled: z.boolean().default(false),
  display_name: z.string().optional(),
  icon_url: z.string().optional(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  scopes: z.array(z.string()).optional(),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link'),
});

const StandaloneGoogleOAuthConfigSchema = z.object({
  id: z.string().min(1),
  type: z.literal('google'),
  enabled: z.boolean().default(false),
  display_name: z.string().optional(),
  icon_url: z.string().optional(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  scopes: z.array(z.string()).optional(),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link'),
});

const StandaloneAppleOAuthConfigSchema = z.object({
  id: z.string().min(1),
  type: z.literal('apple'),
  enabled: z.boolean().default(false),
  display_name: z.string().optional(),
  icon_url: z.string().optional(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  scopes: z.array(z.string()).optional(),
  response_mode: z.enum(['query', 'fragment', 'form_post']).optional(),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link'),
});

const StandaloneGenericOAuthConfigSchema = z.object({
  id: z.string().min(1),
  type: z.literal('generic_oauth'),
  enabled: z.boolean().default(false),
  display_name: z.string().min(1),
  icon_url: z.string().optional(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  authorization_url: z.url(),
  token_url: z.url(),
  userinfo_url: z.url().nullish(),
  email_url: z.url().optional(),
  scopes: z.array(z.string()).min(1),
  response_mode: z.enum(['query', 'fragment', 'form_post']).optional(),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link'),
  userinfo_mapping: z.object({
    id: z.string(),
    email: z.string(),
    email_verified: z.string().optional(),
    name: z.string().optional(),
    picture: z.string().optional(),
  }),
});

export const StandaloneIdentityProviderConfigSchema = z.discriminatedUnion(
  'type',
  [
    StandaloneGithubOAuthConfigSchema,
    StandaloneGoogleOAuthConfigSchema,
    StandaloneAppleOAuthConfigSchema,
    StandaloneGenericOAuthConfigSchema,
  ],
);

export const StandaloneIdentityProviderConfigsSchema = z
  .array(StandaloneIdentityProviderConfigSchema)
  .default([]);

export type StandaloneIdentityProviderConfig = z.infer<
  typeof StandaloneIdentityProviderConfigSchema
>;
