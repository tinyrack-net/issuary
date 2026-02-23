const openApiInfo = {
  title: 'TinyAuth API',
  version: '1.0.0',
  description: 'OpenID Connect Provider API',
};

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

export const OPENAPI_DOCUMENTATION = {
  info: openApiInfo,
  servers: [{ url: '/' }],
  components: {
    securitySchemes: {
      cookieSessionAuth: {
        type: 'apiKey' as const,
        in: 'cookie' as const,
        name: 'session',
        description:
          'Encrypted session cookie issued by TinyAuth after authentication.',
      },
      bearerAuth: {
        type: 'http' as const,
        scheme: 'bearer' as const,
        bearerFormat: 'JWT',
        description: 'Bearer access token for OAuth 2.0/OIDC protected routes.',
      },
    },
  },
};
