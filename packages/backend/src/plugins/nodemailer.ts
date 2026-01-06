import fastifyPlugin from 'fastify-plugin';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import { AppConfigs } from '@/lib/config.js';

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
    if (!AppConfigs.smtp?.enabled) {
      return;
    }
    const transporter = nodemailer.createTransport({
      host: AppConfigs.smtp.host,
      port: AppConfigs.smtp.port,
      secure: AppConfigs.smtp.secure,
      auth: {
        user: AppConfigs.smtp.user,
        pass: AppConfigs.smtp.password,
      },
    });
    fastify.decorate('mailTransporter', transporter);
  },
  {
    name: 'nodemailer-plugin',
    dependencies: [],
  },
);
