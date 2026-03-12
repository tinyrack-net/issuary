import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const cleanupState = vi.hoisted(() => ({
  cleanupMock: vi.fn(async () => {}),
  createLoggerMock: vi.fn(),
  initializeServicesMock: vi.fn(),
  loadConfigMock: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  resolveConfigMock: vi.fn(),
  runAllMock: vi.fn(),
}));

vi.mock('@tinyauth/backend/services', () => ({
  initializeServices: cleanupState.initializeServicesMock,
}));

vi.mock('#standalone/lib/load-config.js', () => ({
  loadConfig: cleanupState.loadConfigMock,
  resolveConfig: cleanupState.resolveConfigMock,
}));

vi.mock('#standalone/lib/logger.js', () => ({
  createLogger: cleanupState.createLoggerMock,
}));

describe('cleanupCommand', () => {
  beforeEach(() => {
    cleanupState.cleanupMock.mockReset();
    cleanupState.createLoggerMock.mockReset();
    cleanupState.initializeServicesMock.mockReset();
    cleanupState.loadConfigMock.mockReset();
    cleanupState.logger.debug.mockReset();
    cleanupState.logger.error.mockReset();
    cleanupState.logger.info.mockReset();
    cleanupState.logger.warn.mockReset();
    cleanupState.resolveConfigMock.mockReset();
    cleanupState.runAllMock.mockReset();

    cleanupState.createLoggerMock.mockReturnValue(cleanupState.logger);
    cleanupState.loadConfigMock.mockReturnValue({
      logging: { format: 'json', level: 'silent' },
    });
    cleanupState.resolveConfigMock.mockResolvedValue({
      logging: { format: 'json', level: 'silent' },
    });
    cleanupState.initializeServicesMock.mockResolvedValue({
      cleanup: cleanupState.cleanupMock,
      services: {
        cleanupService: {
          runAll: cleanupState.runAllMock,
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('logs progress and exits 0 when cleanup succeeds', async () => {
    cleanupState.runAllMock.mockResolvedValue({
      tasks: [
        {
          description: 'Expired tokens',
          durationMs: 14,
          result: {
            deletedCount: 2,
            message: 'Cleaned expired entries',
            skipped: false,
          },
        },
      ],
      totalDeleted: 2,
      totalDurationMs: 14,
      totalFailed: 0,
      totalSkipped: 0,
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${String(code)}`);
    });

    vi.resetModules();
    const { cleanupCommand } = await import('./cleanup.js');

    await expect(
      cleanupCommand.parseAsync(
        ['--config-path', '/tmp/tinyauth.yaml', '--verbose'],
        { from: 'user' },
      ),
    ).rejects.toThrow('process.exit:0');

    expect(cleanupState.loadConfigMock).toHaveBeenCalledWith(
      '/tmp/tinyauth.yaml',
    );
    expect(cleanupState.resolveConfigMock).toHaveBeenCalled();
    expect(cleanupState.initializeServicesMock).toHaveBeenCalled();
    expect(cleanupState.runAllMock).toHaveBeenCalledWith({
      dryRun: false,
      verbose: true,
    });
    expect(cleanupState.logger.info).toHaveBeenCalledWith('TinyAuth Cleanup');
    expect(cleanupState.logger.info).toHaveBeenCalledWith(
      '[1/1] Expired tokens: Deleted 2 (Cleaned expired entries)',
    );
    expect(cleanupState.cleanupMock).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test('exits 1 and logs task errors when any cleanup task fails', async () => {
    cleanupState.runAllMock.mockResolvedValue({
      tasks: [
        {
          description: 'JWT key rotation',
          durationMs: 3,
          error: new Error('database unavailable'),
          result: {
            deletedCount: 0,
            skipped: false,
          },
        },
      ],
      totalDeleted: 0,
      totalDurationMs: 3,
      totalFailed: 1,
      totalSkipped: 0,
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${String(code)}`);
    });

    vi.resetModules();
    const { cleanupCommand } = await import('./cleanup.js');

    await expect(
      cleanupCommand.parseAsync(['--config-path', '/tmp/tinyauth.yaml'], {
        from: 'user',
      }),
    ).rejects.toThrow('process.exit:1');

    expect(cleanupState.logger.error).toHaveBeenCalledWith(
      '[1/1] JWT key rotation: database unavailable',
    );
    expect(cleanupState.logger.error).toHaveBeenCalledWith(
      '         1 tasks failed',
    );
    expect(cleanupState.cleanupMock).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
