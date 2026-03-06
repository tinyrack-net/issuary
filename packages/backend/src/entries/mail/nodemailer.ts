import nm from 'nodemailer';
import type {
  AppConfigSmtp,
  MailConfigRuntime,
} from '#backend/lib/schema.js';

export function nodemailer(config: AppConfigSmtp): MailConfigRuntime {
  return {
    from: config.from,
    createTransport: async () => {
      const transport = nm.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.password,
        },
      });
      return {
        sendMail: async (options) => {
          const info = await transport.sendMail(options);
          if (config.test) {
            const url = nm.getTestMessageUrl(info);
            if (url) {
              console.log(`[nodemailer] Preview URL: ${url}`);
            }
          }
          return info;
        },
      };
    },
  };
}
