import {
  type DeclarativeDatabaseConfig,
  DeclarativeDatabaseConfigSchema,
  DeclarativeDatabasePostgresConfigSchema,
  DeclarativeDatabaseSqliteConfigSchema,
} from '@tinyauth/backend/config';

export const StandaloneDatabaseSqliteConfigSchema =
  DeclarativeDatabaseSqliteConfigSchema;

export const StandaloneDatabasePostgresConfigSchema =
  DeclarativeDatabasePostgresConfigSchema;

export const StandaloneDatabaseConfigSchema = DeclarativeDatabaseConfigSchema;

export type StandaloneDatabaseConfig = DeclarativeDatabaseConfig;
