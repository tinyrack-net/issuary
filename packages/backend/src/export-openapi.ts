import { writeFileSync } from 'node:fs';
import { createServer } from '@backend/server.js';
import { MINIMAL_TEST_CONFIG } from '@backend/test-utils/setup.js';
import { generateSpecs } from 'hono-openapi';

/**
 * Export the OpenAPI spec as JSON.
 *
 * Usage:
 *   tsx src/export-openapi.ts [output-path]
 *
 * If output-path is provided, writes to that file.
 * Otherwise, writes to stdout.
 */
async function main() {
  const outputPath = process.argv[2];

  const { app, cleanup } = await createServer({
    config: MINIMAL_TEST_CONFIG,
    skipListen: true,
    silent: true,
  });

  const spec = await generateSpecs(app, {
    documentation: {
      info: {
        title: 'TinyAuth API',
        version: '1.0.0',
        description: 'OpenID Connect Provider API',
      },
    },
  });

  const json = JSON.stringify(spec, null, 2);

  if (outputPath) {
    writeFileSync(outputPath, json, 'utf-8');
    console.info(`OpenAPI spec written to ${outputPath}`);
  } else {
    process.stdout.write(json);
  }

  await cleanup();
}

main().catch((err) => {
  console.error('Failed to export OpenAPI spec:', err);
  process.exit(1);
});
