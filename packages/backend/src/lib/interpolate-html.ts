import type { BrandingConfig } from '#backend/lib/config/branding.js';
import type { ServerConfig } from '#backend/lib/config/server.js';

export type HtmlVariables = Record<string, string>;

const HTML_PLACEHOLDER_PATTERN = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;
const TEXT_ENCODER = new TextEncoder();

export const DEFAULT_HTML_VARIABLES = {
  TITLE: 'Tinyrack',
  DESCRIPTION: 'OIDC Provider for everyone',
  FAVICON_URL: '/vite.svg',
  COLOR_SCHEME: 'light dark',
  THEME_COLOR: '#570df8',
  OG_IMAGE_URL: '',
  OG_URL: '',
  APPLE_TOUCH_ICON_URL: '/vite.svg',
} as const satisfies HtmlVariables;

export type BuiltInHtmlVariables = typeof DEFAULT_HTML_VARIABLES;
export type BuiltInHtmlVariableKey = keyof BuiltInHtmlVariables;

export interface ResolveHtmlVariablesOptions {
  branding?: BrandingConfig | undefined;
  server?: ServerConfig | undefined;
  overrides?: HtmlVariables | undefined;
}

function deriveHtmlVariablesFromRuntime(
  options: ResolveHtmlVariablesOptions,
): HtmlVariables {
  const derived: HtmlVariables = {};

  if (options.branding) {
    const { theme_mode, icon_url } = options.branding;
    derived['COLOR_SCHEME'] =
      theme_mode === 'system' ? 'light dark' : theme_mode;
    if (icon_url) {
      derived['FAVICON_URL'] = icon_url;
      derived['APPLE_TOUCH_ICON_URL'] = icon_url;
    }
  }

  if (options.server?.public_origin) {
    derived['OG_URL'] = options.server.public_origin;
  }

  return derived;
}

export function resolveHtmlVariables(
  options: ResolveHtmlVariablesOptions,
): HtmlVariables {
  return {
    ...DEFAULT_HTML_VARIABLES,
    ...deriveHtmlVariablesFromRuntime(options),
    ...options.overrides,
  };
}

/**
 * Replace {{KEY}} placeholders in HTML with corresponding variable values.
 * Only matches keys that follow identifier naming rules
 * (start with a letter or underscore, followed by alphanumerics or underscores).
 * Unmatched placeholders are left as-is.
 */
export function interpolateHtml(
  html: string,
  variables: Readonly<HtmlVariables>,
): string {
  return html.replace(
    HTML_PLACEHOLDER_PATTERN,
    (match, key: string) => variables[key] ?? match,
  );
}

/**
 * Interpolate HTML variables in a Response if its content-type is text/html.
 * Non-HTML responses are returned unchanged.
 */
export async function interpolateHtmlResponse(
  response: Response,
  variables: Readonly<HtmlVariables>,
): Promise<Response> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('text/html')) {
    return response;
  }

  const interpolated = interpolateHtml(await response.text(), variables);
  const headers = new Headers(response.headers);
  headers.set(
    'content-length',
    String(TEXT_ENCODER.encode(interpolated).byteLength),
  );

  return new Response(interpolated, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
