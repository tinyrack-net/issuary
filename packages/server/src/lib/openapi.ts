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
            'Encrypted session cookie issued by Issuary after authentication.',
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
