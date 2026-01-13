import fastifyPlugin from 'fastify-plugin';
import type z from 'zod/v4';
import type { AppConfig } from '@/lib/config.js';
import type { MikroService } from '@/plugins/mikro-orm.js';
import { e } from '@/schemas/error.js';
import type { oauthSchema } from '@/schemas/oauth.js';
import type { OAuthClientService } from './oauth-client.service.js';
import type { UserConsentService } from './user-consent.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    oauthAuthorizeService: OAuthAuthorizeService;
  }
}

export class OAuthAuthorizeService {
  public constructor(
    private readonly config: AppConfig,
    private readonly mikro: MikroService,
    private readonly oauthClientService: OAuthClientService,
    private readonly userConsentService: UserConsentService,
  ) {}

  /**
   * Handle OAuth authorization request
   */
  public async authorize(params: {
    query: z.infer<typeof oauthSchema.AuthorizeParams>;
    userSession?: { id: string };
  }): Promise<z.infer<typeof oauthSchema.AuthorizeResult>> {
    const { query, userSession } = params;

    // 1. Validate and fetch OAuth client DTO for validation methods
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
      // Handle prompt=none - must return error if not logged in
      if (query.prompt === 'none') {
        return {
          type: 'redirect',
          url: this.buildErrorRedirectUrl(
            query.redirect_uri,
            'login_required',
            'The Authorization Server requires End-User authentication.',
            query.state,
          ),
        };
      }

      // User not logged in - redirect to login page
      const loginUrl = this.buildLoginRedirectUrl(query);
      return {
        type: 'redirect',
        url: loginUrl,
      };
    }

    // 8. User is logged in - Verify user exists
    const userCount = await this.mikro.user.count({ id: userSession.id });
    if (userCount === 0) {
      throw new e.UserNotFound.Error();
    }

    // 9. Check if consent is required (using IDs, not entities)
    const requiresConsent = await this.userConsentService.requiresConsent({
      userId: userSession.id,
      clientId: client.id,
      requestedScopes,
      prompt: query.prompt,
    });

    if (requiresConsent) {
      // Handle prompt=none - must return error if consent is required
      if (query.prompt === 'none') {
        return {
          type: 'redirect',
          url: this.buildErrorRedirectUrl(
            query.redirect_uri,
            'consent_required',
            'The Authorization Server requires End-User consent.',
            query.state,
          ),
        };
      }

      // Redirect to consent page
      const consentUrl = this.buildConsentRedirectUrl(query);
      return {
        type: 'redirect',
        url: consentUrl,
      };
    }

    const codeParams: {
      clientId: string;
      userId: string;
      redirectUri: string;
      scope: string[];
      nonce?: string;
      codeChallenge?: string;
      codeChallengeMethod?: 'S256' | 'plain';
    } = {
      clientId: client.id,
      userId: userSession.id,
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

    // 10. Redirect back to client with authorization code
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
  private buildLoginRedirectUrl(
    query: z.infer<typeof oauthSchema.AuthorizeParams>,
  ): string {
    const loginUrl = new URL('/login', this.config.app.host);
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
   * Build consent redirect URL
   */
  private buildConsentRedirectUrl(
    query: z.infer<typeof oauthSchema.AuthorizeParams>,
  ): string {
    const consentUrl = new URL('/consent', this.config.app.host);
    consentUrl.searchParams.set('client_id', query.client_id);
    consentUrl.searchParams.set('redirect_uri', query.redirect_uri);
    consentUrl.searchParams.set('response_type', query.response_type);

    if (query.scope) {
      consentUrl.searchParams.set('scope', query.scope);
    }
    if (query.state) {
      consentUrl.searchParams.set('state', query.state);
    }
    if (query.nonce) {
      consentUrl.searchParams.set('nonce', query.nonce);
    }
    if (query.code_challenge) {
      consentUrl.searchParams.set('code_challenge', query.code_challenge);
    }
    if (query.code_challenge_method) {
      consentUrl.searchParams.set(
        'code_challenge_method',
        query.code_challenge_method,
      );
    }
    if (query.prompt) {
      consentUrl.searchParams.set('prompt', query.prompt);
    }
    if (query.max_age !== undefined) {
      consentUrl.searchParams.set('max_age', query.max_age.toString());
    }
    if (query.display) {
      consentUrl.searchParams.set('display', query.display);
    }

    return consentUrl.toString();
  }

  /**
   * Build error redirect URL (for OAuth errors that should redirect back)
   */
  private buildErrorRedirectUrl(
    redirectUri: string,
    error: string,
    errorDescription: string,
    state?: string,
  ): string {
    const errorUrl = new URL(redirectUri);
    errorUrl.searchParams.set('error', error);
    errorUrl.searchParams.set('error_description', errorDescription);

    if (state) {
      errorUrl.searchParams.set('state', state);
    }

    return errorUrl.toString();
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
    clientId: string;
    userId: string;
    redirectUri: string;
    scope: string[];
    nonce?: string;
    codeChallenge?: string;
    codeChallengeMethod?: 'S256' | 'plain';
  }): Promise<string> {
    const codeParams: {
      clientId: string;
      userId: string;
      redirectUri: string;
      scope: string[];
      nonce?: string;
      codeChallenge?: string;
      codeChallengeMethod?: 'S256' | 'plain';
    } = {
      clientId: params.clientId,
      userId: params.userId,
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
      fastify.config,
      fastify.mikro,
      fastify.oauthClientService,
      fastify.userConsentService,
    );
    fastify.decorate('oauthAuthorizeService', oauthAuthorizeService);
  },
  {
    name: 'oauth-authorize-service-plugin',
    dependencies: [
      'base-service-plugin',
      'oauth-client-service-plugin',
      'user-consent-service-plugin',
    ],
  },
);
