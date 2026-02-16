import type { AuthEnv } from '@backend/middleware/auth.js';
import type { ServicesEnv } from '@backend/middleware/services.js';
import type { SessionEnv } from '@backend/middleware/session.js';
import { e } from '@backend/schemas/error.js';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * AppEnv is derived from the intersection of
 * all middleware Env types.
 *
 * Each middleware exports its own Env type
 * declaring which variables it provides.
 * Adding a new middleware variable:
 *   1. Export `XxxEnv` from the middleware file
 *   2. Add it to the intersection below
 */
export type AppEnv = {
  Variables: ServicesEnv['Variables'] &
    SessionEnv['Variables'] &
    AuthEnv['Variables'];
};

/**
 * Create an OpenAPIHono router with shared defaultHook
 * for consistent validation error handling.
 *
 * All sub-routers should use this instead of
 * `new OpenAPIHono<AppEnv>()` directly.
 */
export function createRouter(): OpenAPIHono<AppEnv> {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const zodErr = new e.ValidationError.Error(result.error.message);
        return c.json(zodErr.toJson(), zodErr.status as ContentfulStatusCode);
      }
      return undefined;
    },
  });
}
