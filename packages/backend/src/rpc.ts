/**
 * RPC type entry point.
 *
 * This file re-exports the route types needed
 * by the Hono RPC client in the frontend.
 * It uses relative imports (not @/ alias) so
 * external packages can resolve the types without
 * needing the backend's path alias configuration.
 */
export type { AppType as AppRouteType } from './app.js';
