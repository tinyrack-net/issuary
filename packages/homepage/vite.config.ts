import tailwindcss from '@tailwindcss/vite';
import { tinyrackDocs } from '@tinyrack/docs/vite';
import { defineConfig } from 'vite';

import config from './docs.config.js';

export default defineConfig({
  build: { chunkSizeWarningLimit: 5_000 },
  plugins: [
    ...tinyrackDocs(config, { root: import.meta.dirname }),
    tailwindcss(),
  ],
  server: {
    allowedHosts: true,
    host: '0.0.0.0',
    port: 8082,
    strictPort: true,
  },
});
