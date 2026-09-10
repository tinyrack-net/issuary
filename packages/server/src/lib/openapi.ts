import { describeRoute, resolver } from 'hono-openapi';
import { e } from '../schemas/error.js';
import type { OpenApiConfig } from './config/openapi.ts';

const OPENAPI_INFO_VERSION = '1.0.0';

type OpenApiSecurityRequirements = Array<Record<string, string[]>>;

export const OPENAPI_SECURITY: {
  cookieSession: OpenApiSecurityRequirements;
  optionalCookieSession: OpenApiSecurityRequirements;
  bearer: OpenApiSecurityRequirements;
} = {
  cookieSession: [{ cookieSessionAuth: [] }],
  optionalCookieSession: [{ cookieSessionAuth: [] }, {}],
  bearer: [{ bearerAuth: [] }],
};

export function createOpenApiDocumentation(
  config: Pick<OpenApiConfig, 'title' | 'description'>,
) {
  return {
    info: {
      title: config.title,
      version: OPENAPI_INFO_VERSION,
      description: config.description,
    },
    servers: [{ url: '/' }],
    components: {
      securitySchemes: {
        cookieSessionAuth: {
          type: 'apiKey' as const,
          in: 'cookie' as const,
          name: 'session',
          description:
            'Encrypted locator for a revocable server-side browser session.',
        },
        bearerAuth: {
          type: 'http' as const,
          scheme: 'bearer' as const,
          bearerFormat: 'JWT',
          description:
            'Bearer access token for OAuth 2.0/OIDC protected routes.',
        },
      },
    },
  };
}

export const adminApiDocumentation = describeRoute({
  security: OPENAPI_SECURITY.cookieSession,
  responses: {
    401: {
      description: 'Authentication required',
      content: {
        'application/json': { schema: resolver(e.Unauthorized.Schema) },
      },
    },
    403: {
      description: 'Administrator access required',
      content: { 'application/json': { schema: resolver(e.Forbidden.Schema) } },
    },
  },
});

export const securityMutationDocumentation = describeRoute({
  responses: {
    401: {
      description:
        'Authentication expired or was revoked. Sign in again before making another change.',
      content: {
        'application/json': { schema: resolver(e.Unauthorized.Schema) },
      },
    },
    409: {
      description:
        'Concurrent security change. Refresh the current state; do not automatically replay the mutation.',
      content: {
        'application/json': {
          schema: resolver(e.ConcurrentSecurityChange.Schema),
        },
      },
    },
  },
});
