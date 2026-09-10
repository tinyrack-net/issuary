import { z } from 'zod';
import type { IssuaryRuntimeConfig } from './config/index.js';
import { isTrustedProxy } from './ip-utils.js';

const PeerInfo = z.object({
  connInfo: z
    .object({ remote: z.object({ address: z.string() }).optional() })
    .optional(),
  incoming: z
    .object({ socket: z.object({ remoteAddress: z.string().optional() }) })
    .optional(),
});
const IpAddress = z.union([z.ipv4(), z.ipv6()]);

/** Forwarding headers are only consumed behind explicitly trusted connection hops. */
export function requestIp(
  env: unknown,
  forwardedFor: string | undefined,
  trust: IssuaryRuntimeConfig['server']['trust_proxy'],
): string | undefined {
  const parsed = PeerInfo.safeParse(env);
  if (!parsed.success) return undefined;
  const peer =
    parsed.data.connInfo?.remote?.address ??
    parsed.data.incoming?.socket.remoteAddress;
  if (!peer || !IpAddress.safeParse(peer).success) return undefined;
  const forwarded = forwardedFor?.split(',').map((value) => value.trim()) ?? [];
  if (forwarded.some((ip) => !IpAddress.safeParse(ip).success)) return peer;
  const chain = [peer, ...forwarded.reverse()];
  let current = peer;
  for (let index = 0; index < chain.length - 1; index++) {
    const trusted =
      typeof trust === 'number'
        ? index < trust
        : trust === true || (trust !== false && isTrustedProxy(current, trust));
    if (!trusted) break;
    const next = chain[index + 1];
    if (!next) break;
    current = next;
  }
  return current;
}
