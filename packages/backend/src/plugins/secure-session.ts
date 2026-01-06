import fastifySecureSession from '@fastify/secure-session';
import fastifyPlugin from 'fastify-plugin';

declare module '@fastify/secure-session' {
  interface SessionData {
    user?: {
      id: string;
    };
  }
}

export interface SecureSessionPluginOptions {
  cookieSecret: string;
}

export default fastifyPlugin<SecureSessionPluginOptions>(
  (fastify, options) => {
    fastify.register(fastifySecureSession, {
      cookieName: 'session',
      key: Buffer.from(options.cookieSecret, 'hex'),
      cookie: {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
      },
    });
  },
  {
    name: 'cookie-plugin',
    dependencies: [],
  },
);
