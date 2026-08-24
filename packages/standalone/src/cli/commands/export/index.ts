import { buildRouteMap } from '@stricli/core';
import { exportOpenapiCommand } from './openapi.ts';

export const exportCommand = buildRouteMap({
  routes: {
    openapi: exportOpenapiCommand,
  },
  docs: {
    brief: 'Export Issuary artifacts',
    fullDescription: 'Export Issuary artifacts',
  },
});

export default exportCommand;
