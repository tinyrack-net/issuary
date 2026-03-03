import fs from 'node:fs';
import path from 'node:path';
import type { AppType } from '@tinyauth/backend';
import { isBackendRoute } from '@tinyauth/backend/routing';
import { getMimeType } from 'hono/utils/mime';
import { interpolateHtml } from './interpolate-html.js';

export interface StaticRouteOptions {
  htmlVariables: Record<string, string>;
  publicPath: string;
}

export function registerStaticRoutes(
  app: AppType,
  options: StaticRouteOptions,
): void {
  const publicPath = path.resolve(options.publicPath);
  const rootIndexPath = path.join(publicPath, 'index.html');
  const { htmlVariables } = options;
  const hasVariables = Object.keys(htmlVariables).length > 0;
  const htmlCache = new Map<string, string>();
  let cachedRootIndex: string | undefined;

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

  async function getRootIndex(): Promise<string> {
    if (cachedRootIndex !== undefined) {
      return cachedRootIndex;
    }
    cachedRootIndex = await fs.promises.readFile(rootIndexPath, 'utf-8');
    return cachedRootIndex;
  }

  function isSafePath(resolved: string): boolean {
    return (
      resolved === publicPath || resolved.startsWith(`${publicPath}${path.sep}`)
    );
  }

  app.notFound(async (c) => {
    const urlPath = c.req.path;

    if (isBackendRoute(urlPath)) {
      return c.json({ error: 'Not Found' }, 404);
    }

    const resolved = path.resolve(publicPath, `.${urlPath}`);
    if (!isSafePath(resolved)) {
      return c.json({ error: 'Not Found' }, 404);
    }

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
          // No index.html in directory, fall through.
        }
      }
    } catch {
      // File doesn't exist, fall through to SPA fallback.
    }

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
