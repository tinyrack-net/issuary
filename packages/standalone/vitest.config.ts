import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: '#server',
        replacement: fileURLToPath(new URL('../server/src', import.meta.url)),
      },
      {
        find: /^@tinyrack\/issuary-server$/,
        replacement: fileURLToPath(
          new URL('../server/src/entrypoints/index.ts', import.meta.url),
        ),
      },
      {
        find: /^@tinyrack\/issuary-server\/config$/,
        replacement: fileURLToPath(
          new URL('../server/src/entrypoints/config/index.ts', import.meta.url),
        ),
      },
      {
        find: /^@tinyrack\/issuary-server\/services$/,
        replacement: fileURLToPath(
          new URL('../server/src/entrypoints/services.ts', import.meta.url),
        ),
      },
      {
        find: /^@tinyrack\/issuary-server\/database\/postgres$/,
        replacement: fileURLToPath(
          new URL(
            '../server/src/entrypoints/database/postgres/postgres.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyrack\/issuary-server\/database\/sqlite$/,
        replacement: fileURLToPath(
          new URL(
            '../server/src/entrypoints/database/sqlite/sqlite.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyrack\/issuary-server\/identity-providers\/apple$/,
        replacement: fileURLToPath(
          new URL(
            '../server/src/entrypoints/identity-providers/apple.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyrack\/issuary-server\/identity-providers\/generic-oauth$/,
        replacement: fileURLToPath(
          new URL(
            '../server/src/entrypoints/identity-providers/generic-oauth.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyrack\/issuary-server\/identity-providers\/github$/,
        replacement: fileURLToPath(
          new URL(
            '../server/src/entrypoints/identity-providers/github.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyrack\/issuary-server\/identity-providers\/google$/,
        replacement: fileURLToPath(
          new URL(
            '../server/src/entrypoints/identity-providers/google.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyrack\/issuary-server\/mail\/nodemailer$/,
        replacement: fileURLToPath(
          new URL(
            '../server/src/entrypoints/mail/nodemailer.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyrack\/issuary-server\/scheduler\/croner$/,
        replacement: fileURLToPath(
          new URL(
            '../server/src/entrypoints/scheduler/croner.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyrack\/issuary-server\/scheduler\/database$/,
        replacement: fileURLToPath(
          new URL(
            '../server/src/entrypoints/scheduler/database.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyrack\/issuary-server\/frontend$/,
        replacement: fileURLToPath(
          new URL(
            '../server/src/entrypoints/frontend/index.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyrack\/issuary-server\/frontend\/proxy$/,
        replacement: fileURLToPath(
          new URL(
            '../server/src/entrypoints/frontend/proxy.ts',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^@tinyrack\/issuary-server\/frontend\/static$/,
        replacement: fileURLToPath(
          new URL(
            '../server/src/entrypoints/frontend/static.ts',
            import.meta.url,
          ),
        ),
      },
    ],
    conditions: ['@issuary/source'],
  },
  test: {
    maxWorkers: '100%',
    hookTimeout: 180_000,
    testTimeout: 180_000,
    exclude: ['./dist/*', './node_modules/*'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/cli.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
