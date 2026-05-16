import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { e } from '../schemas/error.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const OAUTH_PROVIDER_CALLBACK_PATTERN = /^\/api\/oauth\/[^/]+\/callback$/;

function normalizeOrigin(value: string): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function isOAuthProviderCallback(path: string): boolean {
  return OAUTH_PROVIDER_CALLBACK_PATTERN.test(path);
}

export function csrfProtection(publicOrigin: string) {
  const trustedOrigin = normalizeOrigin(publicOrigin);

  return createMiddleware(async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) {
      await next();
      return;
    }

    if (isOAuthProviderCallback(c.req.path)) {
      await next();
      return;
    }

    if (!getCookie(c, 'session')) {
      await next();
      return;
    }

    const requestOrigin = c.req.header('Origin');
    if (
      requestOrigin &&
      trustedOrigin &&
      normalizeOrigin(requestOrigin) === trustedOrigin
    ) {
      await next();
      return;
    }

    const fetchSite = c.req.header('Sec-Fetch-Site');
    if (!requestOrigin && fetchSite === 'same-origin') {
      await next();
      return;
    }

    if (!requestOrigin && !fetchSite && !c.req.header('User-Agent')) {
      await next();
      return;
    }

    throw new e.CsrfViolation.Error();
  });
}
