import fs from 'node:fs';
import path from 'node:path';
import type { Context } from 'hono';
import { getMimeType } from 'hono/utils/mime';
import type { FrontendConfig } from '#backend/lib/config/frontend.js';
import type { HtmlVariables } from '#backend/lib/interpolate-html.js';
import {
  interpolateHtml,
  resolveHtmlVariables,
} from '#backend/lib/interpolate-html.js';

export interface CreateStaticHandlerOptions {
  /**
   * HTML variable map for `{{VAR}}` interpolation in HTML responses.
   */
  htmlVariables?: HtmlVariables | undefined;
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

type StaticTarget =
  | { kind: 'html'; absolutePath: string }
  | { kind: 'file'; absolutePath: string }
  | { kind: 'spa' };

/**
 * Create a FrontendConfig that serves static files from a directory.
 * Supports HTML variable interpolation and SPA fallback to index.html.
 */
export function createStaticHandler(
  options: CreateStaticHandlerOptions,
): FrontendConfig {
  return ({ branding, server }) => {
    const publicPath = path.resolve(options.publicPath);
    const rootIndexPath = path.join(publicPath, 'index.html');
    const htmlVariables = resolveHtmlVariables({
      branding,
      server,
      overrides: options.htmlVariables,
    });
    const htmlCache = new Map<string, string>();

    async function statIfExists(targetPath: string) {
      try {
        return await fs.promises.stat(targetPath);
      } catch {
        return undefined;
      }
    }

    async function readInterpolatedHtml(absolutePath: string): Promise<string> {
      const cached = htmlCache.get(absolutePath);
      if (cached !== undefined) {
        return cached;
      }

      const raw = await fs.promises.readFile(absolutePath, 'utf-8');
      const result = interpolateHtml(raw, htmlVariables);
      htmlCache.set(absolutePath, result);
      return result;
    }

    function isSafePath(resolved: string): boolean {
      return (
        resolved === publicPath ||
        resolved.startsWith(`${publicPath}${path.sep}`)
      );
    }

    async function applyOnResponse(response: Response): Promise<Response> {
      if (options.onResponse) {
        return options.onResponse(response);
      }
      return response;
    }

    async function serveHtml(
      c: Context,
      absolutePath: string,
    ): Promise<Response> {
      const html = await readInterpolatedHtml(absolutePath);
      return applyOnResponse(await c.html(html));
    }

    async function serveFile(absolutePath: string): Promise<Response> {
      const content = await fs.promises.readFile(absolutePath);
      const mimeType = getMimeType(absolutePath) ?? 'application/octet-stream';
      return applyOnResponse(
        new Response(content, {
          headers: { 'Content-Type': mimeType },
        }),
      );
    }

    async function notFound(c: Context): Promise<Response> {
      return applyOnResponse(await c.json({ error: 'Not Found' }, 404));
    }

    async function serveSpaFallback(c: Context): Promise<Response> {
      try {
        return await serveHtml(c, rootIndexPath);
      } catch {
        return notFound(c);
      }
    }

    async function resolveTarget(urlPath: string): Promise<StaticTarget> {
      const resolved = path.resolve(publicPath, `.${urlPath}`);
      if (!isSafePath(resolved)) {
        return { kind: 'spa' };
      }

      const stats = await statIfExists(resolved);
      if (!stats) {
        return { kind: 'spa' };
      }

      if (stats.isFile()) {
        return resolved.endsWith('.html')
          ? { kind: 'html', absolutePath: resolved }
          : { kind: 'file', absolutePath: resolved };
      }

      if (stats.isDirectory()) {
        const indexPath = path.join(resolved, 'index.html');
        const indexStats = await statIfExists(indexPath);
        if (indexStats?.isFile()) {
          return { kind: 'html', absolutePath: indexPath };
        }
      }

      return { kind: 'spa' };
    }

    return async (c): Promise<Response> => {
      if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
        return notFound(c);
      }

      const target = await resolveTarget(c.req.path);

      switch (target.kind) {
        case 'html':
          return serveHtml(c, target.absolutePath);
        case 'file':
          return serveFile(target.absolutePath);
        case 'spa':
          return serveSpaFallback(c);
      }
    };
  };
}
