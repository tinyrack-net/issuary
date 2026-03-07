import z from 'zod';

export interface MailTransport {
  sendMail(options: {
    from?: string | undefined;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
}

export interface MailConfig {
  from?: string | undefined;
  createTransport: () => Promise<MailTransport>;
}

export const MailConfigSchema = z.custom<MailConfig>(
  (val) =>
    typeof val === 'object' &&
    val !== null &&
    typeof (val as MailConfig).createTransport === 'function',
  { message: 'Invalid MailConfig: must have createTransport function' },
);
