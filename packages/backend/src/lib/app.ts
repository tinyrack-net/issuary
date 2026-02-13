import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AuthHelper } from '@/middleware/auth.js';
import type { SessionHelper } from '@/middleware/session.js';
import type { ServerOptions, ServiceContainer } from '@/services/container.js';

export type AppVariables = {
  services: ServiceContainer;
  session: SessionHelper;
  auth: AuthHelper;
  serverOptions: ServerOptions;
};

export type AppEnv = { Variables: AppVariables };

export type AppType = OpenAPIHono<AppEnv>;
