import { frontendRuntimeContext } from '@tinyrack/issuary-server/internal/frontend-runtime-context';
import type { RouterContextProvider } from 'react-router';
import { createI18n } from '#frontend/i18n/index.ts';
import { createApiClient } from '#frontend/libs/api.ts';
import { createAppQueryClient } from '#frontend/libs/query-client.ts';
import {
  type RouteRuntime,
  routeRuntimeContext,
} from '#frontend/libs/route-runtime.ts';
import {
  type AppConfigs,
  createAppConfigQueryOptions,
} from '#frontend/queries/config.ts';
import { createSessionQueryOptions } from '#frontend/queries/session.ts';

function cookieValue(request: Request, name: string): string | undefined {
  const prefix = `${name}=`;
  for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
    const value = part.trim();
    if (value.startsWith(prefix)) {
      return decodeURIComponent(value.slice(prefix.length));
    }
  }
  return undefined;
}

function resolveLanguage(request: Request, config: AppConfigs): string {
  const accepted = request.headers
    .get('Accept-Language')
    ?.split(',')[0]
    ?.split('-')[0];
  const requested = cookieValue(request, 'issuary-language') ?? accepted;
  return config.i18n.supported_languages.includes(requested ?? '')
    ? (requested ?? config.i18n.fallback_language)
    : config.i18n.fallback_language;
}

export async function initializeRouteRuntime(
  request: Request,
  context: Readonly<RouterContextProvider>,
): Promise<RouteRuntime> {
  const existing = context.get(routeRuntimeContext);
  if (existing !== null) return existing;

  const adapter = context.get(frontendRuntimeContext);
  const requestForFetch = adapter?.request ?? request;
  let language =
    cookieValue(request, 'issuary-language') ??
    request.headers.get('Accept-Language')?.split(',')[0]?.split('-')[0] ??
    'en';
  const api = createApiClient({
    baseUrl: new URL('/', requestForFetch.url).href,
    cookie: requestForFetch.headers.get('Cookie') ?? undefined,
    fetch: adapter?.fetch ?? globalThis.fetch,
    language: () => language,
  });
  const queryClient = createAppQueryClient();
  const config = await queryClient.ensureQueryData(
    createAppConfigQueryOptions(api),
  );
  language = resolveLanguage(request, config);
  const session = await queryClient.ensureQueryData(
    createSessionQueryOptions(api),
  );
  const runtime = {
    api,
    config,
    i18n: createI18n(
      {
        supportedLanguages: config.i18n.supported_languages,
        defaultLanguage: config.i18n.default_language,
        fallbackLanguage: config.i18n.fallback_language,
      },
      language,
    ),
    queryClient,
    session,
  };
  return runtime;
}

export function getRequestLanguage(runtime: RouteRuntime): string {
  return runtime.i18n.language;
}

export function getTheme(request: Request): 'dark' | 'light' {
  return cookieValue(request, 'issuary-color-scheme') === 'dark'
    ? 'dark'
    : 'light';
}
