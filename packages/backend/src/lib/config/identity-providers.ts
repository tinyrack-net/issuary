import z from 'zod';

const UserinfoMappingConfigSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    email_verified: z.string().optional(),
    name: z.string().optional(),
    picture: z.string().optional(),
  })
  .strict();

export const IdentityProviderConfigSchema = z
  .object({
    id: z.string(),
    type: z.enum(['github', 'google', 'apple', 'generic_oauth']),
    enabled: z.boolean(),
    display_name: z.string(),
    icon_url: z.string().optional(),
    client_id: z.string(),
    client_secret: z.string(),
    authorization_url: z.string(),
    token_url: z.string(),
    userinfo_url: z.string().nullable(),
    email_url: z.string().optional(),
    scopes: z.array(z.string()),
    response_mode: z.string().optional(),
    email_conflict_strategy: z.enum(['auto_link', 'require_link']),
    userinfo_mapping: UserinfoMappingConfigSchema,
  })
  .strict();

export type IdentityProviderConfig = z.infer<
  typeof IdentityProviderConfigSchema
>;

export const IDENTITY_PROVIDER_CONFIGS_DEFAULT: IdentityProviderConfig[] = [];

export const IdentityProviderConfigsSchema = z
  .array(IdentityProviderConfigSchema)
  .default(IDENTITY_PROVIDER_CONFIGS_DEFAULT);
