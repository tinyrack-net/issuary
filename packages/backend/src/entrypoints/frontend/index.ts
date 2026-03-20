export type {
  FrontendConfig,
  FrontendHandler,
  FrontendRuntimeContext,
} from '#backend/lib/config/frontend.js';
export type {
  CloudflareAssetsBinding,
  CreateCloudflareAssetsHandlerOptions,
} from '#backend/lib/frontend/cloudflare.js';
export { createCloudflareAssetsHandler } from '#backend/lib/frontend/cloudflare.js';
export type {
  BuiltInHtmlVariableKey,
  BuiltInHtmlVariables,
  HtmlVariables,
  ResolveHtmlVariablesOptions,
} from '#backend/lib/interpolate-html.js';
export {
  DEFAULT_HTML_VARIABLES,
  interpolateHtml,
  interpolateHtmlResponse,
  resolveHtmlVariables,
} from '#backend/lib/interpolate-html.js';
