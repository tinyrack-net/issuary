import fs from 'node:fs';
import path from 'node:path';
import type { Context } from 'hono';
import { getMimeType } from 'hono/utils/mime';
import type { FrontendConfig } from '#backend/lib/config/frontend.js';
import {
  DEFAULT_HTML_VARIABLES,
  interpolateHtml,
} from '#backend/lib/interpolate-html.js';

export interface CreateStaticHandlerOptions {
  /**
   * HTML variable map for `{{VAR}}` interpolation in HTML responses.
   * Defaults to `{}` (no interpolation).
   */
  htmlVariables?: Record<string, string> | undefined;
  publicPath: string;
  /**
   * Optional response interceptor.
   * Called with the (already-interpolated) Response before it is
   * returned. Return a modified Response or the original as-is.
   */
  onResponse?:
    | ((response: Response) => Response | Promise<Response>)
    | undefined;
}

/**
 * Create a FrontendConfig that serves static files from a directory.
 * Supports HTML variable interpolation and SPA fallback to index.html.
 */
export function createStaticHandler(
  options: CreateStaticHandlerOptions,
): FrontendConfig {
  const publicPath = path.resolve(options.publicPath);
  const rootIndexPath = path.join(publicPath, 'index.html');
  const htmlVariables = {
    ...DEFAULT_HTML_VARIABLES,
    ...options.htmlVariables,
  };
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

  async function applyOnResponse(res: Response): Promise<Response> {
    if (options.onResponse) {
      return options.onResponse(res);
    }
    return res;
  }

  return async (c: Context): Promise<Response> => {
    const urlPath = c.req.path;

    const resolved = path.resolve(publicPath, `.${urlPath}`);
    if (!isSafePath(resolved)) {
      return applyOnResponse(
        c.html(
          hasVariables
            ? await getInterpolatedHtml(rootIndexPath)
            : await getRootIndex(),
        ),
      );
    }

    try {
      const stats = await fs.promises.stat(resolved);

      if (stats.isFile()) {
        if (hasVariables && resolved.endsWith('.html')) {
          const html = await getInterpolatedHtml(resolved);
          return applyOnResponse(c.html(html));
        }
        const content = await fs.promises.readFile(resolved);
        const mimeType = getMimeType(resolved) ?? 'application/octet-stream';
        return applyOnResponse(
          new Response(content, {
            headers: { 'Content-Type': mimeType },
          }),
        );
      }

      if (stats.isDirectory()) {
        const indexPath = path.join(resolved, 'index.html');
        try {
          if (hasVariables) {
            const html = await getInterpolatedHtml(indexPath);
            return applyOnResponse(c.html(html));
          }
          const content = await fs.promises.readFile(indexPath, 'utf-8');
          return applyOnResponse(c.html(content));
        } catch {
          // No index.html in directory, fall through.
        }
      }
    } catch {
      // File doesn't exist, fall through to SPA fallback.
    }

    if (hasVariables) {
      const html = await getInterpolatedHtml(rootIndexPath);
      return applyOnResponse(c.html(html));
    }

    try {
      const content = await getRootIndex();
      return applyOnResponse(c.html(content));
    } catch {
      return applyOnResponse(c.json({ error: 'Not Found' }, 404));
    }
  };
}
