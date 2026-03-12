import z from 'zod';
import { StandaloneBooleanSchema, StandalonePortSchema } from './coerce.js';

export const StandaloneDatabaseSqliteConfigSchema = z
  .object({
    type: z.literal('sqlite').describe('Database type: SQLite.'),
    path: z
      .string()
      .default('/opt/tinyauth/database.db')
      .describe('File path for the SQLite database.'),
    test: StandaloneBooleanSchema.default(false).describe(
      'Whether to use an in-memory database for testing.',
    ),
  })
  .strict()
  .describe('SQLite database configuration.');

export const StandaloneDatabasePostgresConfigSchema = z
  .object({
    type: z.literal('postgres').describe('Database type: PostgreSQL.'),
    host: z
      .string()
      .default('localhost')
      .describe('PostgreSQL server hostname.'),
    port: StandalonePortSchema.default(5432).describe(
      'PostgreSQL server port.',
    ),
    user: z
      .string()
      .min(1)
      .default('postgres')
      .describe('PostgreSQL username.'),
    password: z
      .string()
      .min(1)
      .default('postgres')
      .describe('PostgreSQL password.'),
    name: z
      .string()
      .min(1)
      .default('tinyauth')
      .describe('PostgreSQL database name.'),
  })
  .strict()
  .describe('PostgreSQL database configuration.');

export const StandaloneDatabaseConfigSchema = z
  .discriminatedUnion('type', [
    StandaloneDatabaseSqliteConfigSchema,
    StandaloneDatabasePostgresConfigSchema,
  ])
  .default({
    type: 'sqlite',
    path: '/opt/tinyauth/database.db',
    test: false,
  });

export type StandaloneDatabaseConfig = z.infer<
  typeof StandaloneDatabaseConfigSchema
>;
