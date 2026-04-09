import type { Context } from 'hono';
import z from 'zod';
import type { BrandingConfig } from './branding.ts';
import type { ServerConfig } from './server.ts';

export type FrontendHandler = (c: Context) => Response | Promise<Response>;

export interface FrontendRuntimeContext {
  branding?: BrandingConfig | undefined;
  server?: ServerConfig | undefined;
}

export type FrontendConfig = (
  runtime: FrontendRuntimeContext,
) => FrontendHandler;

export const FrontendConfigSchema = z
  .custom<FrontendConfig>((val) => typeof val === 'function', {
    message: 'Invalid FrontendConfig: must be a function',
  })
  .optional();
