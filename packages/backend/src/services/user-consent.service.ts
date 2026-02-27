import type z from 'zod';
import type { UserConsentEntity } from '#backend/entities/user-consent.entity.js';
import type { f } from '#backend/schemas/field.js';
import type { MikroService } from '#backend/services/mikro.service.js';

export class UserConsentService {
  private readonly mikro: MikroService;
  public constructor(mikro: MikroService) {
    this.mikro = mikro;
  }

  /**
   * Check if user has already consented to the requested scopes for a client.
   */
  public async hasConsent(
    userSub: string,
    clientId: string,
    requestedScopes: string[],
  ): Promise<boolean> {
    return this.mikro.userConsent.hasConsent(
      userSub,
      clientId,
      requestedScopes,
    );
  }

  /**
   * Determine if consent screen is required based on:
   * - User's existing consent
   * - The `prompt` parameter from the authorization request
   *
   * @returns true if consent screen should be shown
   */
  public async requiresConsent(params: {
    userSub: string;
    clientId: string;
    requestedScopes: string[];
    prompt?: z.infer<typeof f.prompt> | undefined;
  }): Promise<boolean> {
    const { userSub, clientId, requestedScopes, prompt } = params;

    // If prompt=consent, always show consent screen
    if (prompt === 'consent') {
      return true;
    }

    // Check if user has already consented to all requested scopes
    const hasExistingConsent = await this.hasConsent(
      userSub,
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
    userSub: string;
    clientId: string;
    scopes: string[];
  }): Promise<UserConsentEntity> {
    const { userSub, clientId, scopes } = params;

    return this.mikro.userConsent.grantConsent({
      userSub,
      clientId,
      scopes,
    });
  }
}
