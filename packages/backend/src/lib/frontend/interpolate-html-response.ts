import { interpolateHtml } from './interpolate-html.js';

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
