import { writeFileSync } from 'node:fs';
import { createApp, createOpenApiDocumentation } from '@tinyauth/backend';
import { OPENAPI_CONFIG_DEFAULT } from '@tinyauth/backend/config';
import { Command } from 'commander';
import { generateSpecs } from 'hono-openapi';
import type { StandaloneConfigInput } from '#standalone/lib/config/index.js';
import { resolveConfig } from '#standalone/lib/load-config.js';

/**
 * Export OpenAPI command
 *
 * Generates the OpenAPI spec as JSON.
 * Outputs to stdout by default, or to a file if output-path is provided.
 */
export const exportOpenapiCommand = new Command('export:openapi')
  .description('Export the OpenAPI spec as JSON')
  .argument('[output-path]', 'Write spec to file instead of stdout')
  .action(async (outputPath?: string) => {
    const config = {
      logging: {
        level: 'silent',
        format: 'json',
      },
      database: {
        type: 'sqlite',
        test: true,
      },
      security: {
        session_secret:
          '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
        hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
        pbkdf2_iterations: 1000,
      },
    } satisfies StandaloneConfigInput;

    const { app, cleanup, logger } = await createApp(
      await resolveConfig(config),
    );

    try {
      const spec = await generateSpecs(app, {
        documentation: createOpenApiDocumentation(OPENAPI_CONFIG_DEFAULT),
      });

      const json = JSON.stringify(spec, null, 2);

      if (outputPath) {
        writeFileSync(outputPath, json, 'utf-8');
        logger.info({ outputPath }, 'OpenAPI spec written');
      } else {
        process.stdout.write(json);
      }
    } finally {
      await cleanup();
    }
  });
