import fastifySecureSession from '@fastify/secure-session';
import type { FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Set full user session.
     * Clears pending2FAUser and pending2FASetup sessions.
     * @param userId - User ID
     * @param authenticatedAt - Authentication timestamp (defaults to current time)
     */
    setUserSession(userId: string, authenticatedAt?: number): void;

    /**
     * Set pending 2FA verification session.
     * Clears user and pending2FASetup sessions.
     * @param userId - User ID
     * @param authenticatedAt - Authentication timestamp (defaults to current time)
     */
    setPending2FASession(userId: string, authenticatedAt?: number): void;

    /**
     * Set pending 2FA setup session.
     * Clears user and pending2FAUser sessions.
     * @param userId - User ID
     */
    setPending2FASetupSession(userId: string): void;

    /**
     * Clear all authentication sessions.
     */
    clearAuthSessions(): void;
  }
}

declare module '@fastify/secure-session' {
  interface SessionData {
    /**
     * @description
     * Full user session.
     */
    user?: {
      id: string;
      authenticated_at: number;
    };

    /**
     * @description
     * Pending 2FA user session.
     * Set after successful password authentication when 2FA is required.
     * User must complete 2FA (TOTP or Passkey) to get full session.
     */
    pending2FAUser?: {
      id: string;
      authenticated_at: number;
    };

    /**
     * @description
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

    /**
     * @description
     * Pending OAuth registration session.
     * Set when a new user authenticates via OAuth but needs to agree to explicit terms.
     * User data is stored here temporarily until terms consent is completed.
     * After consent, user is created in DB and this session is cleared.
     */
    pendingOAuthRegistration?: {
      providerId: string;
      tokens: {
        access_token: string;
        refresh_token?: string | undefined;
        expires_in?: number | undefined;
        token_type: string;
      };
      userInfo: {
        id: string;
        email: string;
        email_verified: boolean;
        name?: string | undefined;
        picture?: string | undefined;
      };
      returnUrl?: string | undefined;
      expiresAt: number;
    };

    passkey_challenge?: string;
  }
}

function setUserSession(
  this: FastifyRequest,
  userId: string,
  authenticatedAt?: number,
): void {
  this.session.set('pending2FAUser', undefined);
  this.session.set('pending2FASetup', undefined);
  this.session.set('user', {
    id: userId,
    authenticated_at: authenticatedAt ?? Math.floor(Date.now() / 1000),
  });
}

function setPending2FASession(
  this: FastifyRequest,
  userId: string,
  authenticatedAt?: number,
): void {
  this.session.set('user', undefined);
  this.session.set('pending2FASetup', undefined);
  this.session.set('pending2FAUser', {
    id: userId,
    authenticated_at: authenticatedAt ?? Math.floor(Date.now() / 1000),
  });
}

function setPending2FASetupSession(this: FastifyRequest, userId: string): void {
  this.session.set('user', undefined);
  this.session.set('pending2FAUser', undefined);
  this.session.set('pending2FASetup', {
    id: userId,
  });
}

function clearAuthSessions(this: FastifyRequest): void {
  this.session.set('user', undefined);
  this.session.set('pending2FAUser', undefined);
  this.session.set('pending2FASetup', undefined);
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
        sameSite: 'lax',
      },
    });

    fastify.decorateRequest('setUserSession', setUserSession);
    fastify.decorateRequest('setPending2FASession', setPending2FASession);
    fastify.decorateRequest(
      'setPending2FASetupSession',
      setPending2FASetupSession,
    );
    fastify.decorateRequest('clearAuthSessions', clearAuthSessions);
  },
  {
    name: 'secure-session-plugin',
    dependencies: ['cookie-plugin'],
  },
);
