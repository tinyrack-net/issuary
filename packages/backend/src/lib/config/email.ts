import z from 'zod';

export interface EmailTransport {
  sendMail(options: {
    from?: string | undefined;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
}

export interface EmailConfig {
  from?: string | undefined;
  createTransport: () => Promise<EmailTransport>;
}

export const EmailConfigSchema = z
  .custom<EmailConfig>(
    (val) =>
      typeof val === 'object' &&
      val !== null &&
      typeof (val as EmailConfig).createTransport === 'function',
    { message: 'Invalid EmailConfig: must have createTransport function' },
  )
  .optional();

export type EmailRuntimeConfig = EmailConfig;
