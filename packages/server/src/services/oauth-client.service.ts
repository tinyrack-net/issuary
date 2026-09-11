import type z from 'zod';
import { OAuthClientEntitySchema } from '../entities/oauth-client.entity.js';
import { e } from '../schemas/error.ts';
import type { r } from '../schemas/response.ts';
import { lockOAuthClient } from './client-security.js';
import type { MikroService } from './mikro.service.ts';
import type { SecurityService } from './security.service.ts';

export interface ClientAuthenticationProof {
  readonly clientId: string;
  readonly id: string;
  readonly epoch: string;
  readonly kind: 'public' | 'confidential';
  readonly fingerprint: string;
}

export class OAuthClientService {
  private readonly mikro: MikroService;
  private readonly securityService: SecurityService;
  public constructor(mikro: MikroService, securityService: SecurityService) {
    this.mikro = mikro;
    this.securityService = securityService;
  }

  /**
   * Find OAuth client by client_id from database.
   * Config clients are now synced to DB via ConfigSeeder.
   */
  public async findByClientId(
    clientId: string,
  ): Promise<z.infer<typeof r.OAuthClient>> {
    const client = await this.mikro.oauthClient.findOneOrFail(
      { clientId, deletedAt: null },
      {
        refresh: true,
        failHandler: () => new e.OAuthClientNotFound.Error(),
      },
    );

    return {
      id: client.id,
      clientId: client.clientId,
      name: client.name,
      managed_by: client.managed_by,
      enabled: client.enabled,
      tokenEpoch: client.tokenEpoch ?? null,
      skipConsent: client.skipConsent,
      redirectUris: client.redirectUris,
      postLogoutRedirectUris: client.postLogoutRedirectUris,
      webOrigins: client.webOrigins,
      responseTypes: client.responseTypes,
      scopes: client.scopes,
      grantTypes: client.grantTypes,
    };
  }

  /**
   * Validate redirect URI
   */
  public validateRedirectUri(
    client: z.infer<typeof r.OAuthClient>,
    redirectUri: string,
  ): void {
    if (!client.redirectUris.includes(redirectUri)) {
      throw new e.InvalidRedirectUri.Error();
    }
  }

  /**
   * Validate response type
   */
  public validateResponseType(
    client: z.infer<typeof r.OAuthClient>,
    responseType: string,
  ): void {
    if (!client.responseTypes.includes(responseType)) {
      throw new e.UnsupportedResponseType.Error();
    }
  }

  public validateGrantType(
    client: z.infer<typeof r.OAuthClient>,
    grantType: string,
  ): void {
    if (!client.grantTypes.includes(grantType)) {
      throw new e.UnsupportedGrantType.Error();
    }
  }

  public validatePostLogoutRedirectUri(
    client: z.infer<typeof r.OAuthClient>,
    postLogoutRedirectUri: string,
  ): void {
    if (!client.postLogoutRedirectUris.includes(postLogoutRedirectUri)) {
      throw new e.InvalidRedirectUri.Error();
    }
  }

  /**
   * Validate scopes
   */
  public validateScopes(
    client: z.infer<typeof r.OAuthClient>,
    requestedScopes: string[],
  ): void {
    const invalidScopes = requestedScopes.filter(
      (scope) => !client.scopes.includes(scope),
    );

    if (invalidScopes.length > 0) {
      throw new e.InvalidScope.Error({ invalidScopes });
    }
  }

  /**
   * Check if client is enabled
   */
  public validateEnabled(client: z.infer<typeof r.OAuthClient>): void {
    if (!client.enabled) {
      throw new e.OAuthClientDisabled.Error();
    }
  }

  public async isAllowedWebOrigin(origin: string): Promise<boolean> {
    const clients = await this.mikro.oauthClient.find({
      enabled: true,
      deletedAt: null,
    });
    return clients.some((client) => client.webOrigins.includes(origin));
  }

  /**
   * Verify client secret using the current PBKDF2 hash format.
   * All clients (including config clients) now have hashed secrets in DB.
   * Public clients (PKCE-only) have null clientSecretHash.
   * @returns true if valid, false otherwise
   */
  public async verifyClientSecret(
    clientId: string,
    clientSecret: string,
  ): Promise<boolean> {
    const client = await this.mikro.oauthClient.findOne(
      { clientId, deletedAt: null },
      { populate: ['clientSecretHash'] },
    );

    if (!client) {
      return false;
    }

    // Public clients don't have a secret - cannot verify
    if (!client.clientSecretHash) {
      return false;
    }

    return this.securityService.verifyClientSecret(
      client.clientSecretHash,
      clientSecret,
    );
  }

  public async validateClientSecretIfRequired(
    clientId: string,
    clientSecret: string | undefined,
  ): Promise<ClientAuthenticationProof> {
    const client = await this.mikro.oauthClient.findOne(
      { clientId, deletedAt: null },
      { populate: ['clientSecretHash'], refresh: true },
    );
    if (!client) throw new e.OAuthClientNotFound.Error();
    const epoch = client.tokenEpoch ?? '';
    const hash = client.clientSecretHash;
    const id = client.id;
    if (
      hash
        ? !clientSecret ||
          !(await this.securityService.verifyClientSecret(hash, clientSecret))
        : Boolean(clientSecret)
    )
      throw new e.InvalidClientCredentials.Error();
    return {
      id,
      clientId,
      epoch,
      kind: hash ? 'confidential' : 'public',
      fingerprint: await this.securityService.hashOpaqueToken(
        'oauth-client-authentication',
        hash ?? 'public',
      ),
    };
  }

  /** Requires an enclosing transaction. The proof is captured before credential verification yields. */
  public async lockAuthenticatedClient(
    proof: ClientAuthenticationProof,
    clientId: string,
    grantType?: string,
  ) {
    if (proof.clientId !== clientId)
      throw new e.InvalidClientCredentials.Error();
    const locked = await lockOAuthClient(this.mikro.em, proof.id);
    const client = locked
      ? await this.mikro.em.findOneOrFail(
          OAuthClientEntitySchema,
          { id: proof.id },
          {
            populate: ['clientSecretHash'],
            refresh: true,
          },
        )
      : null;
    if (
      !client ||
      client.clientId !== clientId ||
      client.deletedAt ||
      !client.enabled
    )
      throw new e.InvalidClientCredentials.Error();
    if ((client.tokenEpoch ?? '') !== proof.epoch) {
      if (grantType === 'authorization_code')
        throw new e.InvalidAuthorizationCode.Error();
      if (grantType === 'refresh_token')
        throw new e.InvalidRefreshToken.Error();
      if (grantType === 'urn:ietf:params:oauth:grant-type:device_code')
        throw new e.InvalidDeviceCode.Error();
      throw new e.InvalidClientCredentials.Error();
    }
    const hash = client.clientSecretHash;
    const fingerprint = await this.securityService.hashOpaqueToken(
      'oauth-client-authentication',
      hash ?? 'public',
    );
    if (
      fingerprint !== proof.fingerprint ||
      (hash ? 'confidential' : 'public') !== proof.kind
    )
      throw new e.InvalidClientCredentials.Error();
    const current = await this.findByClientId(clientId);
    if (grantType) this.validateGrantType(current, grantType);
    return current;
  }

  public async isPublicClient(clientId: string): Promise<boolean> {
    const client = await this.mikro.oauthClient.findOneOrFail(
      { clientId, deletedAt: null },
      {
        failHandler: () => new e.OAuthClientNotFound.Error(),
        populate: ['clientSecretHash'],
      },
    );

    return !client.clientSecretHash;
  }

  public async validateConfidentialClient(clientId: string): Promise<void> {
    if (await this.isPublicClient(clientId)) {
      throw new e.InvalidClientCredentials.Error();
    }
  }
}
