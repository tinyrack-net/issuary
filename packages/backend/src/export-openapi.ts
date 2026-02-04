import { writeFileSync } from 'node:fs';
import { createServer } from '@/server.js';
import { MINIMAL_TEST_CONFIG } from '@/test-utils/setup.js';

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

  const app = await createServer({
    config: MINIMAL_TEST_CONFIG,
  });

  await app.ready();

  const spec = app.swagger();
  const json = JSON.stringify(spec, null, 2);

  if (outputPath) {
    writeFileSync(outputPath, json, 'utf-8');
    console.info(`OpenAPI spec written to ${outputPath}`);
  } else {
    process.stdout.write(json);
  }

  await app.close();
}

main().catch((err) => {
  console.error('Failed to export OpenAPI spec:', err);
  process.exit(1);
});
