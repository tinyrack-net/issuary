import z from 'zod';
import { zz } from '#backend/schemas/provider.js';

export const DeclarativeSmtpEmailConfigSchema = z
  .object({
    transport: z.literal('smtp'),
    host: z.string().default('localhost'),
    port: zz.PORT.default(465),
    secure: zz.COERCE_BOOLEAN.default(true),
    user: z.string().min(1),
    password: z.string().min(1),
    from: z.string().optional(),
  })
  .strict();

export const DeclarativeTestEmailConfigSchema = z
  .object({
    transport: z.literal('test'),
    from: z.string().optional(),
  })
  .strict();

export const DeclarativeEmailConfigSchema = z
  .discriminatedUnion('transport', [
    DeclarativeSmtpEmailConfigSchema,
    DeclarativeTestEmailConfigSchema,
  ])
  .optional();

export type DeclarativeEmailConfig = z.infer<
  typeof DeclarativeEmailConfigSchema
>;
