import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isTest = mode === 'test';

  return {
    plugins: isTest ? [] : [cloudflare()],
    resolve: {
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
