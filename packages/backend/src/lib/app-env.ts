import type { LoggerEnv } from '#backend/middleware/logger.js';
import type { ServicesEnv } from '#backend/middleware/services.js';
import type { SessionEnv } from '#backend/middleware/session.js';

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
  Variables: LoggerEnv['Variables'] &
    ServicesEnv['Variables'] &
    SessionEnv['Variables'];
};
