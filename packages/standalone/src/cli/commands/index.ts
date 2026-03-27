import { buildRouteMap } from '@stricli/core';
import { cleanupCommand } from './cleanup.js';
import { exportCommand } from './export/index.js';
import { serveCommand } from './serve.js';

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
