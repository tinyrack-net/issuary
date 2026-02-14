import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AuthEnv } from '@/middleware/auth.js';
import type { ServicesEnv } from '@/middleware/services.js';
import type { SessionEnv } from '@/middleware/session.js';

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

export type AppType = OpenAPIHono<AppEnv>;
