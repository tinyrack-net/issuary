import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const exportState = vi.hoisted(() => ({
  cleanupMock: vi.fn(async () => {}),
  createAppMock: vi.fn(),
  generateSpecsMock: vi.fn(),
  logger: {
    info: vi.fn(),
  },
  resolveConfigMock: vi.fn(),
}));

vi.mock('@tinyauth/backend', () => ({
  createApp: exportState.createAppMock,
}));

vi.mock('hono-openapi', () => ({
  generateSpecs: exportState.generateSpecsMock,
}));

vi.mock('#standalone/lib/load-config.js', () => ({
  resolveConfig: exportState.resolveConfigMock,
}));

describe('exportOpenapiCommand', () => {
  beforeEach(() => {
    exportState.cleanupMock.mockReset();
    exportState.createAppMock.mockReset();
    exportState.generateSpecsMock.mockReset();
    exportState.logger.info.mockReset();
    exportState.resolveConfigMock.mockReset();

    exportState.resolveConfigMock.mockResolvedValue({
      logging: { format: 'json', level: 'silent' },
    });
    exportState.createAppMock.mockResolvedValue({
      app: { openapi: true },
      cleanup: exportState.cleanupMock,
      logger: exportState.logger,
    });
    exportState.generateSpecsMock.mockResolvedValue({
      openapi: '3.1.0',
      info: { title: 'TinyAuth API' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('writes the generated spec to stdout by default', async () => {
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    vi.resetModules();
    const { exportOpenapiCommand } = await import('./export-openapi.js');

    await exportOpenapiCommand.parseAsync([], { from: 'user' });

    expect(exportState.resolveConfigMock).toHaveBeenCalled();
    expect(exportState.createAppMock).toHaveBeenCalled();
    expect(exportState.generateSpecsMock).toHaveBeenCalledWith(
      { openapi: true },
      expect.objectContaining({
        documentation: expect.objectContaining({
          info: expect.objectContaining({
            title: 'TinyAuth API',
          }),
        }),
      }),
    );
    expect(writeSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          openapi: '3.1.0',
          info: { title: 'TinyAuth API' },
        },
        null,
        2,
      ),
    );
    expect(exportState.cleanupMock).toHaveBeenCalledTimes(1);
  });

  test('writes the generated spec to a file when output path is provided', async () => {
    const tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-openapi-'),
    );
    const outputPath = path.join(tempDir, 'openapi.json');

    vi.resetModules();
    const { exportOpenapiCommand } = await import('./export-openapi.js');

    await exportOpenapiCommand.parseAsync([outputPath], { from: 'user' });

    const written = await fs.promises.readFile(outputPath, 'utf-8');
    expect(JSON.parse(written)).toEqual({
      openapi: '3.1.0',
      info: { title: 'TinyAuth API' },
    });
    expect(exportState.logger.info).toHaveBeenCalledWith(
      { outputPath },
      'OpenAPI spec written',
    );
    expect(exportState.cleanupMock).toHaveBeenCalledTimes(1);

    await fs.promises.rm(tempDir, { force: true, recursive: true });
  });
});
