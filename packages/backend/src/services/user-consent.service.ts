import fastifyPlugin from 'fastify-plugin';
import type { UserConsentEntity } from '@/entities/user-consent.entity.js';
import type { MikroService } from '@/plugins/core/mikro-orm.js';

declare module 'fastify' {
  interface FastifyInstance {
    userConsentService: UserConsentService;
  }
}

export class UserConsentService {
  public constructor(private readonly mikro: MikroService) {}

  /**
   * Check if user has already consented to the requested scopes for a client.
   */
  public async hasConsent(
    userId: string,
    clientId: string,
    requestedScopes: string[],
  ): Promise<boolean> {
    return this.mikro.userConsent.hasConsent(userId, clientId, requestedScopes);
  }

  /**
   * Determine if consent screen is required based on:
   * - User's existing consent
   * - The `prompt` parameter from the authorization request
   *
   * @returns true if consent screen should be shown
   */
  public async requiresConsent(params: {
    userId: string;
    clientId: string;
    requestedScopes: string[];
    prompt?: 'none' | 'login' | 'consent' | 'select_account' | undefined;
  }): Promise<boolean> {
    const { userId, clientId, requestedScopes, prompt } = params;

    // If prompt=consent, always show consent screen
    if (prompt === 'consent') {
      return true;
    }

    // Check if user has already consented to all requested scopes
    const hasExistingConsent = await this.hasConsent(
      userId,
      clientId,
      requestedScopes,
    );

    // If user has existing consent for all scopes, no need to show consent screen
    return !hasExistingConsent;
  }

  /**
   * Grant consent for a user to a client with specific scopes.
   */
  public async grantConsent(params: {
    userId: string;
    clientId: string;
    scopes: string[];
  }): Promise<UserConsentEntity> {
    const { userId, clientId, scopes } = params;

    return this.mikro.userConsent.grantConsent({
      userId,
      clientId,
      scopes,
    });
  }

  /**
   * Revoke consent for a user to a specific client.
   */
  public async revokeConsent(
    userId: string,
    clientId: string,
  ): Promise<boolean> {
    return this.mikro.userConsent.revokeConsent(userId, clientId);
  }

  /**
   * Revoke all consents for a user.
   */
  public async revokeAllConsents(userId: string): Promise<number> {
    return this.mikro.userConsent.revokeAllConsents(userId);
  }

  /**
   * Get all active consents for a user.
   */
  public async findAllConsents(userId: string): Promise<UserConsentEntity[]> {
    return this.mikro.userConsent.findAllConsents(userId);
  }

  /**
   * Find consent for a specific user and client.
   */
  public async findConsent(
    userId: string,
    clientId: string,
  ): Promise<UserConsentEntity | null> {
    return this.mikro.userConsent.findConsent(userId, clientId);
  }
}

export default fastifyPlugin(
  async (fastify) => {
    const userConsentService = new UserConsentService(fastify.mikro);
    fastify.decorate('userConsentService', userConsentService);
  },
  {
    name: 'user-consent-service-plugin',
    dependencies: ['base-service-plugin'],
  },
);
