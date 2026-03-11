import z from 'zod';
import { zz } from '#backend/schemas/provider.js';

const DeclarativeGithubIdentityProviderConfigSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('github'),
    enabled: zz.COERCE_BOOLEAN.default(false),
    display_name: z.string().optional(),
    icon_url: z.string().optional(),
    client_id: z.string().min(1),
    client_secret: z.string().min(1),
    scopes: z.array(z.string()).optional(),
    email_conflict_strategy: z
      .enum(['auto_link', 'require_link'])
      .default('auto_link'),
  })
  .strict();

const DeclarativeGoogleIdentityProviderConfigSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('google'),
    enabled: zz.COERCE_BOOLEAN.default(false),
    display_name: z.string().optional(),
    icon_url: z.string().optional(),
    client_id: z.string().min(1),
    client_secret: z.string().min(1),
    scopes: z.array(z.string()).optional(),
    email_conflict_strategy: z
      .enum(['auto_link', 'require_link'])
      .default('auto_link'),
  })
  .strict();

const DeclarativeAppleIdentityProviderConfigSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('apple'),
    enabled: zz.COERCE_BOOLEAN.default(false),
    display_name: z.string().optional(),
    icon_url: z.string().optional(),
    client_id: z.string().min(1),
    client_secret: z.string().min(1),
    scopes: z.array(z.string()).optional(),
    response_mode: z.enum(['query', 'fragment', 'form_post']).optional(),
    email_conflict_strategy: z
      .enum(['auto_link', 'require_link'])
      .default('auto_link'),
  })
  .strict();

const DeclarativeGenericIdentityProviderConfigSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('generic_oauth'),
    enabled: zz.COERCE_BOOLEAN.default(false),
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
    userinfo_mapping: z
      .object({
        id: z.string(),
        email: z.string(),
        email_verified: z.string().optional(),
        name: z.string().optional(),
        picture: z.string().optional(),
      })
      .strict(),
  })
  .strict();

export const DeclarativeIdentityProviderConfigSchema = z.discriminatedUnion(
  'type',
  [
    DeclarativeGithubIdentityProviderConfigSchema,
    DeclarativeGoogleIdentityProviderConfigSchema,
    DeclarativeAppleIdentityProviderConfigSchema,
    DeclarativeGenericIdentityProviderConfigSchema,
  ],
);

export const DeclarativeIdentityProviderConfigsSchema = z
  .array(DeclarativeIdentityProviderConfigSchema)
  .default([]);

export type DeclarativeIdentityProviderConfig = z.infer<
  typeof DeclarativeIdentityProviderConfigSchema
>;
