import type { MikroORM, Options } from '@mikro-orm/core';

export type DatabaseConfigRuntime = {
  getMikroOrmOptions: () => Promise<Options>;
  initialize: (orm: MikroORM) => Promise<void>;
};
