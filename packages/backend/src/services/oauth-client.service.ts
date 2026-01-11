import { verify } from 'argon2';
import fastifyPlugin from 'fastify-plugin';
import type z from 'zod/v4';
import { AppConfigs } from '@/lib/config.js';
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
   * Find OAuth client by client_id from both config and database
   */
  public async findByClientId(
    clientId: string,
  ): Promise<z.infer<typeof r.OAuthClient>> {
    // Check config first
    const configClient = AppConfigs.providers?.find(
      (p) => p.client_id === clientId,
    );

    if (configClient) {
      // Parse scope string to array
      const scopes = configClient.scope ? configClient.scope.split(' ') : [];

      return {
        id: configClient.id,
        clientId: configClient.client_id,
        name: configClient.name,
        managed: 'config',
        enabled: true, // Config clients are always enabled
        redirectUris: configClient.redirect_uris,
        responseTypes: configClient.response_types,
        scopes: scopes,
        grantTypes: configClient.grant_types,
      };
    }

    // Check database
    const dbClient = await this.mikro.oauthClient.findOneOrFail(
      { clientId },
      {
        populate: ['clientSecretHash'],
        failHandler: () => new e.OAuthClientNotFound.Error(),
      },
    );

    return {
      id: dbClient.id,
      clientId: dbClient.clientId,
      name: dbClient.name,
      managed: 'database',
      enabled: dbClient.enabled,
      redirectUris: dbClient.redirectUris,
      responseTypes: dbClient.responseTypes,
      scopes: dbClient.scopes,
      grantTypes: dbClient.grantTypes,
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
   * Verify client secret
   * @returns true if valid, false otherwise
   */
  public async verifyClientSecret(
    clientId: string,
    clientSecret: string,
  ): Promise<boolean> {
    // Check config first
    const configClient = AppConfigs.providers?.find(
      (p) => p.client_id === clientId,
    );

    if (configClient) {
      // Config clients: plain text comparison
      return configClient.client_secret === clientSecret;
    }

    // Check database: use argon2 hash verification
    const dbClient = await this.mikro.oauthClient.findOne(
      { clientId },
      { populate: ['clientSecretHash'] },
    );

    if (!dbClient) {
      return false;
    }

    return verify(dbClient.clientSecretHash, clientSecret);
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
