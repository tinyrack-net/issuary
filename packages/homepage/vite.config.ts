import { tinyrackDocs } from '@tinyrack/docs/vite';
import { defineConfig } from 'vite';

import config from './docs.config.ts';

export default defineConfig({
  build: { chunkSizeWarningLimit: 5_000 },
  plugins: tinyrackDocs(config, { root: import.meta.dirname }),
  server: {
    allowedHosts: true,
    host: '0.0.0.0',
    port: 8082,
    strictPort: true,
  },
});
