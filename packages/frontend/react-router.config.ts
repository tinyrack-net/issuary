import path from 'node:path';
import type { Config } from '@react-router/dev/config';

export default {
  appDirectory: 'src',
  buildDirectory: path.resolve(import.meta.dirname, '../server/frontend'),
  routeDiscovery: { mode: 'initial' },
  ssr: true,
} satisfies Config;
