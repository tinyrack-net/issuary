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

vi.mock('@tinyrack/issuary-server/services', () => ({
  initializeServices: cleanupState.initializeServicesMock,
}));

vi.mock('../../lib/load-config.ts', () => ({
  loadConfig: cleanupState.loadConfigMock,
  resolveConfig: cleanupState.resolveConfigMock,
}));

vi.mock('../../lib/logger.ts', () => ({
  createLogger: cleanupState.createLoggerMock,
}));

describe('CleanupCommand', () => {
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
    process.exitCode = undefined;
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

    vi.resetModules();
    const { runCleanupCommand } = await import('./cleanup.ts');

    await runCleanupCommand({
      configPath: '/tmp/issuary.yaml',
      dryRun: false,
      verbose: true,
    });

    expect(cleanupState.loadConfigMock).toHaveBeenCalledWith(
      '/tmp/issuary.yaml',
    );
    expect(cleanupState.resolveConfigMock).toHaveBeenCalled();
    expect(cleanupState.initializeServicesMock).toHaveBeenCalled();
    expect(cleanupState.runAllMock).toHaveBeenCalledWith({
      dryRun: false,
      verbose: true,
    });
    expect(cleanupState.logger.info).toHaveBeenCalledWith('Issuary Cleanup');
    expect(cleanupState.logger.info).toHaveBeenCalledWith(
      '[1/1] Expired tokens: Deleted 2 (Cleaned expired entries)',
    );
    expect(cleanupState.cleanupMock).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBeUndefined();
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

    vi.resetModules();
    const { runCleanupCommand } = await import('./cleanup.ts');

    await runCleanupCommand({
      configPath: '/tmp/issuary.yaml',
      dryRun: false,
      verbose: false,
    });

    expect(cleanupState.logger.error).toHaveBeenCalledWith(
      '[1/1] JWT key rotation: database unavailable',
    );
    expect(cleanupState.logger.error).toHaveBeenCalledWith(
      '         1 tasks failed',
    );
    expect(cleanupState.cleanupMock).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBe(1);
  });
});
