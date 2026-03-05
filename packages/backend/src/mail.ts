import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import type { AppConfigSmtp } from './lib/config/schema.js';

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
