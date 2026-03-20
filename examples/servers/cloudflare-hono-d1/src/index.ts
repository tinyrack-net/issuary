import {
  type AppType,
  type CreateAppOptions,
  createApp,
} from '@tinyauth/backend';
import { d1 } from '@tinyauth/backend/database/d1';
import { createCloudflareAssetsHandler } from '@tinyauth/backend/frontend/cloudflare';

interface Env {
  ASSETS: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
  DB: D1Database;
}

type AppExecutionContext = Parameters<AppType['fetch']>[2];

function createWorkerOptions(request: Request, env: Env): CreateAppOptions {
  return {
    server: {
      public_origin: new URL(request.url).origin,
    },
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
      email_verification_required: false,
    },
    database: d1({ database: env.DB }),
    logging: {
      level: 'info',
      format: 'json',
    },
    security: {
      session_secret:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
    },
    frontend: createCloudflareAssetsHandler({
      assets: env.ASSETS,
      htmlVariables: {
        TITLE: 'TinyAuth',
        DESCRIPTION: 'OIDC for everyone',
        FAVICON_URL: '/vite.svg',
      },
    }),
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: AppExecutionContext) {
    const { app } = await createApp(createWorkerOptions(request, env));

    return app.fetch(request, env, ctx);
  },
};
