import type { Context } from 'hono';
import z from 'zod';

export type FrontendConfig = (c: Context) => Response | Promise<Response>;

export const FrontendConfigSchema = z
  .custom<FrontendConfig>((val) => typeof val === 'function', {
    message: 'Invalid FrontendConfig: must be a function',
  })
  .optional();
