import { buildRouteMap } from '@stricli/core';
import { exportOpenapiCommand } from './openapi.js';

export const exportCommand = buildRouteMap({
  routes: {
    openapi: exportOpenapiCommand,
  },
  docs: {
    brief: 'Export TinyAuth artifacts',
    fullDescription: 'Export TinyAuth artifacts',
  },
});

export default exportCommand;
