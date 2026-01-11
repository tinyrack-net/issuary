import fastifySecureSession from '@fastify/secure-session';
import fastifyPlugin from 'fastify-plugin';
import { AppConfigs } from '@/lib/config.js';

declare module '@fastify/secure-session' {
  interface SessionData {
    user?: {
      id: string;
    };
    oauth?: {
      state: string;
      codeVerifier: string;
      providerName: string;
      mode: 'login' | 'register' | 'link';
      returnUrl?: string | undefined;
    };
  }
}

export default fastifyPlugin(
  async (fastify) => {
    // Determine if we're in a secure context (HTTPS)
    const isSecure = AppConfigs.app.host.startsWith('https://');

    await fastify.register(fastifySecureSession, {
      cookieName: 'session',
      key: Buffer.from(AppConfigs.app.cookie_secret, 'hex'),
      cookie: {
        path: '/',
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? 'strict' : 'lax',
      },
    });
  },
  {
    name: 'cookie-plugin',
    dependencies: [],
  },
);
