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
        find: /^@tinyauth\/backend\/services$/,
        replacement: new URL(
          '../backend/src/services/container.ts',
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@tinyauth\/backend\/database\/postgres$/,
        replacement: new URL(
          '../backend/src/entries/database/postgres.ts',
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@tinyauth\/backend\/database\/sqlite$/,
        replacement: new URL(
          '../backend/src/entries/database/sqlite.ts',
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@tinyauth\/backend\/mail$/,
        replacement: new URL('../backend/src/entries/mail.ts', import.meta.url)
          .pathname,
      },
      {
        find: /^@tinyauth\/backend\/identity-providers\/github$/,
        replacement: new URL(
          '../backend/src/entries/identity-providers/github.ts',
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@tinyauth\/backend\/identity-providers\/google$/,
        replacement: new URL(
          '../backend/src/entries/identity-providers/google.ts',
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@tinyauth\/backend\/identity-providers\/apple$/,
        replacement: new URL(
          '../backend/src/entries/identity-providers/apple.ts',
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@tinyauth\/backend\/identity-providers\/generic-oauth$/,
        replacement: new URL(
          '../backend/src/entries/identity-providers/generic-oauth.ts',
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@tinyauth\/backend$/,
        replacement: new URL('../backend/src/entries/index.ts', import.meta.url)
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
