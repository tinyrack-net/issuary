import type { FastifyRequest } from 'fastify';
import { verifyAccessToken, type AccessTokenPayload } from '@/lib/jwt.js';

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
  }
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(req: FastifyRequest): string {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError('Missing Authorization header');
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new UnauthorizedError(
      'Invalid Authorization header format. Expected: Bearer <token>',
    );
  }

  const token = parts[1];
  if (!token) {
    throw new UnauthorizedError('Missing token in Authorization header');
  }

  return token;
}

/**
 * Validate Bearer token and return payload
 */
export async function validateBearerToken(
  req: FastifyRequest,
): Promise<AccessTokenPayload> {
  const token = extractBearerToken(req);

  try {
    const payload = await verifyAccessToken(token);
    return payload;
  } catch (error) {
    if (error instanceof Error) {
      throw new UnauthorizedError(error.message);
    }
    throw new UnauthorizedError('Invalid access token');
  }
}
