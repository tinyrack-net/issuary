import { buildRouteMap } from '@stricli/core';
import { cleanupCommand } from './cleanup.ts';
import { exportCommand } from './export/index.ts';
import { serveCommand } from './serve.ts';

export const commands = buildRouteMap({
  routes: {
    cleanup: cleanupCommand,
    export: exportCommand,
    serve: serveCommand,
  },
  docs: {
    brief: 'TinyAuth standalone CLI server',
    fullDescription: 'TinyAuth standalone CLI server',
  },
});

export default commands;
