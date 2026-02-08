/**
 * Trusted Proxy Guard Plugin
 *
 * This plugin enforces that requests only come from trusted proxy sources
 * when trust_proxy is configured with specific IP addresses or CIDR ranges.
 *
 * Behavior based on trust_proxy configuration:
 * - false: Allow all requests (direct connection mode, no proxy expected)
 * - true: Allow all requests (trust all proxies)
 * - number: Allow all requests (hop count mode)
 * - string/array: Only allow requests from specified IPs/CIDRs
 */

import fastifyPlugin from 'fastify-plugin';
import { isTrustedProxy } from '@/lib/ip-utils.js';
import { e } from '@/schemas/error.js';

export default fastifyPlugin(
  (fastify, _opts, done) => {
    const trustProxy = fastify.config.app.trust_proxy;

    // Skip guard if no IP-based filtering is needed
    const requiresFiltering =
      typeof trustProxy === 'string' || Array.isArray(trustProxy);

    if (!requiresFiltering) {
      if (!fastify.serverOptions.silent) {
        console.info(
          'Trusted proxy guard plugin registered (filtering: disabled)',
        );
      }
      done();
      return;
    }

    if (!fastify.serverOptions.silent) {
      console.info(
        'Trusted proxy guard plugin registered (filtering: %s)',
        JSON.stringify(trustProxy),
      );
    }

    fastify.addHook('onRequest', async (request, _reply) => {
      // Get the raw socket IP address (this is the actual connecting IP)
      const remoteAddress = request.socket.remoteAddress;

      if (!remoteAddress) {
        fastify.log.warn('Request has no remote address, rejecting');
        throw new e.UntrustedProxy.Error();
      }

      const isTrusted = isTrustedProxy(remoteAddress, trustProxy);

      if (!isTrusted) {
        fastify.log.warn(
          { remoteAddress, trustProxy },
          'Request from untrusted proxy source rejected',
        );
        throw new e.UntrustedProxy.Error();
      }
    });

    done();
  },
  {
    name: 'trusted-proxy-guard',
    dependencies: [],
  },
);
