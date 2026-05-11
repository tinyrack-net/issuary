import z from 'zod';

/**
 * OAuth/OIDC client configuration.
 * Defines applications that can authenticate through TinyAuth.
 */
export const ClientConfigSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(255)
      .describe('Internal identifier for the client.'),
    name: z
      .string()
      .describe('Human-readable name for the client application.'),
    logo_uri: z
      .string()
      .optional()
      .describe('URL to the client application logo.'),
    client_id: z
      .string()
      .describe('OAuth client_id used in authorization requests.'),
    client_secret: z
      .string()
      .optional()
      .describe(
        'OAuth client_secret for confidential clients. Omit for public clients.',
      ),
    redirect_uris: z
      .array(z.string())
      .describe('Allowed redirect URIs after authorization.'),
    response_types: z
      .array(z.string())
      .describe('Allowed OAuth response types (e.g., "code").'),
    grant_types: z
      .array(z.string())
      .describe(
        'Allowed OAuth grant types (e.g., "authorization_code", "refresh_token").',
      ),
    scope: z
      .string()
      .describe('Space-separated list of allowed scopes for this client.'),
  })
  .strict()
  .describe('OAuth/OIDC client application configuration.');

export type ClientConfig = z.infer<typeof ClientConfigSchema>;

export const CLIENT_CONFIGS_DEFAULT: ClientConfig[] = [];

export const ClientConfigsSchema = z
  .array(ClientConfigSchema)
  .default(CLIENT_CONFIGS_DEFAULT)
  .describe('List of registered OAuth/OIDC client applications.');
