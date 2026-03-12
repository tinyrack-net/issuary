import z from 'zod';
import { zz } from '#backend/schemas/provider.js';

export const OPENAPI_CONFIG_DEFAULT = {
  enabled: true,
  title: 'TinyAuth API',
  description: 'OpenID Connect Provider API',
  ui_title: 'TinyAuth API Reference',
} as const;

export const OpenApiConfigSchema = z
  .object({
    enabled: zz.COERCE_BOOLEAN.default(OPENAPI_CONFIG_DEFAULT.enabled).describe(
      'Whether live OpenAPI JSON and Scalar UI routes are exposed.',
    ),
    title: z
      .string()
      .default(OPENAPI_CONFIG_DEFAULT.title)
      .describe('OpenAPI document title.'),
    description: z
      .string()
      .default(OPENAPI_CONFIG_DEFAULT.description)
      .describe('OpenAPI document description.'),
    ui_title: z
      .string()
      .default(OPENAPI_CONFIG_DEFAULT.ui_title)
      .describe('Browser page title for the Scalar API reference UI.'),
  })
  .strict()
  .default(OPENAPI_CONFIG_DEFAULT)
  .describe('OpenAPI and API reference settings.');

export type OpenApiConfig = z.infer<typeof OpenApiConfigSchema>;
