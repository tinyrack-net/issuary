import z from 'zod';

export const StandaloneSmtpConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().int().min(1).max(65535).default(465),
  secure: z.boolean().default(true),
  user: z.string().min(1),
  password: z.string().min(1),
  from: z.string().optional(),
  test: z.boolean().default(false),
});

export const StandaloneSmtpUnionSchema = z
  .discriminatedUnion('test', [
    StandaloneSmtpConfigSchema.extend({
      test: z.literal(false),
    }),
    z.object({
      test: z.literal(true),
    }),
  ])
  .optional();

export type StandaloneSmtpConfig = z.infer<typeof StandaloneSmtpConfigSchema>;
