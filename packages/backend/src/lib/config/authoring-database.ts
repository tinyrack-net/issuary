import z from 'zod';
import { zz } from '#backend/schemas/provider.js';

export const DeclarativeDatabaseSqliteConfigSchema = z
  .object({
    type: z.literal('sqlite').describe('Database type: SQLite.'),
    path: z
      .string()
      .default('/opt/tinyauth/database.db')
      .describe('File path for the SQLite database.'),
    test: zz.COERCE_BOOLEAN.default(false).describe(
      'Whether to use an in-memory database for testing.',
    ),
  })
  .strict()
  .describe('SQLite database configuration.');

export const DeclarativeDatabasePostgresConfigSchema = z
  .object({
    type: z.literal('postgres').describe('Database type: PostgreSQL.'),
    host: z
      .string()
      .default('localhost')
      .describe('PostgreSQL server hostname.'),
    port: zz.PORT.default(5432).describe('PostgreSQL server port.'),
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
