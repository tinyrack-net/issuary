import type { ConnInfo } from 'hono/conninfo';
import { createMiddleware } from 'hono/factory';
import { isTrustedProxy } from '@/lib/ip-utils.js';
import { e } from '@/schemas/error.js';
import type { AppEnv } from '@/types.js';

/**
 * Creates a trusted proxy guard middleware.
 * Only applies IP filtering when trust_proxy is
 * string or array.
 */
export function trustedProxyGuard(
  trustProxy: boolean | number | string | string[],
) {
  const requiresFiltering =
    typeof trustProxy === 'string' || Array.isArray(trustProxy);

  if (!requiresFiltering) {
    // No filtering needed, pass through
    return createMiddleware<AppEnv>(async (_c, next) => {
      await next();
    });
  }

  return createMiddleware<AppEnv>(async (c, next) => {
    // Access raw Node.js socket for remote address
    // @hono/node-server provides connInfo via env
    const connInfo = (c.env as { connInfo?: ConnInfo })?.connInfo;
    const remoteAddress =
      connInfo?.remote?.address ??
      // Fallback: try to get from raw node request
      (
        c.env as {
          incoming?: {
            socket?: { remoteAddress?: string };
          };
        }
      )?.incoming?.socket?.remoteAddress;

    if (!remoteAddress) {
      throw new e.UntrustedProxy.Error();
    }

    const isTrusted = isTrustedProxy(remoteAddress, trustProxy);

    if (!isTrusted) {
      throw new e.UntrustedProxy.Error();
    }

    await next();
  });
}
