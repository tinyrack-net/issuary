import fastifyPlugin from 'fastify-plugin';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import { AppConfigs } from '@/lib/config.js';

declare module 'fastify' {
  interface FastifyInstance {
    transporter: nodemailer.Transporter<
      SMTPTransport.SentMessageInfo,
      SMTPTransport.Options
    > | null;
  }
}

export default fastifyPlugin(
  async (fastify) => {
    // Use Ethereal Email for test environment
    if (AppConfigs.smtp) {
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
      fastify.decorate('transporter', transport);
      console.log('✉️  SMTP configured:', AppConfigs.smtp.host);
    } else {
      // No email configuration - create a dummy transporter
      fastify.decorate('transporter', null);
      console.warn('⚠️  No email configuration found, emails will not be sent');
      return;
    }
  },
  {
    name: 'nodemailer-plugin',
    dependencies: [],
  },
);
