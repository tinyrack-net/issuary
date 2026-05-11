export type {
  FrontendConfig,
  FrontendHandler,
  FrontendRuntimeContext,
} from '../../lib/config/frontend.ts';
export type {
  BuiltInHtmlVariableKey,
  BuiltInHtmlVariables,
  HtmlVariables,
  ResolveHtmlVariablesOptions,
} from '../../lib/interpolate-html.ts';
export {
  DEFAULT_HTML_VARIABLES,
  interpolateHtml,
  interpolateHtmlResponse,
  resolveHtmlVariables,
} from '../../lib/interpolate-html.ts';
