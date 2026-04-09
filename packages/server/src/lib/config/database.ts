import type { MikroORM, Options } from '@mikro-orm/core';
import z from 'zod';

export type DatabaseConfig = {
  getMikroOrmOptions: () => Promise<Partial<Options>>;
  initialize: (orm: MikroORM) => Promise<void>;
};

export const DatabaseConfigSchema = z.custom<DatabaseConfig>(
  (val) =>
    typeof val === 'object' &&
    val !== null &&
    typeof (val as DatabaseConfig).getMikroOrmOptions === 'function' &&
    typeof (val as DatabaseConfig).initialize === 'function',
  {
    message:
      'Invalid DatabaseConfig: must have getMikroOrmOptions and initialize functions',
  },
);
