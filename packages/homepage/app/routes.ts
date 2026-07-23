import { resolve } from 'node:path';

import { createDocsRoutes } from '@tinyrack/docs/react-router';

import config from '../docs.config.js';

export default createDocsRoutes(config, {
  root: resolve(import.meta.dirname, '..'),
});
