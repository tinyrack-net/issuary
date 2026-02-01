import z from 'zod/v4';
import { zz } from '@/schemas/provider.js';

export const AppConfigDatabaseMemory = z.object({
  type: z.literal('memory'),
});

export type AppConfigDatabaseMemory = z.infer<typeof AppConfigDatabaseMemory>;

export const AppConfigDatabaseSqlite = z.object({
  type: z.literal('sqlite'),
  path: z.string().optional().default('test.db'),
});

export type AppConfigDatabaseSqlite = z.infer<typeof AppConfigDatabaseSqlite>;

export const AppConfigDatabasePostgres = z.object({
  type: z.literal('postgres'),
  host: z.string().optional().default('localhost'),
  port: zz.PORT.optional().default(5432),
  user: z.string().min(1).optional().default('test'),
  password: z.string().min(1).optional().default('test'),
  name: z.string().min(1).optional().default('test'),
});

export type AppConfigDatabasePostgres = z.infer<
  typeof AppConfigDatabasePostgres
>;

export const AppConfigDatabase = z.discriminatedUnion('type', [
  AppConfigDatabaseMemory,
  AppConfigDatabaseSqlite,
  AppConfigDatabasePostgres,
]);

export type AppConfigDatabase = z.infer<typeof AppConfigDatabase>;
