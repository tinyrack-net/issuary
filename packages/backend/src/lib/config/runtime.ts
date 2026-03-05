import type { Options } from '@mikro-orm/core';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import type {
  AppConfigDatabasePostgres,
  AppConfigDatabaseSqlite,
  AppConfigSmtp,
} from './schema.js';

export interface SmtpTransport {
  sendMail(options: {
    from?: string | undefined;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<SMTPTransport.SentMessageInfo>;
}

export interface ComposedSmtpConfig extends AppConfigSmtp {
  createTransport: () => Promise<SmtpTransport>;
  getTestMessageUrl: (
    info: SMTPTransport.SentMessageInfo,
  ) => Promise<string | false>;
}

interface DatabaseConfigRuntime {
  getMikroOrmOptions: () => Promise<Options>;
}

export interface ComposedDatabaseConfigPostgres
  extends AppConfigDatabasePostgres,
    DatabaseConfigRuntime {}

export interface ComposedDatabaseConfigSqlite
  extends AppConfigDatabaseSqlite,
    DatabaseConfigRuntime {}

export type ComposedDatabaseConfig =
  | ComposedDatabaseConfigPostgres
  | ComposedDatabaseConfigSqlite;

export function smtp(config: AppConfigSmtp): ComposedSmtpConfig {
  return {
    ...config,
    createTransport: async () => {
      const { default: nodemailer } = await import('nodemailer');
      return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.password,
        },
      });
    },
    getTestMessageUrl: async (info) => {
      if (!config.test) {
        return false;
      }
      const { default: nodemailer } = await import('nodemailer');
      return nodemailer.getTestMessageUrl(info);
    },
  };
}

export function postgres(
  database: AppConfigDatabasePostgres,
): ComposedDatabaseConfigPostgres {
  return {
    ...database,
    getMikroOrmOptions: async () => {
      const { mikroormPostgresConfig } = await import('../../db/postgres.js');
      return mikroormPostgresConfig(database);
    },
  };
}

export function sqlite(
  database: AppConfigDatabaseSqlite,
): ComposedDatabaseConfigSqlite {
  return {
    ...database,
    getMikroOrmOptions: async () => {
      const { mikroormSqliteConfig } = await import('../../db/sqlite.js');
      return mikroormSqliteConfig(database);
    },
  };
}
