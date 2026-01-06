import fastifySecureSession from '@fastify/secure-session';
import fastifyPlugin from 'fastify-plugin';
import { AppConfigs } from '@/lib/config.js';

declare module '@fastify/secure-session' {
  interface SessionData {
    user?: {
      id: string;
    };
  }
}

export default fastifyPlugin(
  async (fastify) => {
    await fastify.register(fastifySecureSession, {
      cookieName: 'session',
      key: Buffer.from(AppConfigs.app.cookie_secret, 'hex'),
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
