import { UserEntity } from '../entities/user.entity.js';
import type { AppEnv } from '../lib/app-env.js';
import { e } from '../schemas/error.js';
import { withBrowserSecurity } from './browser-security.service.js';
import { lockOAuthClient } from './client-security.js';
import type { AuthorizeResult } from './oauth-authorize.service.js';

export interface AuthorizationProof {
  userSub: string;
  userEpoch: string;
  clientId: string;
  clientEpoch: string;
  redirectUri: string;
  responseType: string;
  scopes: string[];
}

export async function completeBrowserAuthorization(
  c: { var: AppEnv['Variables']; req: { path: string } },
  proof: AuthorizationProof,
  operation: () => Promise<AuthorizeResult>,
): Promise<AuthorizeResult> {
  return withBrowserSecurity(
    c,
    async () => {
      const { mikro, oauthClientService } = c.var.services;
      const user = await mikro.em.findOneOrFail(
        UserEntity,
        { sub: proof.userSub },
        { refresh: true },
      );
      if (
        user.deleted_at ||
        user.token_epoch !== proof.userEpoch ||
        c.var.session.authorization.security?.grants[proof.userSub] !==
          proof.userEpoch
      )
        throw new e.Unauthorized.Error();
      const client = await lockOAuthClient(mikro.em, proof.clientId);
      if (
        !client ||
        client.deletedAt ||
        !client.enabled ||
        (client.tokenEpoch ?? '') !== proof.clientEpoch
      )
        throw new e.Unauthorized.Error();
      const current = await oauthClientService.findByClientId(client.clientId);
      oauthClientService.validateRedirectUri(current, proof.redirectUri);
      oauthClientService.validateResponseType(current, proof.responseType);
      oauthClientService.validateGrantType(
        current,
        proof.responseType === 'code' ? 'authorization_code' : 'implicit',
      );
      oauthClientService.validateScopes(current, proof.scopes);
      return operation();
    },
    { targets: [proof.userSub], termsPolicy: 'read' },
  );
}
