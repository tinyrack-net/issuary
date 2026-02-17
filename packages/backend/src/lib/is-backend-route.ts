/**
 * Check if a URL path is an API/backend route
 * that should return 404 instead of SPA fallback.
 */
export function isBackendRoute(urlPath: string): boolean {
  return (
    urlPath.startsWith('/api') ||
    urlPath.startsWith('/oauth') ||
    urlPath.startsWith('/.well-known')
  );
}
