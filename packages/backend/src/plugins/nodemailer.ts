import fastifyPlugin from 'fastify-plugin';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import { AppConfigs } from '@/lib/config.js';
import { env } from '@/lib/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    mailTransporter: nodemailer.Transporter<
      SMTPTransport.SentMessageInfo,
      SMTPTransport.Options
    >;
  }
}

export default fastifyPlugin(
  async (fastify) => {
    let transporter: nodemailer.Transporter<
      SMTPTransport.SentMessageInfo,
      SMTPTransport.Options
    >;

    // Use Ethereal Email for test environment
    if (env.APP_ENV === 'test') {
      const testAccount = await nodemailer.createTestAccount();
      console.log('Created Ethereal test account:', testAccount.user);

      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      console.log('✉️  Ethereal Email configured for testing');
    } else if (AppConfigs.smtp?.enabled) {
      // Use configured SMTP for dev/production
      transporter = nodemailer.createTransport({
        host: AppConfigs.smtp.host,
        port: AppConfigs.smtp.port,
        secure: AppConfigs.smtp.secure,
        auth: {
          user: AppConfigs.smtp.user,
          pass: AppConfigs.smtp.password,
        },
      });

      console.log('✉️  SMTP configured:', AppConfigs.smtp.host);
    } else {
      // No email configuration - create a dummy transporter
      console.warn('⚠️  No email configuration found, emails will not be sent');
      return;
    }

    fastify.decorate('mailTransporter', transporter);
  },
  {
    name: 'nodemailer-plugin',
    dependencies: [],
  },
);
