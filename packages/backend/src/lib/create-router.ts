import type { AppEnv } from '@backend/lib/app.js';
import { e } from '@backend/schemas/error.js';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

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
