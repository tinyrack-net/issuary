import { OAuthClientEntity } from '@/entities/oauth-client.entity.js';
import { OAuthCodeEntity } from '@/entities/oauth-code.entity.js';
import { UserEntity } from '@/entities/user.entity.js';
import { AppConfigs } from '@/lib/config.js';
import type { OAuthClientRepository } from '@/repositories/oauth-client.repository.js';
import type { OAuthCodeRepository } from '@/repositories/oauth-code.repository.js';
import type { UserRepository } from '@/repositories/user.repository.js';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import fastifyPlugin from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    mikro: {
      orm: MikroORM;
      em: MikroORM['em'];
      user: UserRepository;
      oauthCode: OAuthCodeRepository;
      oauthClient: OAuthClientRepository;
    };
  }
}

export default fastifyPlugin(
  async (fastify) => {
    console.log('Initializing MikroORM with config:');

    const orm = await MikroORM.init();

    await orm.migrator.up();

    if (AppConfigs.debug.test_mode) {
      await orm.schema.refreshDatabase();
    }

    console.log('MikroORM initialized successfully');

    fastify.decorate('mikro', {
      orm,
      em: orm.em,
      user: orm.em.getRepository(UserEntity),
      oauthCode: orm.em.getRepository(OAuthCodeEntity),
      oauthClient: orm.em.getRepository(OAuthClientEntity),
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
