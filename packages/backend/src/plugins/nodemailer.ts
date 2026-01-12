import fastifyPlugin from 'fastify-plugin';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';

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
    if (fastify.config.smtp) {
      // Use configured SMTP for dev/production
      const transport = nodemailer.createTransport({
        host: fastify.config.smtp.host,
        port: fastify.config.smtp.port,
        secure: fastify.config.smtp.secure,
        auth: {
          user: fastify.config.smtp.user,
          pass: fastify.config.smtp.password,
        },
      });
      fastify.decorate('transporter', transport);
      console.log('✉️  SMTP configured:', fastify.config.smtp.host);
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
