import type { MikroORM, Options } from '@mikro-orm/core';

export type DatabaseConfig = {
  getMikroOrmOptions: () => Promise<Options>;
  initialize: (orm: MikroORM) => Promise<void>;
};
