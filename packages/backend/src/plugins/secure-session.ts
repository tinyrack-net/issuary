import fastifySecureSession from '@fastify/secure-session';
import fastifyPlugin from 'fastify-plugin';

declare module '@fastify/secure-session' {
  interface SessionData {
    user?: {
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
