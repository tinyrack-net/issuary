import fastifySecureSession from '@fastify/secure-session';
import fastifyPlugin from 'fastify-plugin';

declare module '@fastify/secure-session' {
  interface SessionData {
    user?: {
      id: string;
      authenticated_at: number;
    };
    /**
     * Pending 2FA user session.
     * Set after successful password authentication when 2FA is required.
     * User must complete 2FA (TOTP or Passkey) to get full session.
     */
    pending2FAUser?: {
      id: string;
      authenticated_at: number;
    };
    /**
     * Pending 2FA setup session.
     * Set after successful password authentication when 2FA setup is required.
     * User must set up at least one 2FA method to get full session.
     */
    pending2FASetup?: {
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
