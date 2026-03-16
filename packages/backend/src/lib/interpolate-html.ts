export const DEFAULT_HTML_VARIABLES: Record<string, string> = {
  TITLE: 'Tinyrack',
  DESCRIPTION: 'OIDC Provider for everyone',
  FAVICON_URL: '/vite.svg',
};

/**
 * Replace {{KEY}} placeholders in HTML with corresponding variable values.
 * Only matches keys that follow identifier naming rules
 * (start with a letter or underscore, followed by alphanumerics or underscores).
 * Unmatched placeholders are left as-is.
 */
export function interpolateHtml(
  html: string,
  variables: Record<string, string>,
): string {
  return html.replace(
    /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g,
    (match, key: string) => variables[key] ?? match,
  );
}

/**
 * Interpolate HTML variables in a Response if its content-type is text/html.
 * Non-HTML responses are returned unchanged.
 */
export async function interpolateHtmlResponse(
  response: Response,
  variables: Record<string, string>,
): Promise<Response> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('text/html')) {
    return response;
  }

  const interpolated = interpolateHtml(await response.text(), variables);
  const headers = new Headers(response.headers);
  headers.set(
    'content-length',
    String(new TextEncoder().encode(interpolated).byteLength),
  );

  return new Response(interpolated, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
