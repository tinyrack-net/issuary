import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import type { AppEnv } from '../lib/app-env.js';
import { requestIp } from '../lib/request-ip.js';
import { e } from '../schemas/error.js';
import {
  clearAuthBudget,
  consumeAuthBudget,
} from '../services/auth-budget.service.js';

const EMAIL_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/password/forgot',
  '/api/auth/email/resend',
]);
const OTP_PATHS = new Set([
  '/api/auth/totp/verify',
  '/api/auth/totp/recovery/verify',
  '/api/user/totp/verify',
  '/api/user/totp/recovery/regenerate',
  '/api/user/totp',
]);

export const authBudget = createMiddleware<AppEnv>(async (c, next) => {
  const path = c.req.path;
  const requestedAt = Date.now();
  if (!['POST', 'PUT', 'DELETE'].includes(c.req.method)) return next();
  const peer = requestIp(
    c.env,
    c.req.header('x-forwarded-for'),
    c.var.services.config.server.trust_proxy,
  );
  const sensitive =
    path.startsWith('/api/auth/') ||
    path.startsWith('/api/user/') ||
    path.startsWith('/oauth/');
  if (peer && sensitive) {
    const retryAfter = await consumeAuthBudget(
      c.var.services.mikro,
      c.var.services.securityService,
      `source:${peer}`,
      600,
      60,
    );
    if (retryAfter !== null) {
      c.header('Retry-After', String(retryAfter));
      throw new e.TooManyRequests.Error();
    }
  }
  let key: string | undefined;
  let limit = 20;
  let windowSeconds = 600;
  if (EMAIL_PATHS.has(path)) {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return next();
    }
    const input = z.object({ email: z.email().max(320) }).safeParse(body);
    if (input.success) {
      key = `${path}:${input.data.email.toLowerCase()}`;
      if (path.endsWith('/resend') || path.endsWith('/forgot')) {
        limit = 3;
        windowSeconds = 60;
      }
    }
  } else if (OTP_PATHS.has(path)) {
    const subject = path.startsWith('/api/auth/')
      ? c.var.session.get('pending2FAUser')?.sub
      : path === '/api/user/totp/verify'
        ? (c.var.session.get('pending2FASetup')?.sub ??
          c.var.session.get('user')?.sub)
        : c.var.session.get('user')?.sub;
    if (subject) {
      key = `otp:${subject}`;
      limit = 10;
      windowSeconds = 300;
    }
  }
  if (key) {
    const retryAfter = await consumeAuthBudget(
      c.var.services.mikro,
      c.var.services.securityService,
      key,
      limit,
      windowSeconds,
    );
    if (retryAfter !== null) {
      c.header('Retry-After', String(retryAfter));
      throw new e.TooManyRequests.Error();
    }
  }
  await next();
  if (key && path === '/api/auth/login' && c.res.status === 200) {
    await clearAuthBudget(
      c.var.services.mikro,
      c.var.services.securityService,
      key,
      windowSeconds,
      requestedAt,
    );
  }
});
