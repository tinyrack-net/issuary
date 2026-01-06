import fastifyPlugin from 'fastify-plugin';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    mailTransporter: nodemailer.Transporter<
      SMTPTransport.SentMessageInfo,
      SMTPTransport.Options
    >;
  }
}

export interface NodeMailerPluginOptions {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
}

export default fastifyPlugin<NodeMailerPluginOptions>(
  (fastify, options) => {
    const transporter = nodemailer.createTransport({
      host: options.smtpHost,
      port: options.smtpPort,
      secure: options.smtpSecure,
      auth: {
        user: options.smtpUser,
        pass: options.smtpPassword,
      },
    });
    fastify.decorate('mailTransporter', transporter);
  },
  {
    name: 'nodemailer-plugin',
    dependencies: [],
  },
);
