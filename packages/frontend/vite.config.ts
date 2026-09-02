import path from 'node:path';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const SERVER_CONTEXT_MODULE =
  '@tinyrack/issuary-server/internal/frontend-runtime-context';

export default defineConfig(({ command }) => {
  return {
    plugins: [reactRouter(), tailwindcss()],
    build: {
      emptyOutDir: true,
      sourcemap: false,
    },
    ssr: {
      external: [SERVER_CONTEXT_MODULE],
      ...(command === 'build' ? { noExternal: true } : {}),
      resolve: {
        externalConditions: ['node', 'module-sync'],
      },
    },
    resolve: {
      alias: {
        '#frontend': path.resolve(import.meta.dirname, 'src'),
        '#frontend-e2e': path.resolve(import.meta.dirname, 'e2e'),
      },
    },
  };
});
