import fastifySecureSession from '@fastify/secure-session';
import fastifyPlugin from 'fastify-plugin';

/**
 * Authentication Method Reference values (RFC 8176)
 * @see https://www.rfc-editor.org/rfc/rfc8176.html
 */
export type AuthenticationMethod =
  | 'pwd' // Password
  | 'otp' // TOTP/OTP
  | 'hwk' // Hardware key (Passkey/WebAuthn)
  | 'mfa'; // Multi-factor authentication

/**
 * Authentication Context Class Reference values
 * Higher numbers indicate stronger authentication
 */
export type AuthenticationContextClass =
  | 'urn:tinyrack:acr:0' // Session only (no re-authentication)
  | 'urn:tinyrack:acr:1' // Single factor (password OR passkey)
  | 'urn:tinyrack:acr:2'; // Multi-factor (password + TOTP, etc.)

declare module '@fastify/secure-session' {
  interface SessionData {
    user?: {
      id: string;
    };
    /**
     * Time when the user was authenticated (Unix timestamp in seconds)
     * Used for auth_time claim in ID Token (OIDC Core 1.0 §2)
     */
    authenticated_at?: number;
    /**
     * Authentication methods used in the current session (RFC 8176)
     * Used for amr claim in ID Token
     */
    auth_methods?: AuthenticationMethod[];
    /**
     * Authentication context class reference
     * Used for acr claim in ID Token
     */
    acr?: AuthenticationContextClass;
    pendingTotpUser?: {
      id: string;
      /**
       * Auth methods used before TOTP step (for amr tracking)
       */
      auth_methods?: AuthenticationMethod[];
      authenticated_at?: number;
    };
    pendingTotpSetup?: {
      id: string;
    };
    oauth?: {
      state: string;
      codeVerifier: string;
      providerId: string;
      mode: 'login' | 'register' | 'link';
      returnUrl?: string | undefined;
    };
    passkey_challenge?: string;
  }
}

export default fastifyPlugin(
  async (fastify) => {
    // Determine if we're in a secure context (HTTPS)
    const isSecure = fastify.config.app.host.startsWith('https://');

    await fastify.register(fastifySecureSession, {
      cookieName: 'session',
      key: Buffer.from(fastify.config.app.cookie_secret, 'hex'),
      cookie: {
        path: '/',
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? 'strict' : 'lax',
      },
    });
  },
  {
    name: 'secure-session-plugin',
    dependencies: ['cookie-plugin'],
  },
);
