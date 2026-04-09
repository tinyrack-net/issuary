import { buildRouteMap } from '@stricli/core';
import { releaseCommand } from './release.ts';

export const commands = buildRouteMap({
  routes: {
    release: releaseCommand,
  },
  docs: {
    brief: 'TinyAuth repository tools',
    fullDescription: 'TinyAuth repository tools',
  },
});

export default commands;
