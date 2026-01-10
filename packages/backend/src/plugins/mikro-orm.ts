import configs from '@/db/index.js';
import { EmailVerificationEntity } from '@/entities/email-verification.entity.js';
import { JwtKeyEntity } from '@/entities/jwt-key.entity.js';
import { OAuthClientEntity } from '@/entities/oauth-client.entity.js';
import { OAuthCodeEntity } from '@/entities/oauth-code.entity.js';
import { RevokedTokenEntity } from '@/entities/revoked-token.entity.js';
import { UserConsentEntity } from '@/entities/user-consent.entity.js';
import { UserEntity } from '@/entities/user.entity.js';
import { AppConfigs } from '@/lib/config.js';
import { env } from '@/lib/env.js';
import type { EmailVerificationRepository } from '@/repositories/email-verification.repository.js';
import type { JwtKeyRepository } from '@/repositories/jwt-key.repository.js';
import type { OAuthClientRepository } from '@/repositories/oauth-client.repository.js';
import type { OAuthCodeRepository } from '@/repositories/oauth-code.repository.js';
import type { RevokedTokenRepository } from '@/repositories/revoked-token.repository.js';
import type { UserConsentRepository } from '@/repositories/user-consent.repository.js';
import type { UserRepository } from '@/repositories/user.repository.js';
import { MikroORM, type Options, RequestContext } from '@mikro-orm/core';
import fastifyPlugin from 'fastify-plugin';
// import { TestSeeder } from '@/seeders/test-seeder.js';

export interface MikroService {
  orm: MikroORM;
  em: MikroORM['em'];
  user: UserRepository;
  oauthCode: OAuthCodeRepository;
  oauthClient: OAuthClientRepository;
  emailVerification: EmailVerificationRepository;
  jwtKey: JwtKeyRepository;
  revokedToken: RevokedTokenRepository;
  userConsent: UserConsentRepository;
}

declare module 'fastify' {
  interface FastifyInstance {
    mikro: MikroService;
  }
}

export default fastifyPlugin(
  async (fastify) => {
    console.log('Initializing MikroORM with config:');

    const ormOptions: Options = {
      ...configs,
      debug: false,
      dynamicImportProvider: (id) => import(id),
    };

    const orm = await MikroORM.init(ormOptions);

    if (AppConfigs.database.type === 'memory') {
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
      oauthCode: orm.em.getRepository(OAuthCodeEntity),
      oauthClient: orm.em.getRepository(OAuthClientEntity),
      emailVerification: orm.em.getRepository(EmailVerificationEntity),
      jwtKey: orm.em.getRepository(JwtKeyEntity),
      revokedToken: orm.em.getRepository(RevokedTokenEntity),
      userConsent: orm.em.getRepository(UserConsentEntity),
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
