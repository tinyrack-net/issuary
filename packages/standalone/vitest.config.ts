import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      {
        find: /^@tinyauth\/backend\/config$/,
        replacement: new URL(
          '../backend/src/lib/config/index.ts',
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@tinyauth\/backend\/logger$/,
        replacement: new URL('../backend/src/lib/logger.ts', import.meta.url)
          .pathname,
      },
      {
        find: /^@tinyauth\/backend\/openapi$/,
        replacement: new URL('../backend/src/lib/openapi.ts', import.meta.url)
          .pathname,
      },
      {
        find: /^@tinyauth\/backend\/routing$/,
        replacement: new URL('../backend/src/routing.ts', import.meta.url)
          .pathname,
      },
      {
        find: /^@tinyauth\/backend\/services$/,
        replacement: new URL(
          '../backend/src/services/container.ts',
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@tinyauth\/backend\/db$/,
        replacement: new URL('../backend/src/db/index.ts', import.meta.url)
          .pathname,
      },
      {
        find: /^@tinyauth\/backend\/database$/,
        replacement: new URL('../backend/src/database.ts', import.meta.url)
          .pathname,
      },
      {
        find: /^@tinyauth\/backend\/mail$/,
        replacement: new URL('../backend/src/mail.ts', import.meta.url)
          .pathname,
      },
      {
        find: /^@tinyauth\/backend$/,
        replacement: new URL('../backend/src/index.ts', import.meta.url)
          .pathname,
      },
    ],
    conditions: ['@tinyauth/source'],
  },
  test: {
    maxWorkers: '90%',
    testTimeout: 20000,
    exclude: ['./dist/*', './node_modules/*'],
  },
});
