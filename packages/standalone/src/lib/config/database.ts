import z from 'zod';

export const StandaloneDatabaseSqliteConfigSchema = z.object({
  type: z.literal('sqlite'),
  path: z.string().default('./test.db'),
  test: z.boolean().default(false),
});

export const StandaloneDatabasePostgresConfigSchema = z.object({
  type: z.literal('postgres'),
  host: z.string().default('localhost'),
  port: z.number().int().min(1).max(65535).default(5432),
  user: z.string().min(1).default('test'),
  password: z.string().min(1).default('test'),
  name: z.string().min(1).default('test'),
});

export const StandaloneDatabaseConfigSchema = z.discriminatedUnion('type', [
  StandaloneDatabaseSqliteConfigSchema,
  StandaloneDatabasePostgresConfigSchema,
]);

export type StandaloneDatabaseConfig = z.infer<
  typeof StandaloneDatabaseConfigSchema
>;
