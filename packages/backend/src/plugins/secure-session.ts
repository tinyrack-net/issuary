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

export type AuthenticationContextClass =
  | 'urn:tinyrack:acr:0' // Session only (no re-authentication)
  | 'urn:tinyrack:acr:1' // Single factor (password OR passkey)
  | 'urn:tinyrack:acr:2'; // Multi-factor (password + TOTP, etc.)

declare module '@fastify/secure-session' {
  interface SessionData {
    user?: {
      id: string;
      authenticated_at: number;
      auth_methods: AuthenticationMethod[];
      acr: AuthenticationContextClass;
    };
    /**
     * Pending 2FA user session.
     * Set after successful password authentication when 2FA is required.
     * User must complete 2FA (TOTP or Passkey) to get full session.
     */
    pending2FAUser?: {
      id: string;
      auth_methods: AuthenticationMethod[];
      authenticated_at: number;
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
