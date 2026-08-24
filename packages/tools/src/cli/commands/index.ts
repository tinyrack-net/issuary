import { buildRouteMap } from '@stricli/core';
import { releaseCommand } from './release.ts';

export const commands = buildRouteMap({
  routes: {
    release: releaseCommand,
  },
  docs: {
    brief: 'Issuary repository tools',
    fullDescription: 'Issuary repository tools',
  },
});

export default commands;
