import z from 'zod';
import { StandaloneBooleanSchema, StandalonePortSchema } from './coerce.js';

export const StandaloneSmtpEmailConfigSchema = z
  .object({
    transport: z.literal('smtp').describe('Email transport type: SMTP.'),
    host: z.string().default('localhost').describe('SMTP server hostname.'),
    port: StandalonePortSchema.default(465).describe('SMTP server port.'),
    secure: StandaloneBooleanSchema.default(true).describe(
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

export const StandaloneTestEmailConfigSchema = z
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

export const StandaloneEmailConfigSchema = z
  .discriminatedUnion('transport', [
    StandaloneSmtpEmailConfigSchema,
    StandaloneTestEmailConfigSchema,
  ])
  .optional();

export type StandaloneEmailConfig = z.infer<typeof StandaloneEmailConfigSchema>;
