import fastifyPlugin from 'fastify-plugin';
import type z from 'zod';
import type { UserEntity } from '@/entities/user.entity.js';
import { AppConfigs } from '@/lib/config.js';
import type { MikroService } from '@/plugins/mikro-orm.js';
import { e } from '@/schemas/error.js';
import type { r } from '@/schemas/response.js';
import type { OAuthClientService } from './oauth-client.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    oauthAuthorizeService: OAuthAuthorizeService;
  }
}

export interface AuthorizeParams {
  response_type: string;
  redirect_uri: string;
  state?: string | undefined;
  client_id: string;
  code_challenge?: string | undefined;
  code_challenge_method?: 'S256' | 'plain' | undefined;
  scope?: string | undefined;
  nonce?: string | undefined;
  prompt?: 'none' | 'login' | 'consent' | 'select_account' | undefined;
  max_age?: number | undefined;
  display?: 'page' | 'popup' | 'touch' | 'wap' | undefined;
}

export interface AuthorizeResult {
  type: 'redirect';
  url: string;
}

export class OAuthAuthorizeService {
  public constructor(
    private readonly mikro: MikroService,
    private readonly oauthClientService: OAuthClientService,
  ) {}

  /**
   * Handle OAuth authorization request
   */
  public async authorize(params: {
    query: AuthorizeParams;
    userSession?: { id: string };
  }): Promise<AuthorizeResult> {
    const { query, userSession } = params;

    // 1. Validate and fetch OAuth client
    const client = await this.oauthClientService.findByClientId(
      query.client_id,
    );

    // 2. Validate client is enabled
    this.oauthClientService.validateEnabled(client);

    // 3. Validate redirect_uri
    this.oauthClientService.validateRedirectUri(client, query.redirect_uri);

    // 4. Validate response_type
    this.oauthClientService.validateResponseType(client, query.response_type);

    // 5. Validate and parse scope
    const requestedScopes = query.scope ? query.scope.split(' ') : [];
    this.oauthClientService.validateScopes(client, requestedScopes);

    // 6. Validate PKCE
    if (query.code_challenge) {
      this.validatePKCE(query.code_challenge_method || 'S256');
    }

    // 7. Check user session
    if (!userSession?.id) {
      // User not logged in - redirect to login page
      const loginUrl = this.buildLoginRedirectUrl(query);
      return {
        type: 'redirect',
        url: loginUrl,
      };
    }

    // 8. User is logged in - Issue authorization code
    const user = await this.mikro.user.findOneOrFail({
      id: userSession.id,
    });

    const codeParams: {
      client: z.infer<typeof r.OAuthClient>;
      user: typeof user;
      redirectUri: string;
      scope: string[];
      nonce?: string;
      codeChallenge?: string;
      codeChallengeMethod?: 'S256' | 'plain';
    } = {
      client,
      user,
      redirectUri: query.redirect_uri,
      scope: requestedScopes,
    };

    if (query.nonce) {
      codeParams.nonce = query.nonce;
    }
    if (query.code_challenge) {
      codeParams.codeChallenge = query.code_challenge;
    }
    if (query.code_challenge_method) {
      codeParams.codeChallengeMethod = query.code_challenge_method;
    }

    const code = await this.generateAuthorizationCode(codeParams);

    // 9. Redirect back to client with authorization code
    const callbackUrl = this.buildCallbackUrl(
      code,
      query.state,
      query.redirect_uri,
    );

    return {
      type: 'redirect',
      url: callbackUrl,
    };
  }

  /**
   * Validate PKCE parameters
   */
  private validatePKCE(codeChallengeMethod: string): void {
    if (codeChallengeMethod !== 'S256' && codeChallengeMethod !== 'plain') {
      throw new e.InvalidCodeChallengeMethod.Error();
    }
  }

  /**
   * Build login redirect URL
   */
  private buildLoginRedirectUrl(query: AuthorizeParams): string {
    const loginUrl = new URL('/login', AppConfigs.app.host);
    loginUrl.searchParams.set('client_id', query.client_id);
    loginUrl.searchParams.set('redirect_uri', query.redirect_uri);
    loginUrl.searchParams.set('response_type', query.response_type);

    if (query.scope) {
      loginUrl.searchParams.set('scope', query.scope);
    }
    if (query.state) {
      loginUrl.searchParams.set('state', query.state);
    }
    if (query.nonce) {
      loginUrl.searchParams.set('nonce', query.nonce);
    }
    if (query.code_challenge) {
      loginUrl.searchParams.set('code_challenge', query.code_challenge);
    }
    if (query.code_challenge_method) {
      loginUrl.searchParams.set(
        'code_challenge_method',
        query.code_challenge_method,
      );
    }
    if (query.prompt) {
      loginUrl.searchParams.set('prompt', query.prompt);
    }
    if (query.max_age !== undefined) {
      loginUrl.searchParams.set('max_age', query.max_age.toString());
    }
    if (query.display) {
      loginUrl.searchParams.set('display', query.display);
    }

    return loginUrl.toString();
  }

  /**
   * Build callback URL with authorization code
   */
  private buildCallbackUrl(
    code: string,
    state: string | undefined,
    redirectUri: string,
  ): string {
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set('code', code);

    if (state) {
      callbackUrl.searchParams.set('state', state);
    }

    return callbackUrl.toString();
  }

  /**
   * Generate authorization code
   */
  private async generateAuthorizationCode(params: {
    client: z.infer<typeof r.OAuthClient>;
    user: UserEntity;
    redirectUri: string;
    scope: string[];
    nonce?: string;
    codeChallenge?: string;
    codeChallengeMethod?: 'S256' | 'plain';
  }): Promise<string> {
    // Get the OAuthClientEntity from DB (config clients are also synced to DB)
    const clientEntity = await this.mikro.oauthClient.findOneOrFail({
      clientId: params.client.clientId,
    });

    const codeParams: {
      client: typeof clientEntity;
      user: UserEntity;
      redirectUri: string;
      scope: string[];
      nonce?: string;
      codeChallenge?: string;
      codeChallengeMethod?: 'S256' | 'plain';
    } = {
      client: clientEntity,
      user: params.user,
      redirectUri: params.redirectUri,
      scope: params.scope,
    };

    if (params.nonce) {
      codeParams.nonce = params.nonce;
    }
    if (params.codeChallenge) {
      codeParams.codeChallenge = params.codeChallenge;
    }
    if (params.codeChallengeMethod) {
      codeParams.codeChallengeMethod = params.codeChallengeMethod;
    }

    const { code } =
      await this.mikro.oauthCode.generateAuthorizationCode(codeParams);

    return code;
  }
}

export default fastifyPlugin(
  async (fastify) => {
    const oauthAuthorizeService = new OAuthAuthorizeService(
      fastify.mikro,
      fastify.oauthClientService,
    );
    fastify.decorate('oauthAuthorizeService', oauthAuthorizeService);
  },
  {
    name: 'oauth-authorize-service-plugin',
    dependencies: ['base-service-plugin', 'oauth-client-service-plugin'],
  },
);
