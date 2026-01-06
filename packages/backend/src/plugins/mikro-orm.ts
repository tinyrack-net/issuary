import { MikroORM, type Options, RequestContext } from '@mikro-orm/core';
import fastifyPlugin from 'fastify-plugin';
import configs from '@/db/index.js';
import { OAuthClientEntity } from '@/entities/oauth-client.entity.js';
import { OAuthCodeEntity } from '@/entities/oauth-code.entity.js';
import { UserEntity } from '@/entities/user.entity.js';
import type { OAuthClientRepository } from '@/repositories/oauth-client.repository.js';
import type { OAuthCodeRepository } from '@/repositories/oauth-code.repository.js';
import type { UserRepository } from '@/repositories/user.repository.js';

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

export interface MikroORMPluginOptions {
  mode: 'test' | 'test-database' | 'development' | 'production';
}

export default fastifyPlugin<MikroORMPluginOptions>(
  async (fastify, options) => {
    console.log('Initializing MikroORM with config:');

    const ormOptions: Options = {
      ...configs,
      debug: options.mode !== 'production',
      dynamicImportProvider: id => import(id),
    };

    if (options.mode === 'test') {
      ormOptions.dbName = ':memory:';
    }

    const orm = await MikroORM.init(ormOptions);

    console.log(options.mode);

    if (options.mode === 'test') {
      await orm.schema.createSchema();
    } else if (options.mode === 'test-database') {
      await orm.schema.refreshDatabase();
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
