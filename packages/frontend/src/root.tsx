import './index.css';
import { HydrationBoundary, QueryClientProvider } from '@tanstack/react-query';
import { TRProgress } from '@tinyrack/ui/components/progress';
import { TRToast } from '@tinyrack/ui/components/toast';
import { useEffect, useMemo, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
  useNavigation,
  useRouteLoaderData,
} from 'react-router';
import { ColorSchemeProvider } from '#frontend/hooks/use-theme.ts';
import { getAppI18n } from '#frontend/i18n/index.ts';
import { setBrowserApiLanguage } from '#frontend/libs/api.ts';
import { getAppQueryClient } from '#frontend/libs/query-client.ts';
import { routeRuntimeContext } from '#frontend/libs/route-runtime.ts';
import type { Route } from './+types/root';

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const { initializeRouteRuntime } = await import(
      '#frontend/libs/route-runtime.server.ts'
    );
    const runtime = await initializeRouteRuntime(request, context);
    context.set(routeRuntimeContext, runtime);
    return next();
  },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const { loadRoot } = await import('./root-loader.server.js');
  return loadRoot(request, context);
}

export function headers() {
  return {
    'Cache-Control': 'no-store',
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const title =
    loaderData?.config.branding.title?.[loaderData.language] ?? 'Issuary';
  const description =
    loaderData?.config.branding.subtitle?.[loaderData.language] ??
    'OIDC Provider for everyone';
  return [
    { title },
    { name: 'description', content: description },
    { name: 'robots', content: 'noindex, nofollow' },
    {
      tagName: 'link',
      rel: 'icon',
      href: loaderData?.config.branding.icon_url ?? '/issuary-app-icon.svg',
    },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>('root');
  return (
    <html
      data-theme={data?.theme === 'dark' ? 'tinyrack-dark' : 'tinyrack-light'}
      lang={data?.language ?? 'en'}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta content="light dark" name="color-scheme" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function RouteProgress() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const location = useLocation();
  const [documentPending, setDocumentPending] = useState(false);

  useEffect(() => {
    const start = () => setDocumentPending(true);
    const reset = () => setDocumentPending(false);
    window.addEventListener('issuary-document-navigation', start);
    window.addEventListener('pageshow', reset);
    return () => {
      window.removeEventListener('issuary-document-navigation', start);
      window.removeEventListener('pageshow', reset);
    };
  }, []);

  const routerPending =
    navigation.state !== 'idle' &&
    navigation.location !== undefined &&
    navigation.location.pathname !== location.pathname;
  if (
    !(routerPending || documentPending) ||
    location.pathname.startsWith('/admin')
  ) {
    return null;
  }

  return (
    <TRProgress.Root className="route-progress" value={null}>
      <TRProgress.Label className="route-progress-label">
        {t('common.loading')}
      </TRProgress.Label>
      <TRProgress.Track>
        <TRProgress.Indicator />
      </TRProgress.Track>
    </TRProgress.Root>
  );
}

export default function App() {
  const data = useLoaderData<typeof loader>();
  const queryClient = getAppQueryClient();
  const appI18n = useMemo(
    () =>
      getAppI18n(
        {
          supportedLanguages: data.config.i18n.supported_languages,
          defaultLanguage: data.config.i18n.default_language,
          fallbackLanguage: data.config.i18n.fallback_language,
        },
        data.language,
      ),
    [data.config.i18n, data.language],
  );

  useEffect(() => {
    document.documentElement.dataset['hydrated'] = 'true';
    setBrowserApiLanguage(appI18n.language);
    const updateApiLanguage = (language: string) =>
      setBrowserApiLanguage(language);
    appI18n.on('languageChanged', updateApiLanguage);
    return () => appI18n.off('languageChanged', updateApiLanguage);
  }, [appI18n]);

  return (
    <I18nextProvider i18n={appI18n}>
      <ColorSchemeProvider initialColorScheme={data.theme}>
        <QueryClientProvider client={queryClient}>
          <HydrationBoundary state={data.dehydratedState}>
            <TRToast.Provider>
              <RouteProgress />
              <Outlet />
            </TRToast.Provider>
          </HydrationBoundary>
        </QueryClientProvider>
      </ColorSchemeProvider>
    </I18nextProvider>
  );
}
