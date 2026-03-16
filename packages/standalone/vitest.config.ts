import { fileURLToPath } from 'node:url';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      {
        find: /^@tinyauth\/backend$/,
        replacement: fileURLToPath(
          new URL('../backend/src/entrypoints/index.ts', import.meta.url),
        ),
      },
      {
        find: /^@tinyauth\/backend\/config$/,
        replacement: fileURLToPath(
          new URL(
            '../backend/src/entrypoints/config/index.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyauth\/backend\/services$/,
        replacement: fileURLToPath(
          new URL('../backend/src/entrypoints/services.ts', import.meta.url),
        ),
      },
      {
        find: /^@tinyauth\/backend\/database\/postgres$/,
        replacement: fileURLToPath(
          new URL(
            '../backend/src/entrypoints/database/postgres/postgres.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyauth\/backend\/database\/sqlite$/,
        replacement: fileURLToPath(
          new URL(
            '../backend/src/entrypoints/database/sqlite/sqlite.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyauth\/backend\/identity-providers\/apple$/,
        replacement: fileURLToPath(
          new URL(
            '../backend/src/entrypoints/identity-providers/apple.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyauth\/backend\/identity-providers\/generic-oauth$/,
        replacement: fileURLToPath(
          new URL(
            '../backend/src/entrypoints/identity-providers/generic-oauth.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyauth\/backend\/identity-providers\/github$/,
        replacement: fileURLToPath(
          new URL(
            '../backend/src/entrypoints/identity-providers/github.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyauth\/backend\/identity-providers\/google$/,
        replacement: fileURLToPath(
          new URL(
            '../backend/src/entrypoints/identity-providers/google.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyauth\/backend\/mail\/nodemailer$/,
        replacement: fileURLToPath(
          new URL(
            '../backend/src/entrypoints/mail/nodemailer.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyauth\/backend\/scheduler\/croner$/,
        replacement: fileURLToPath(
          new URL(
            '../backend/src/entrypoints/scheduler/croner.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyauth\/backend\/frontend$/,
        replacement: fileURLToPath(
          new URL(
            '../backend/src/entrypoints/frontend/index.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyauth\/backend\/frontend\/proxy$/,
        replacement: fileURLToPath(
          new URL(
            '../backend/src/entrypoints/frontend/proxy.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyauth\/backend\/frontend\/static$/,
        replacement: fileURLToPath(
          new URL(
            '../backend/src/entrypoints/frontend/static.ts',
            import.meta.url,
          ),
        ),
      },
    ],
    conditions: ['@tinyauth/source'],
  },
  test: {
    maxWorkers: '90%',
    testTimeout: 20000,
    exclude: ['./dist/*', './node_modules/*'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
