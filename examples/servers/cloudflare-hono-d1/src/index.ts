import { type AppType, createApp } from '@tinyauth/backend';
import { d1 } from '@tinyauth/backend/database/d1';
import {
  interpolateHtmlResponse,
  resolveHtmlVariables,
} from '@tinyauth/backend/frontend';

interface Env {
  ASSETS: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
  DB: D1Database;
}

type AppExecutionContext = Parameters<AppType['fetch']>[2];

export default {
  async fetch(request: Request, env: Env, ctx: AppExecutionContext) {
    const { app } = await createApp({
      database: d1({ database: env.DB }),
      security: {
        session_secret:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      },
      frontend: ({ branding, server }) => {
        const htmlVariables = resolveHtmlVariables({
          branding,
          server,
          overrides: {
            TITLE: 'TinyAuth',
            DESCRIPTION: 'OIDC for everyone',
            FAVICON_URL: '/vite.svg',
          },
        });

        return async (c) => {
          const pathname = new URL(c.req.url).pathname;
          const response = await env.ASSETS.fetch(c.req.raw);
          const isHtml =
            response.headers
              .get('content-type')
              ?.toLowerCase()
              .includes('text/html') ?? false;

          if (
            pathname !== '/index.html' &&
            /\/[^/]+\.[^/]+$/.test(pathname) &&
            isHtml
          ) {
            return c.text('Not Found', 404);
          }

          if (c.req.method !== 'GET') {
            return response;
          }

          return interpolateHtmlResponse(response, htmlVariables);
        };
      },
    });

    return app.fetch(request, env, ctx);
  },
};
