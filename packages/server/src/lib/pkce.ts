import { base64url } from 'jose';
import { e } from '../schemas/error.ts';

const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

function generateVerifier(length: number): string {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return base64url.encode(buffer).slice(0, length);
}

async function generateChallenge(verifier: string, method: 'S256' | 'plain') {
  if (method === 'plain') return verifier;
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64url.encode(new Uint8Array(hash));
}

/**
 * Generate PKCE code verifier and challenge pair
 *
 * @param length - Length of the code verifier (43-128 characters, default 64)
 * @returns PKCE pair containing verifier, challenge, and method
 * @throws {InvalidCodeVerifierLength} When length is outside the 43-128 character range
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7636#section-4.1 | RFC 7636 §4.1 - Client Creates a Code Verifier}
 */
export async function generatePKCE(length: number = 64) {
  if (length < 43 || length > 128) {
    throw new e.InvalidCodeVerifierLength.Error();
  }
  const verifier = generateVerifier(length);
  const challenge = await generateChallenge(verifier, 'S256');
  return {
    verifier,
    challenge,
    method: 'S256',
  };
}

/**
 * Validate PKCE code verifier against stored challenge
 *
 * @param verifier - Code verifier sent by the client in token request
 * @param challenge - Code challenge previously stored from authorization request
 * @param method - Transform method used ('S256' or 'plain', default 'S256')
 * @returns True if the verifier matches the challenge, false otherwise
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7636#section-4.6 | RFC 7636 §4.6 - Client Sends the Authorization Code and the Code Verifier to the Token Endpoint}
 */
export async function validatePKCE(
  verifier: string,
  challenge: string,
  method: 'S256' | 'plain' = 'S256',
) {
  if (method !== 'S256') {
    return false;
  }

  if (!CODE_VERIFIER_PATTERN.test(verifier)) {
    return false;
  }

  const generatedChallenge = await generateChallenge(verifier, method);
  // timing safe equals?
  return generatedChallenge === challenge;
}
