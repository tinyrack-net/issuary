import z from 'zod';
import { zz } from '#backend/schemas/provider.js';

export const DeclarativeSmtpEmailConfigSchema = z
  .object({
    transport: z.literal('smtp').describe('Email transport type: SMTP.'),
    host: z.string().default('localhost').describe('SMTP server hostname.'),
    port: zz.PORT.default(465).describe('SMTP server port.'),
    secure: zz.COERCE_BOOLEAN.default(true).describe(
      'Whether to use TLS for SMTP connection.',
    ),
    user: z.string().min(1).describe('SMTP authentication username.'),
    password: z.string().min(1).describe('SMTP authentication password.'),
    from: z
      .string()
      .optional()
      .describe('Default sender address for outgoing emails.'),
  })
  .strict()
  .describe('SMTP email transport configuration.');

export const DeclarativeTestEmailConfigSchema = z
  .object({
    transport: z
      .literal('test')
      .describe('Email transport type: test (no actual emails sent).'),
    from: z
      .string()
      .optional()
      .describe('Default sender address for test emails.'),
  })
  .strict()
  .describe('Test email transport configuration for development.');

export const DeclarativeEmailConfigSchema = z
  .discriminatedUnion('transport', [
    DeclarativeSmtpEmailConfigSchema,
    DeclarativeTestEmailConfigSchema,
  ])
  .optional();

export type DeclarativeEmailConfig = z.infer<
  typeof DeclarativeEmailConfigSchema
>;
