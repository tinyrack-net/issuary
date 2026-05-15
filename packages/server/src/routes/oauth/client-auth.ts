import type { Context } from 'hono';
import { e, TinyAuthError } from '../../schemas/error.js';

export interface BasicClientCredentials {
  clientId: string;
  clientSecret: string;
}

export const BASIC_CLIENT_AUTH_CHALLENGE = 'Basic realm="tinyauth"';

const BASIC_BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function parseBasicClientCredentials(
  authorizationHeader: string | undefined,
): BasicClientCredentials | null | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, encoded, extra] = authorizationHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'basic') {
    return null;
  }

  if (
    !encoded ||
    extra !== undefined ||
    /\s/.test(encoded) ||
    !BASIC_BASE64_PATTERN.test(encoded)
  ) {
    return null;
  }

  const decodedBytes = Buffer.from(encoded, 'base64');
  const decoded = decodeUtf8(decodedBytes);
  if (!decoded || Buffer.from(decoded, 'utf8').toString('base64') !== encoded) {
    return null;
  }

  const separatorIndex = decoded.indexOf(':');

  if (separatorIndex < 0) {
    return null;
  }

  const clientId = decodeBasicCredential(decoded.slice(0, separatorIndex));
  if (!clientId) {
    return null;
  }

  return {
    clientId,
    clientSecret: decodeBasicCredential(decoded.slice(separatorIndex + 1)),
  };
}

export function throwInvalidClientCredentialsWithBasicChallenge(
  c: Context,
): never {
  c.header('WWW-Authenticate', BASIC_CLIENT_AUTH_CHALLENGE);
  throw new e.InvalidClientCredentials.Error();
}

export function setBasicClientAuthChallengeIfInvalidClientCredentials(
  c: Context,
  err: unknown,
): void {
  if (
    err instanceof TinyAuthError &&
    err.code === 'INVALID_CLIENT_CREDENTIALS'
  ) {
    c.header('WWW-Authenticate', BASIC_CLIENT_AUTH_CHALLENGE);
  }
}

function decodeUtf8(value: Buffer): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(value);
  } catch {
    return null;
  }
}

function decodeBasicCredential(value: string): string {
  return new URLSearchParams(`value=${value}`).get('value') ?? '';
}
