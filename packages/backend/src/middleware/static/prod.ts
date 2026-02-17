import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppType } from '@backend/app.js';
import type { ResolvedAppConfig } from '@backend/lib/config/index.js';
import { interpolateHtml } from '@backend/lib/interpolate-html.js';
import { serveStatic } from '@hono/node-server/serve-static';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

/**
 * Check if a URL path is an API/backend route
 * that should return 404 instead of SPA fallback.
 */
function isBackendRoute(urlPath: string): boolean {
  return (
    urlPath.startsWith('/api') ||
    urlPath.startsWith('/oauth') ||
    urlPath.startsWith('/.well-known')
  );
}

/**
 * Register production static file handling.
 *
 * Serves from public/ with SPA fallback and
 * HTML variable interpolation.
 */
export function registerProdStatic(
  app: AppType,
  config: ResolvedAppConfig,
  silent: boolean,
): void {
  if (!silent) {
    console.info('Static handler registered (production mode)');
  }

  const publicPath = path.join(__dirname, '../../../public');
  const variables = config.app.html_variables;
  const hasVariables = Object.keys(variables).length > 0;

  /**
   * Lazy cache for interpolated HTML content.
   * Key: absolute file path, Value: interpolated HTML.
   * Only used when html_variables is configured.
   */
  const htmlCache = new Map<string, string>();

  /**
   * Read an HTML file, apply variable interpolation,
   * cache the result, and return the HTML string.
   */
  async function getInterpolatedHtml(absolutePath: string): Promise<string> {
    const cached = htmlCache.get(absolutePath);
    if (cached !== undefined) {
      return cached;
    }
    const raw = await fs.promises.readFile(absolutePath, 'utf-8');
    const result = interpolateHtml(raw, variables);
    htmlCache.set(absolutePath, result);
    return result;
  }

  // Serve static files when no html_variables
  if (!hasVariables) {
    app.use(
      '*',
      serveStatic({
        root: './public',
      }),
    );
  }

  // Not-found handler: SPA fallback with SSG support
  app.notFound(async (c) => {
    const url = c.req.path;

    // API routes should return 404 errors
    if (isBackendRoute(url)) {
      return c.json({ error: 'Not Found' }, 404);
    }

    // Remove query string from URL
    const urlPath = url.split('?')[0] ?? '/';
    const filePath = path.join(publicPath, urlPath);

    // Try to serve the requested file (SSG support)
    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.isFile()) {
        if (hasVariables && filePath.endsWith('.html')) {
          const html = await getInterpolatedHtml(filePath);
          return c.html(html);
        }
        const content = await fs.promises.readFile(filePath);
        return new Response(content);
      }

      // If it's a directory, try index.html
      if (stats.isDirectory()) {
        const indexPath = path.join(filePath, 'index.html');
        try {
          await fs.promises.access(indexPath, fs.constants.F_OK);
          if (hasVariables) {
            const html = await getInterpolatedHtml(indexPath);
            return c.html(html);
          }
          const content = await fs.promises.readFile(indexPath);
          return c.html(content.toString('utf-8'));
        } catch {
          // No index.html in directory, fall through
        }
      }
    } catch {
      // File doesn't exist, fall through to SPA
    }

    // SPA fallback: serve root index.html
    const rootIndex = path.join(publicPath, 'index.html');
    if (hasVariables) {
      const html = await getInterpolatedHtml(rootIndex);
      return c.html(html);
    }
    try {
      const content = await fs.promises.readFile(rootIndex, 'utf-8');
      return c.html(content);
    } catch {
      return c.json({ error: 'Not Found' }, 404);
    }
  });
}
