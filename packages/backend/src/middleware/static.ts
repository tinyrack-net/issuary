import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppType } from '@backend/app.js';
import { interpolateHtml } from '@backend/lib/interpolate-html.js';
import { isBackendRoute } from '@backend/lib/is-backend-route.js';
import { serveStatic } from '@hono/node-server/serve-static';
import { getMimeType } from 'hono/utils/mime';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

export interface ProdStaticOptions {
  /**
   * Key-value pairs for HTML template variable
   * interpolation using {{KEY}} syntax.
   * When non-empty, HTML files are interpolated and
   * all static files are served by the notFound handler
   * (bypassing serveStatic) so that HTML responses can
   * be rewritten.
   */
  htmlVariables: Record<string, string>;
}

/**
 * Register production static file handling.
 *
 * Serves from public/ with SPA fallback and
 * HTML variable interpolation.
 */
export function registerProdStatic(
  app: AppType,
  options: ProdStaticOptions,
): void {
  const publicPath = path.join(__dirname, '../../public');
  const rootIndexPath = path.join(publicPath, 'index.html');
  const { htmlVariables } = options;
  const hasVariables = Object.keys(htmlVariables).length > 0;

  /**
   * Lazy cache for interpolated HTML content.
   * Key: absolute file path, Value: interpolated HTML.
   * Only used when html_variables is configured.
   */
  const htmlCache = new Map<string, string>();

  /**
   * Lazy cache for the root index.html content.
   * Used in the !hasVariables SPA fallback path so
   * we only read from disk once.
   */
  let cachedRootIndex: string | undefined;

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
    const result = interpolateHtml(raw, htmlVariables);
    htmlCache.set(absolutePath, result);
    return result;
  }

  /**
   * Return the root index.html content, reading from
   * disk only on the first call.
   */
  async function getRootIndex(): Promise<string> {
    if (cachedRootIndex !== undefined) {
      return cachedRootIndex;
    }
    cachedRootIndex = await fs.promises.readFile(rootIndexPath, 'utf-8');
    return cachedRootIndex;
  }

  /**
   * Check that a resolved path is still inside
   * publicPath to prevent path-traversal attacks.
   */
  function isSafePath(resolved: string): boolean {
    return (
      resolved === publicPath || resolved.startsWith(`${publicPath}${path.sep}`)
    );
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
    const urlPath = c.req.path;

    // API routes should return 404 errors
    if (isBackendRoute(urlPath)) {
      return c.json({ error: 'Not Found' }, 404);
    }

    // Resolve and validate the filesystem path
    const resolved = path.resolve(publicPath, `.${urlPath}`);
    if (!isSafePath(resolved)) {
      return c.json({ error: 'Not Found' }, 404);
    }

    // Try to serve the requested file (SSG support)
    try {
      const stats = await fs.promises.stat(resolved);

      if (stats.isFile()) {
        if (hasVariables && resolved.endsWith('.html')) {
          const html = await getInterpolatedHtml(resolved);
          return c.html(html);
        }
        const content = await fs.promises.readFile(resolved);
        const mimeType = getMimeType(resolved) ?? 'application/octet-stream';
        return new Response(content, {
          headers: { 'Content-Type': mimeType },
        });
      }

      // If it's a directory, try index.html
      if (stats.isDirectory()) {
        const indexPath = path.join(resolved, 'index.html');
        try {
          if (hasVariables) {
            const html = await getInterpolatedHtml(indexPath);
            return c.html(html);
          }
          const content = await fs.promises.readFile(indexPath, 'utf-8');
          return c.html(content);
        } catch {
          // No index.html in directory, fall through
        }
      }
    } catch {
      // File doesn't exist, fall through to SPA
    }

    // SPA fallback: serve root index.html
    if (hasVariables) {
      const html = await getInterpolatedHtml(rootIndexPath);
      return c.html(html);
    }
    try {
      const content = await getRootIndex();
      return c.html(content);
    } catch {
      return c.json({ error: 'Not Found' }, 404);
    }
  });
}
