import type { Context, Next } from 'hono';
import type { AppEnv } from '../../lib/app-env.js';

type OAuthCorsClient = {
  webOrigins: string[];
};

const PUBLIC_METADATA_PATHS = [
  '/oauth/.well-known/openid-configuration',
  '/oauth/.well-known/jwks',
];

const PREFLIGHT_METHODS_BY_PATH = new Map<string, string[]>([
  ['/oauth/token', ['POST']],
  ['/oauth/revoke', ['POST']],
  ['/oauth/userinfo', ['GET', 'POST']],
]);

export async function oauthCorsMiddleware(
  c: Context<AppEnv>,
  next: Next,
): Promise<Response | undefined> {
  if (c.req.method === 'OPTIONS') {
    return handleOAuthPreflight(c);
  }

  await next();

  if (isPublicMetadataPath(c.req.path) && c.req.header('origin')) {
    c.res.headers.delete('Access-Control-Allow-Credentials');
    c.header('Access-Control-Allow-Origin', '*');
  }

  return undefined;
}

export function setOAuthClientCorsHeaders(
  c: Context<AppEnv>,
  client: OAuthCorsClient,
): void {
  const origin = c.req.header('origin');
  c.res.headers.delete('Access-Control-Allow-Origin');
  c.res.headers.delete('Access-Control-Allow-Credentials');

  if (!origin) {
    return;
  }

  c.header('Vary', 'Origin', { append: true });
  if (!client.webOrigins.includes(origin)) {
    return;
  }

  c.header('Access-Control-Allow-Origin', origin);
}

async function handleOAuthPreflight(c: Context<AppEnv>) {
  const origin = c.req.header('origin');
  const allowedMethods = PREFLIGHT_METHODS_BY_PATH.get(c.req.path);
  if (origin && allowedMethods) {
    const { oauthClientService } = c.var.services;
    if (await oauthClientService.isAllowedWebOrigin(origin)) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Vary', 'Origin');
      c.header('Access-Control-Allow-Methods', allowedMethods.join(', '));
      const requestHeaders = c.req.header('access-control-request-headers');
      if (requestHeaders) {
        c.header('Access-Control-Allow-Headers', requestHeaders);
        c.header('Vary', 'Access-Control-Request-Headers', { append: true });
      }
    }
  }

  return c.body(null, 204);
}

function isPublicMetadataPath(path: string): boolean {
  return PUBLIC_METADATA_PATHS.includes(path);
}
