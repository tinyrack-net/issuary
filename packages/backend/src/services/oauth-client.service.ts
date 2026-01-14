import { verify } from 'argon2';
import fastifyPlugin from 'fastify-plugin';
import type z from 'zod/v4';
import type { MikroService } from '@/plugins/mikro-orm.js';
import { e } from '@/schemas/error.js';
import type { r } from '@/schemas/response.js';

declare module 'fastify' {
  interface FastifyInstance {
    oauthClientService: OAuthClientService;
  }
}

export class OAuthClientService {
  public constructor(private readonly mikro: MikroService) {}

  /**
   * Find OAuth client by client_id from database.
   * Config clients are now synced to DB via ConfigSeeder.
   */
  public async findByClientId(
    clientId: string,
  ): Promise<z.infer<typeof r.OAuthClient>> {
    const client = await this.mikro.oauthClient.findOneOrFail(
      { clientId },
      {
        failHandler: () => new e.OAuthClientNotFound.Error(),
      },
    );

    return {
      id: client.id,
      clientId: client.clientId,
      name: client.name,
      managed_by: client.managed_by,
      enabled: client.enabled,
      redirectUris: client.redirectUris,
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

  /**
   * Verify client secret using argon2 hash verification.
   * All clients (including config clients) now have hashed secrets in DB.
   * @returns true if valid, false otherwise
   */
  public async verifyClientSecret(
    clientId: string,
    clientSecret: string,
  ): Promise<boolean> {
    const client = await this.mikro.oauthClient.findOne(
      { clientId },
      { populate: ['clientSecretHash'] },
    );

    if (!client) {
      return false;
    }

    return verify(client.clientSecretHash, clientSecret);
  }
}

export default fastifyPlugin(
  async (fastify) => {
    const oauthClientService = new OAuthClientService(fastify.mikro);
    fastify.decorate('oauthClientService', oauthClientService);
  },
  {
    name: 'oauth-client-service-plugin',
    dependencies: ['base-service-plugin'],
  },
);
