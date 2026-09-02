import { redirect, type ServerBuild } from 'react-router';
import { frontendRuntimeContext } from '../lib/frontend/runtime-context.ts';
import { r } from '../schemas/response.ts';

function routeAsset(
  id: string,
  path: string,
  hasLoader: boolean,
  parentId?: string,
) {
  return {
    id,
    path,
    ...(parentId === undefined ? {} : { parentId }),
    hasAction: false,
    hasLoader,
    hasClientAction: false,
    hasClientLoader: false,
    hasClientMiddleware: false,
    hasErrorBoundary: false,
    module: `/assets/${id}.js`,
    imports: [],
    css: [],
    clientActionModule: undefined,
    clientLoaderModule: undefined,
    clientMiddlewareModule: undefined,
    hydrateFallbackModule: undefined,
  };
}

export const TEST_REACT_ROUTER_BUILD = {
  entry: {
    module: {
      default(request, responseStatusCode, responseHeaders, entryContext) {
        const config = r.ConfigResponse.parse(
          entryContext.staticHandlerContext.loaderData['root'],
        );
        const language =
          request.headers
            .get('Cookie')
            ?.match(/(?:^|;\s*)issuary-language=([^;]+)/)?.[1] ?? 'en';
        const title =
          config.branding.title[language] ?? config.branding.title['en'] ?? '';
        const subtitle =
          config.branding.subtitle[language] ??
          config.branding.subtitle['en'] ??
          '';
        const theme = request.headers
          .get('Cookie')
          ?.includes('issuary-color-scheme=dark')
          ? 'tinyrack-dark'
          : 'tinyrack-light';
        responseHeaders.set('Content-Type', 'text/html');
        return Promise.resolve(
          new Response(
            `<!doctype html><html data-theme="${theme}" lang="${language}"><head><title>${title}</title></head><body>${subtitle}</body></html>`,
            { headers: responseHeaders, status: responseStatusCode },
          ),
        );
      },
    },
  },
  routes: {
    root: {
      id: 'root',
      path: '',
      module: {
        default: () => null,
        async loader({ context }) {
          const runtime = context.get(frontendRuntimeContext);
          if (runtime === null) {
            throw new Error('Missing frontend runtime context');
          }
          const response = await runtime.fetch(
            new Request(new URL('/api/config', runtime.request.url), {
              headers: runtime.request.headers,
            }),
          );
          return r.ConfigResponse.parse(await response.json());
        },
      },
    },
    login: {
      id: 'login',
      parentId: 'root',
      path: 'login/password',
      module: { default: () => null },
    },
    admin: {
      id: 'admin',
      parentId: 'root',
      path: 'admin',
      module: {
        default: () => null,
        middleware: [() => redirect('/login')],
      },
    },
  },
  assets: {
    entry: { imports: [], module: '/assets/entry.js' },
    routes: {
      root: routeAsset('root', '', true),
      login: routeAsset('login', 'login/password', false, 'root'),
      admin: routeAsset('admin', 'admin', false, 'root'),
    },
    url: '/assets/manifest.js',
    version: 'test',
  },
  basename: '/',
  publicPath: '/',
  assetsBuildDirectory: 'build/client',
  future: {},
  ssr: true,
  isSpaMode: false,
  prerender: [],
  routeDiscovery: { mode: 'initial', manifestPath: '/__manifest' },
} satisfies ServerBuild;
