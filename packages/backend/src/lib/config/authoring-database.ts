import z from 'zod';
import { zz } from '#backend/schemas/provider.js';

export const DeclarativeDatabaseSqliteConfigSchema = z
  .object({
    type: z.literal('sqlite'),
    path: z.string().default('/opt/tinyauth/database.db'),
    test: zz.COERCE_BOOLEAN.default(false),
  })
  .strict();

export const DeclarativeDatabasePostgresConfigSchema = z
  .object({
    type: z.literal('postgres'),
    host: z.string().default('localhost'),
    port: zz.PORT.default(5432),
    user: z.string().min(1).default('postgres'),
    password: z.string().min(1).default('postgres'),
    name: z.string().min(1).default('tinyauth'),
  })
  .strict();

export const DeclarativeDatabaseConfigSchema = z
  .discriminatedUnion('type', [
    DeclarativeDatabaseSqliteConfigSchema,
    DeclarativeDatabasePostgresConfigSchema,
  ])
  .default({
    type: 'sqlite',
    path: '/opt/tinyauth/database.db',
    test: false,
  });

export type DeclarativeDatabaseConfig = z.infer<
  typeof DeclarativeDatabaseConfigSchema
>;
