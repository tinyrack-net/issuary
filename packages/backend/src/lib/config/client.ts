import z from 'zod';

/**
 * OAuth/OIDC client configuration.
 * Defines applications that can authenticate through TinyAuth.
 */
export const ClientConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo_uri: z.string().optional(),
  client_id: z.string(),
  client_secret: z.string().optional(),
  redirect_uris: z.array(z.string()),
  response_types: z.array(z.string()),
  grant_types: z.array(z.string()),
  scope: z.string(),
});

export type ClientConfig = z.infer<typeof ClientConfigSchema>;
