import type { HttpPerfResult } from './metrics.js';

export type PerfReport = {
  generatedAt: string;
  node: string;
  platform: string;
  scenarios: HttpPerfResult[];
};

export function createPerfReport(
  results: readonly HttpPerfResult[],
): PerfReport {
  return {
    generatedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    scenarios: results.map((result) => ({
      ...result,
      statusCounts: { ...result.statusCounts },
    })),
  };
}

export async function writePerfReportIfEnabled(input: {
  results: readonly HttpPerfResult[];
  env: NodeJS.ProcessEnv;
  writeFile: (path: string, content: string) => Promise<void>;
}): Promise<string | undefined> {
  const path = input.env['TINYAUTH_PERF_REPORT_PATH'];

  if (!path) {
    return undefined;
  }

  const report = createPerfReport(input.results);
  await input.writeFile(path, `${JSON.stringify(report, null, 2)}\n`);

  return path;
}
