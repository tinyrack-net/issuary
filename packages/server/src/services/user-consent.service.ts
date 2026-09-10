import type z from 'zod';
import type { UserConsentEntity } from '../entities/user-consent.entity.ts';
import type { f } from '../schemas/field.ts';
import type { MikroService } from './mikro.service.ts';

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

  /** Resolve grants before displaying, storing, or issuing requested scopes.
   * OIDC Core §11: offline access needs explicit or preconfigured approval.
   * An active, explicitly saved offline grant remains valid until revoked.
   */
  public async resolveScopes(params: {
    userSub: string;
    clientId: string;
    requestedScopes: string[];
    responseType: string;
    prompt?: string | undefined;
    skipConsent?: boolean | undefined;
  }): Promise<string[]> {
    const scopes = [...new Set(params.requestedScopes)];
    if (!scopes.includes('offline_access')) return scopes;

    const permitsOffline =
      params.responseType === 'code' &&
      (params.skipConsent ||
        params.prompt?.split(' ').includes('consent') ||
        (await this.hasConsent(params.userSub, params.clientId, [
          'offline_access',
        ])));
    return permitsOffline
      ? scopes
      : scopes.filter((scope) => scope !== 'offline_access');
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
    skipConsent?: boolean | undefined;
  }): Promise<boolean> {
    const { userSub, clientId, requestedScopes, prompt, skipConsent } = params;

    // If prompt=consent, always show consent screen
    if (prompt?.split(' ').includes('consent')) {
      return true;
    }

    if (skipConsent) {
      return false;
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
