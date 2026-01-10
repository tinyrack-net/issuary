import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AccessTokenPayload } from '@/services/jwt.service.js';
import { e } from '@/schemas/error.js';

export type { AccessTokenPayload };

/**
 * Extract Bearer token from Authorization header
 *
 * @param req - Fastify request object
 * @returns Extracted Bearer token
 * @throws {MissingAuthorizationHeader} When Authorization header is missing
 * @throws {InvalidAuthorizationHeaderFormat} When header format is invalid
 * @throws {MissingBearerToken} When token is missing in header
 *
 * @example
 * ```typescript
 * const token = extractBearerToken(req);
 * // Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * ```
 */
export function extractBearerToken(req: FastifyRequest): string {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new e.MissingAuthorizationHeader.Error();
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new e.InvalidAuthorizationHeaderFormat.Error();
  }

  const token = parts[1];
  if (!token) {
    throw new e.MissingBearerToken.Error();
  }

  return token;
}

/**
 * Validate Bearer token and return decoded payload
 *
 * Extracts Bearer token from Authorization header and verifies it.
 * This is the main authentication handler for protected API endpoints.
 *
 * @param fastify - Fastify instance for accessing jwtService
 * @param req - Fastify request object
 * @returns Decoded access token payload with user and client info
 * @throws {MissingAuthorizationHeader} When Authorization header is missing
 * @throws {InvalidAuthorizationHeaderFormat} When header format is invalid
 * @throws {MissingBearerToken} When token is missing in header
 * @throws {InvalidAccessToken} When token is invalid or expired
 *
 * @example
 * ```typescript
 * // In a route handler
 * const payload = await validateBearerToken(fastify, req);
 * console.log(payload.sub);       // User ID
 * console.log(payload.client_id); // OAuth client ID
 * console.log(payload.scope);     // Granted scopes
 * ```
 */
export async function validateBearerToken(
  fastify: FastifyInstance,
  req: FastifyRequest,
): Promise<AccessTokenPayload> {
  const token = extractBearerToken(req);

  // Use jwtService for RS256 token verification
  const payload = await fastify.jwtService.verifyAccessToken(token);
  return payload;
}
