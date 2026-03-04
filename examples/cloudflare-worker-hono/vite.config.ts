import path from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isTest = mode === 'test';

  return {
    plugins: isTest ? [] : [cloudflare()],
    resolve: {
      alias: [
        ...(isTest
          ? [
              {
                find: '@tinyauth/backend/config',
                replacement: path.resolve(
                  __dirname,
                  '../../packages/backend/src/lib/config/index.ts',
                ),
              },
              {
                find: '@tinyauth/backend/routing',
                replacement: path.resolve(
                  __dirname,
                  '../../packages/backend/src/routing.ts',
                ),
              },
              {
                find: '@tinyauth/backend',
                replacement: path.resolve(
                  __dirname,
                  '../../packages/backend/src/index.ts',
                ),
              },
              {
                find: /^#backend\/(.*)$/,
                replacement: `${path.resolve(
                  __dirname,
                  '../../packages/backend/src',
                )}/$1`,
              },
            ]
          : []),
        {
          find: '@node-rs/argon2',
          replacement: path.resolve(__dirname, './src/shims/argon2.ts'),
        },
        {
          find: 'nodemailer',
          replacement: path.resolve(__dirname, './src/shims/nodemailer.ts'),
        },
      ],
      conditions: [
        ...(isTest ? ['@tinyauth/source'] : []),
        'workerd',
        'worker',
        'browser',
        'module',
        'development|production',
      ],
    },
    build: {
      rollupOptions: {
        external: ['cloudflare:sockets'],
      },
    },
  };
});
