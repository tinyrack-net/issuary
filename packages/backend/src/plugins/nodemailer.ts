import { AppConfigs } from '@/lib/config.js';
import { env } from '@/lib/env.js';
import fastifyPlugin from 'fastify-plugin';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    mail: {
      transporter: nodemailer.Transporter<
        SMTPTransport.SentMessageInfo,
        SMTPTransport.Options
      > | null;
      test: boolean;
    };
  }
}

export default fastifyPlugin(
  async (fastify) => {
    // Use Ethereal Email for test environment
    if (env.APP_ENV === 'test') {
      // Create a test account automatically
      const testAccount = await nodemailer.createTestAccount();
      console.log('Created Ethereal test account:', testAccount.user);

      const mockTransport = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      fastify.decorate('mail', {
        transporter: mockTransport,
        test: true,
      });
      console.log('✉️  Ethereal Email configured for testing');
    } else if (AppConfigs.smtp) {
      // Use configured SMTP for dev/production
      const transport = nodemailer.createTransport({
        host: AppConfigs.smtp.host,
        port: AppConfigs.smtp.port,
        secure: AppConfigs.smtp.secure,
        auth: {
          user: AppConfigs.smtp.user,
          pass: AppConfigs.smtp.password,
        },
      });

      fastify.decorate('mail', {
        transporter: transport,
        test: false,
      });
      console.log('✉️  SMTP configured:', AppConfigs.smtp.host);
    } else {
      // No email configuration - create a dummy transporter
      fastify.decorate('mail', {
        transporter: null,
        test: false,
      });
      console.warn('⚠️  No email configuration found, emails will not be sent');
      return;
    }
  },
  {
    name: 'nodemailer-plugin',
    dependencies: [],
  },
);
