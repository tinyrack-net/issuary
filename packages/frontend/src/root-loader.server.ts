import { dehydrate } from '@tanstack/react-query';
import type { RouterContextProvider } from 'react-router';
import {
  getRequestLanguage,
  getTheme,
} from '#frontend/libs/route-runtime.server.ts';
import { getRouteRuntime } from '#frontend/libs/route-runtime.ts';

export function loadRoot(
  request: Request,
  context: Readonly<RouterContextProvider>,
) {
  const runtime = getRouteRuntime(context);
  return {
    config: runtime.config,
    dehydratedState: dehydrate(runtime.queryClient),
    language: getRequestLanguage(runtime),
    theme: getTheme(request),
  };
}
