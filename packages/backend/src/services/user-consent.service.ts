import type { UserConsentEntity } from '@backend/entities/user-consent.entity.js';
import type { f } from '@backend/schemas/field.js';
import type { MikroService } from '@backend/services/mikro.types.js';
import type z from 'zod';

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
    prompt?: z.infer<typeof f.prompt> | undefined;
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
