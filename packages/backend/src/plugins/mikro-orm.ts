import { MikroORM, type Options, RequestContext } from '@mikro-orm/core';
import fastifyPlugin from 'fastify-plugin';
import { getDbConfigs } from '@/db/index.js';
import { EmailVerificationEntity } from '@/entities/email-verification.entity.js';
import { JwtKeyEntity } from '@/entities/jwt-key.entity.js';
import { OAuthClientEntity } from '@/entities/oauth-client.entity.js';
import { OAuthCodeEntity } from '@/entities/oauth-code.entity.js';
import { PasswordResetEntity } from '@/entities/password-reset.entity.js';
import { RevokedTokenEntity } from '@/entities/revoked-token.entity.js';
import { UserEntity } from '@/entities/user.entity.js';
import { UserConsentEntity } from '@/entities/user-consent.entity.js';
import { UserOAuthEntity } from '@/entities/user-oauth.entity.js';
import { UserTotpEntity } from '@/entities/user-totp.entity.js';
import { UserPasskeyEntity } from '@/entities/user-passkey.entity.js';
import { env } from '@/lib/env.js';
import type { EmailVerificationRepository } from '@/repositories/email-verification.repository.js';
import type { JwtKeyRepository } from '@/repositories/jwt-key.repository.js';
import type { OAuthClientRepository } from '@/repositories/oauth-client.repository.js';
import type { OAuthCodeRepository } from '@/repositories/oauth-code.repository.js';
import type { PasswordResetRepository } from '@/repositories/password-reset.repository.js';
import type { RevokedTokenRepository } from '@/repositories/revoked-token.repository.js';
import type { UserRepository } from '@/repositories/user.repository.js';
import type { UserConsentRepository } from '@/repositories/user-consent.repository.js';
import type { UserOAuthRepository } from '@/repositories/user-oauth.repository.js';
import type { UserTotpRepository } from '@/repositories/user-totp.repository.js';
import type { UserPasskeyRepository } from '@/repositories/user-passkey.repository.js';

export interface MikroService {
  orm: MikroORM;
  em: MikroORM['em'];
  user: UserRepository;
  userOAuth: UserOAuthRepository;
  oauthCode: OAuthCodeRepository;
  oauthClient: OAuthClientRepository;
  emailVerification: EmailVerificationRepository;
  passwordReset: PasswordResetRepository;
  jwtKey: JwtKeyRepository;
  revokedToken: RevokedTokenRepository;
  userConsent: UserConsentRepository;
  userTotp: UserTotpRepository;
  userPasskey: UserPasskeyRepository;
}

declare module 'fastify' {
  interface FastifyInstance {
    mikro: MikroService;
  }
}

export default fastifyPlugin(
  async (fastify) => {
    console.log('Initializing MikroORM with config:');

    const configs = getDbConfigs(fastify.config);
    const ormOptions: Options = {
      ...configs,
      debug: false,
      dynamicImportProvider: (id) => import(id),
    };

    const orm = await MikroORM.init(ormOptions);

    if (fastify.config.database.type === 'memory') {
      await orm.schema.refreshDatabase();
    } else if (env.APP_ENV === 'development') {
      await orm.schema.updateSchema();
    } else {
      await orm.migrator.up();
    }

    console.log('MikroORM initialized successfully');

    fastify.decorate('mikro', {
      orm,
      em: orm.em,
      user: orm.em.getRepository(UserEntity),
      userOAuth: orm.em.getRepository(
        UserOAuthEntity,
      ) as unknown as UserOAuthRepository,
      oauthCode: orm.em.getRepository(OAuthCodeEntity),
      oauthClient: orm.em.getRepository(OAuthClientEntity),
      emailVerification: orm.em.getRepository(EmailVerificationEntity),
      passwordReset: orm.em.getRepository(PasswordResetEntity),
      jwtKey: orm.em.getRepository(JwtKeyEntity),
      revokedToken: orm.em.getRepository(RevokedTokenEntity),
      userConsent: orm.em.getRepository(UserConsentEntity),
      userTotp: orm.em.getRepository(UserTotpEntity),
      userPasskey: orm.em.getRepository(UserPasskeyEntity),
    });

    fastify.addHook('onRequest', (_request, _reply, done) => {
      RequestContext.create(orm.em, done);
    });

    fastify.addHook('onClose', async () => {
      await orm.close();
    });
  },
  {
    name: 'mikro-orm-plugin',
  },
);
