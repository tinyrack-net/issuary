import { MikroORM, type Options, RequestContext } from '@mikro-orm/core';
import fastifyPlugin from 'fastify-plugin';
import configs from '@/db/index.js';
import { EmailVerificationEntity } from '@/entities/email-verification.entity.js';
import { OAuthClientEntity } from '@/entities/oauth-client.entity.js';
import { OAuthCodeEntity } from '@/entities/oauth-code.entity.js';
import { UserEntity } from '@/entities/user.entity.js';
import { AppConfigs } from '@/lib/config.js';
import { env } from '@/lib/env.js';
import type { EmailVerificationRepository } from '@/repositories/email-verification.repository.js';
import type { OAuthClientRepository } from '@/repositories/oauth-client.repository.js';
import type { OAuthCodeRepository } from '@/repositories/oauth-code.repository.js';
import type { UserRepository } from '@/repositories/user.repository.js';
// import { TestSeeder } from '@/seeders/test-seeder.js';

export interface MikroService {
  orm: MikroORM;
  em: MikroORM['em'];
  user: UserRepository;
  oauthCode: OAuthCodeRepository;
  oauthClient: OAuthClientRepository;
  emailVerification: EmailVerificationRepository;
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
      debug: env.APP_ENV !== 'production',
      dynamicImportProvider: (id) => import(id),
    };

    const orm = await MikroORM.init(ormOptions);

    if (AppConfigs.database.type === 'memory') {
      await orm.schema.createSchema();
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
