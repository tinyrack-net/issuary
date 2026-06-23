import z from 'zod';
import { zz } from '../../schemas/provider.ts';

export const ADMIN_CONFIG_DEFAULT = {
  enabled: false,
};

export const AdminConfigSchema = z
  .object({
    enabled: zz.COERCE_BOOLEAN.default(ADMIN_CONFIG_DEFAULT.enabled),
  })
  .strict()
  .default(ADMIN_CONFIG_DEFAULT)
  .describe('Admin console settings.');

export type AdminConfig = z.infer<typeof AdminConfigSchema>;
