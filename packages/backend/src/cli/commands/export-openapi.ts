import { writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { generateSpecs } from 'hono-openapi';
import { createApp } from '#backend/app.js';
import { OPENAPI_DOCUMENTATION } from '#backend/lib/openapi.js';

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
    const { app, cleanup, logger } = await createApp({
      config: {
        app: {
          cookie_secret:
            '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
          allowed_signup_emails: ['*'],
          frontend: {
            enabled: false,
          },
        },
        logging: {
          level: 'silent',
          format: 'json',
        },
        database: {
          type: 'sqlite',
          test: true,
        },
        smtp: {
          test: true,
        },
      },
    });

    try {
      const spec = await generateSpecs(app, {
        documentation: OPENAPI_DOCUMENTATION,
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
