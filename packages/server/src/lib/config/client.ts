import z from 'zod';
import { isSecureRedirectUri } from './url-policy.js';

const RedirectUriSchema = z.string().refine(isSecureRedirectUri, {
  message:
    'Redirect URI must use HTTPS or local HTTP and must not contain fragments or wildcards.',
});

const WebOriginSchema = z.string().refine(
  (value) => {
    try {
      const url = new URL(value);
      return url.origin === value && isSecureRedirectUri(value);
    } catch {
      return false;
    }
  },
  {
    message:
      'Web origin must be an exact URL origin such as https://app.example or http://localhost:3000, with no path, query, fragment, or trailing slash.',
  },
);

const OAuthResponseTypeSchema = z.string().pipe(z.enum(['code', 'id_token']));
const OAuthGrantTypeSchema = z
  .string()
  .pipe(
    z.enum([
      'authorization_code',
      'implicit',
      'refresh_token',
      'client_credentials',
      'urn:ietf:params:oauth:grant-type:device_code',
    ]),
  );

function normalizeScopeList(scope: string): string {
  const trimmed = scope.trim();
  if (/[\t\n\r\f\v]/.test(trimmed)) {
    return scope;
  }
  return trimmed.split(/ +/).join(' ');
}

const ScopeSchema = z
  .string()
  .transform(normalizeScopeList)
  .pipe(
    z
      .string()
      .min(1)
      .refine(
        (scope) =>
          scope
            .split(' ')
            .every((token) => /^[\x21\x23-\x5B\x5D-\x7E]+$/.test(token)),
        {
          message:
            'Scope must be a space-separated list of valid OAuth scope-token values.',
        },
      ),
  );

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
      .min(1)
      .describe('Human-readable name for the client application.'),
    logo_uri: z
      .string()
      .optional()
      .describe('URL to the client application logo.'),
    client_id: z
      .string()
      .min(1)
      .describe('OAuth client_id used in authorization requests.'),
    client_secret: z
      .string()
      .min(16)
      .optional()
      .describe(
        'OAuth client_secret for confidential clients. Omit for public clients.',
      ),
    redirect_uris: z
      .array(RedirectUriSchema)
      .nonempty()
      .describe('Allowed redirect URIs after authorization.'),
    post_logout_redirect_uris: z
      .array(RedirectUriSchema)
      .default([])
      .describe('Allowed redirect URIs after RP-initiated logout.'),
    web_origins: z
      .array(WebOriginSchema)
      .default([])
      .describe('Allowed browser origins for OAuth CORS requests.'),
    response_types: z
      .array(OAuthResponseTypeSchema)
      .nonempty()
      .describe('Allowed OAuth response types (e.g., "code" or "id_token").'),
    grant_types: z
      .array(OAuthGrantTypeSchema)
      .nonempty()
      .describe(
        'Allowed OAuth grant types (e.g., "authorization_code", "implicit", "refresh_token").',
      ),
    scope: ScopeSchema.describe(
      'Space-separated list of allowed OAuth scope-token values for this client.',
    ),
  })
  .strict()
  .superRefine((client, ctx) => {
    const responseTypes = new Set(client.response_types);
    const grantTypes = new Set(client.grant_types);

    if (responseTypes.has('code') && !grantTypes.has('authorization_code')) {
      ctx.addIssue({
        code: 'custom',
        path: ['grant_types'],
        message:
          'Clients that support response_type "code" must allow grant_type "authorization_code".',
      });
    }

    if (grantTypes.has('authorization_code') && !responseTypes.has('code')) {
      ctx.addIssue({
        code: 'custom',
        path: ['response_types'],
        message:
          'Clients that allow grant_type "authorization_code" must support response_type "code".',
      });
    }

    if (responseTypes.has('id_token') && !grantTypes.has('implicit')) {
      ctx.addIssue({
        code: 'custom',
        path: ['grant_types'],
        message:
          'Clients that support response_type "id_token" must allow grant_type "implicit".',
      });
    }

    if (grantTypes.has('implicit') && !responseTypes.has('id_token')) {
      ctx.addIssue({
        code: 'custom',
        path: ['response_types'],
        message:
          'Clients that allow grant_type "implicit" must support response_type "id_token".',
      });
    }

    if (
      grantTypes.has('refresh_token') &&
      !grantTypes.has('authorization_code')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['grant_types'],
        message:
          'Clients that allow grant_type "refresh_token" must also allow "authorization_code".',
      });
    }

    if (grantTypes.has('client_credentials') && !client.client_secret) {
      ctx.addIssue({
        code: 'custom',
        path: ['client_secret'],
        message:
          'Clients that allow grant_type "client_credentials" must be confidential and define client_secret.',
      });
    }
  })
  .describe('OAuth/OIDC client application configuration.');

export type ClientConfig = z.infer<typeof ClientConfigSchema>;

export const CLIENT_CONFIGS_DEFAULT: ClientConfig[] = [];

export const ClientConfigsSchema = z
  .array(ClientConfigSchema)
  .superRefine((clients, ctx) => {
    const seenIds = new Map<string, number>();
    const seenClientIds = new Map<string, number>();

    clients.forEach((client, index) => {
      const firstIdIndex = seenIds.get(client.id);
      if (firstIdIndex !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: `OAuth client id must be unique. Duplicate value also appears at clients.${firstIdIndex}.id.`,
        });
      } else {
        seenIds.set(client.id, index);
      }

      const firstClientIdIndex = seenClientIds.get(client.client_id);
      if (firstClientIdIndex !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'client_id'],
          message: `OAuth client client_id must be unique. Duplicate value also appears at clients.${firstClientIdIndex}.client_id.`,
        });
      } else {
        seenClientIds.set(client.client_id, index);
      }
    });
  })
  .default(CLIENT_CONFIGS_DEFAULT)
  .describe('List of registered OAuth/OIDC client applications.');
