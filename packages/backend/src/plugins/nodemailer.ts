import fastifyPlugin from 'fastify-plugin';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
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
  (fastify) => {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });
    fastify.decorate('mailTransporter', transporter);
  },
  {
    name: 'nodemailer-plugin',
    dependencies: [],
  },
);
