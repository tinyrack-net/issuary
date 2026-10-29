import {
  type IssuaryRuntimeConfig,
  isValidResourceIndicator,
} from '../lib/config/index.ts';
import { e } from '../schemas/error.ts';

/**
 * RFC 8707 Resource Indicators helpers.
 *
 * - Requests carry zero or more `resource` parameters (absolute URIs without
 *   fragments). Each must be defined in `config.resources` and allowed for
 *   the requesting client via `clients[].resources`.
 * - Access token `aud` is the ordered, de-duplicated union of the configured
 *   audiences of the effective resources. A single audience is emitted as a
 *   string and multiple audiences as an array (RFC 7519 §4.1.3). Requests
 *   without any resource keep the default audience (`server.public_origin`).
 */

export type ResourceParam = string | string[] | undefined;

/** Normalize a (possibly repeated) `resource` parameter into a unique list. */
export function normalizeResourceParam(value: ResourceParam): string[] {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  return Array.from(new Set(values));
}

/**
 * Validate requested resources for a client (RFC 8707 §2).
 *
 * @throws {e.InvalidTarget.Error} when a value is malformed, undefined, or
 * not allowed for the client.
 */
export function validateRequestedResources(
  config: IssuaryRuntimeConfig,
  clientId: string,
  requested: readonly string[],
): string[] {
  if (requested.length === 0) return [];
  const defined = new Set(
    config.resources.map((resource) => resource.identifier),
  );
  const allowed = new Set(
    config.clients.find((client) => client.client_id === clientId)?.resources ??
      [],
  );
  const invalidResources = requested.filter(
    (resource) =>
      !isValidResourceIndicator(resource) ||
      !defined.has(resource) ||
      !allowed.has(resource),
  );
  if (invalidResources.length > 0) {
    throw new e.InvalidTarget.Error({ invalidResources });
  }
  return [...requested];
}

/**
 * Resolve the resources for a token request. Requested values must be a
 * subset of the previously approved resources (RFC 8707 §2.2); omitting the
 * parameter selects every approved resource.
 *
 * @throws {e.InvalidTarget.Error} when a requested resource was not approved.
 */
export function selectApprovedResources(
  approved: readonly string[],
  requested: readonly string[],
): string[] {
  if (requested.length === 0) return [...approved];
  const approvedSet = new Set(approved);
  const invalidResources = requested.filter(
    (resource) => !approvedSet.has(resource),
  );
  if (invalidResources.length > 0) {
    throw new e.InvalidTarget.Error({ invalidResources });
  }
  return [...requested];
}

/**
 * Reject a `resource` parameter on flows that do not support resource
 * indicators instead of silently ignoring it.
 */
export function rejectUnsupportedResources(requested: readonly string[]): void {
  if (requested.length > 0) {
    throw new e.InvalidTarget.Error({ invalidResources: [...requested] });
  }
}

/**
 * Compute the access token `aud` claim for the effective resources.
 */
export function resolveAccessTokenAudience(
  config: IssuaryRuntimeConfig,
  resources: readonly string[],
): string | string[] {
  if (resources.length === 0) return config.server.public_origin;
  const audiences: string[] = [];
  for (const identifier of resources) {
    const resource = config.resources.find(
      (candidate) => candidate.identifier === identifier,
    );
    for (const audience of resource?.audiences ?? [identifier]) {
      if (!audiences.includes(audience)) audiences.push(audience);
    }
  }
  const [first] = audiences;
  return audiences.length === 1 && first !== undefined ? first : audiences;
}
