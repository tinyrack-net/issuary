import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createTestConfigFile, getFreePort } from './helpers/config-factory.js';
import { startCli } from './helpers/spawn-cli.js';
import { waitForReady } from './helpers/wait-for-ready.js';

async function createCustomConfigFile(
  config: Record<string, unknown>,
): Promise<{ configPath: string; cleanup: () => Promise<void> }> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tinyauth-e2e-'));
  const configPath = path.join(tmpDir, 'config.yaml');
  await fs.writeFile(configPath, YAML.stringify(config), 'utf-8');
  return {
    configPath,
    cleanup: async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

describe('config combinations', { timeout: 30_000 }, () => {
  let cliProcess: ReturnType<typeof startCli> | undefined;
  let configCleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cliProcess && !cliProcess.killed) {
      cliProcess.kill('SIGKILL');
      await cliProcess;
    }
    await configCleanup?.();
  });

  it('starts with registration enabled', async () => {
    const { configPath, port, cleanup } = await createTestConfigFile({
      registration: { enabled: true },
    });
    configCleanup = cleanup;

    cliProcess = startCli({
      args: ['serve', '-c', configPath],
      timeout: 25_000,
    });

    await waitForReady(port);

    const res = await fetch(`http://localhost:${port}/api/config`);
    const body = await res.json();

    expect(body.registration.public_registration).toBe(true);
  });

  it('starts with openapi disabled', async () => {
    const { configPath, port, cleanup } = await createTestConfigFile({
      openapi: { enabled: false },
    });
    configCleanup = cleanup;

    cliProcess = startCli({
      args: ['serve', '-c', configPath],
      timeout: 25_000,
    });

    await waitForReady(port);

    const res = await fetch(`http://localhost:${port}/api/docs`);
    expect(res.status).toBe(404);
  });

  it('starts with scheduler enabled', async () => {
    const { configPath, port, cleanup } = await createTestConfigFile({
      scheduler: { enabled: true, cron: '0 3 * * *' },
    });
    configCleanup = cleanup;

    cliProcess = startCli({
      args: ['serve', '-c', configPath],
      timeout: 25_000,
    });

    const res = await waitForReady(port);
    expect(res.ok).toBe(true);
  });

  it('starts with password disabled and passkey enabled', async () => {
    const { configPath, port, cleanup } = await createTestConfigFile({
      auth: { password: { enabled: false }, passkey: { enabled: true } },
    });
    configCleanup = cleanup;

    cliProcess = startCli({
      args: ['serve', '-c', configPath],
      timeout: 25_000,
    });

    await waitForReady(port);

    const res = await fetch(`http://localhost:${port}/api/config`);
    const body = await res.json();

    expect(body.auth.password.enabled).toBe(false);
    expect(body.auth.passkey.enabled).toBe(true);
  });

  it('starts with account deletion enabled', async () => {
    const { configPath, port, cleanup } = await createTestConfigFile({
      account_deletion: { enabled: true },
    });
    configCleanup = cleanup;

    cliProcess = startCli({
      args: ['serve', '-c', configPath],
      timeout: 25_000,
    });

    await waitForReady(port);

    const res = await fetch(`http://localhost:${port}/api/config`);
    const body = await res.json();

    expect(body.account_deletion.enabled).toBe(true);
  });
});

describe('config loading priority', { timeout: 30_000 }, () => {
  let cliProcess: ReturnType<typeof startCli> | undefined;
  let configCleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cliProcess && !cliProcess.killed) {
      cliProcess.kill('SIGKILL');
      await cliProcess;
    }
    await configCleanup?.();
  });

  function baseConfig(port: number, extra?: Record<string, unknown>) {
    return {
      database: { type: 'sqlite', test: true },
      security: {
        session_secret:
          '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
        hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
        pbkdf2_iterations: 1000,
      },
      logging: { level: 'error', format: 'json' },
      email: { transport: 'test' },
      frontend: { enabled: false },
      scheduler: { enabled: false },
      server: { listen_port: port },
      ...extra,
    };
  }

  it('uses default public_origin when YAML omits it', async () => {
    const port = await getFreePort();
    const { configPath, cleanup } = await createCustomConfigFile(
      baseConfig(port),
    );
    configCleanup = cleanup;

    cliProcess = startCli({
      args: ['serve', '-c', configPath],
      timeout: 25_000,
    });

    const res = await waitForReady(port);
    const body = await res.json();

    expect(body.issuer).toBe('http://localhost:8080');
  });

  it('YAML public_origin overrides default', async () => {
    const port = await getFreePort();
    const { configPath, cleanup } = await createCustomConfigFile(
      baseConfig(port, {
        server: { listen_port: port, public_origin: 'http://custom-host:9999' },
      }),
    );
    configCleanup = cleanup;

    cliProcess = startCli({
      args: ['serve', '-c', configPath],
      timeout: 25_000,
    });

    const res = await waitForReady(port);
    const body = await res.json();

    expect(body.issuer).toBe('http://custom-host:9999');
  });

  it('env var overrides default when YAML omits field', async () => {
    const port = await getFreePort();
    const { configPath, cleanup } = await createCustomConfigFile(
      baseConfig(port),
    );
    configCleanup = cleanup;

    cliProcess = startCli({
      args: ['serve', '-c', configPath],
      timeout: 25_000,
      env: { TINYAUTH_PUBLIC_ORIGIN: 'http://env-host:5678' },
    });

    const res = await waitForReady(port);
    const body = await res.json();

    expect(body.issuer).toBe('http://env-host:5678');
  });
});
