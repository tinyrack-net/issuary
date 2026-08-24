// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Config fixtures intentionally use literal ${} syntax
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { loadConfig, resolveConfig } from './load-config.ts';

const VALID_SESSION_SECRET =
  '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b';

async function writeConfigFile(
  dir: string,
  name: string,
  contents: string,
): Promise<string> {
  const filePath = path.join(dir, name);
  await fs.promises.writeFile(filePath, contents, 'utf-8');
  return filePath;
}

describe('load-config', () => {
  test('loads config from the given configPath', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'issuary-load-config-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'config.yaml',
      [
        'security:',
        `  session_secret: ${VALID_SESSION_SECRET}`,
        '  hash_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    const config = loadConfig(configFile);

    expect(config.security.session_secret).toBe(VALID_SESSION_SECRET);
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('applies proxy frontend defaults during standalone resolution', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'issuary-load-config-proxy-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'proxy.yaml',
      [
        'frontend:',
        '  enabled: true',
        '  mode: proxy',
        'security:',
        `  session_secret: ${VALID_SESSION_SECRET}`,
        '  hash_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    const config = await resolveConfig(loadConfig(configFile));

    expect(config.frontend).toBeDefined();
    expect(typeof config.frontend).toBe('function');
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('preserves disabled frontend without requiring path', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'issuary-load-config-disabled-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'disabled.yaml',
      [
        'frontend:',
        '  enabled: false',
        'security:',
        `  session_secret: ${VALID_SESSION_SECRET}`,
        '  hash_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    const config = await resolveConfig(loadConfig(configFile));

    expect(config.frontend).toBeUndefined();
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('throws when security secrets are missing and config file does not exist', () => {
    const missingPath = path.join(
      os.tmpdir(),
      `issuary-missing-${Date.now()}.yaml`,
    );

    expect(() => loadConfig(missingPath)).toThrow();
  });

  test('loads the packaged config.example.yaml', () => {
    const exampleConfigPath = fileURLToPath(
      new URL('../../config.example.yaml', import.meta.url),
    );
    const exampleConfigContents = fs
      .readFileSync(exampleConfigPath, 'utf-8')
      .replace(
        '${ISSUARY_SESSION_SECRET}',
        '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
      )
      .replace(
        '${ISSUARY_HASH_SECRET}',
        'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      );
    const tempConfigPath = path.join(
      os.tmpdir(),
      `issuary-example-${Date.now()}.yaml`,
    );

    fs.writeFileSync(tempConfigPath, exampleConfigContents, 'utf-8');
    const config = (() => {
      try {
        return loadConfig(tempConfigPath);
      } finally {
        fs.rmSync(tempConfigPath, { force: true });
      }
    })();

    expect(config.registration.enabled).toBe(false);
    expect(config.identity_providers).toEqual([]);
    expect(config.terms[0]?.content['en']?.type).toBe('text');
  });

  test('loads the packaged config.dev.yaml', () => {
    const devConfigPath = fileURLToPath(
      new URL('../../config.dev.yaml', import.meta.url),
    );

    const config = loadConfig(devConfigPath);

    expect(config.clients[0]?.client_secret?.length).toBeGreaterThanOrEqual(16);
  });

  test('loads database scheduler background options from env-style strings', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'issuary-load-config-scheduler-retry-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'scheduler-retry.yaml',
      [
        'scheduler:',
        '  enabled: true',
        '  mode: database',
        '  background_retry_delay_ms: "2500"',
        '  background_max_attempts: "5"',
        '  background_retention_ms: "3600000"',
        'security:',
        `  session_secret: ${VALID_SESSION_SECRET}`,
        '  hash_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    try {
      const config = loadConfig(configFile);
      await expect(resolveConfig(config)).resolves.toMatchObject({
        scheduler: expect.any(Function),
      });

      expect(config.scheduler.background_retry_delay_ms).toBe(2500);
      expect(config.scheduler.background_max_attempts).toBe(5);
      expect(config.scheduler.background_retention_ms).toBe(3600000);
    } finally {
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  });

  test('loads database scheduler retention from env vars', () => {
    const missingPath = path.join(
      os.tmpdir(),
      `issuary-retention-env-${Date.now()}.yaml`,
    );
    const originalSession = process.env['ISSUARY_SESSION_SECRET'];
    const originalHash = process.env['ISSUARY_HASH_SECRET'];
    const originalRetention =
      process.env['ISSUARY_SCHEDULER_BACKGROUND_RETENTION_MS'];
    try {
      process.env['ISSUARY_SESSION_SECRET'] = VALID_SESSION_SECRET;
      process.env['ISSUARY_HASH_SECRET'] =
        'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY';
      process.env['ISSUARY_SCHEDULER_BACKGROUND_RETENTION_MS'] = '60000';

      const config = loadConfig(missingPath);

      expect(config.scheduler.background_retention_ms).toBe(60000);
    } finally {
      if (originalSession === undefined)
        delete process.env['ISSUARY_SESSION_SECRET'];
      else process.env['ISSUARY_SESSION_SECRET'] = originalSession;
      if (originalHash === undefined) delete process.env['ISSUARY_HASH_SECRET'];
      else process.env['ISSUARY_HASH_SECRET'] = originalHash;
      if (originalRetention === undefined)
        delete process.env['ISSUARY_SCHEDULER_BACKGROUND_RETENTION_MS'];
      else
        process.env['ISSUARY_SCHEDULER_BACKGROUND_RETENTION_MS'] =
          originalRetention;
    }
  });

  test('uses database scheduler background defaults matching server scheduler', () => {
    const originalSession = process.env['ISSUARY_SESSION_SECRET'];
    const originalHash = process.env['ISSUARY_HASH_SECRET'];
    try {
      process.env['ISSUARY_SESSION_SECRET'] = VALID_SESSION_SECRET;
      process.env['ISSUARY_HASH_SECRET'] =
        'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY';

      const config = loadConfig(
        path.join(os.tmpdir(), `issuary-defaults-${Date.now()}.yaml`),
      );

      expect(config.scheduler.background_retry_delay_ms).toBe(1000);
      expect(config.scheduler.background_max_attempts).toBe(3);
      expect(config.scheduler.background_retention_ms).toBe(
        7 * 24 * 60 * 60 * 1000,
      );
    } finally {
      if (originalSession === undefined)
        delete process.env['ISSUARY_SESSION_SECRET'];
      else process.env['ISSUARY_SESSION_SECRET'] = originalSession;
      if (originalHash === undefined) delete process.env['ISSUARY_HASH_SECRET'];
      else process.env['ISSUARY_HASH_SECRET'] = originalHash;
    }
  });

  test('throws when session_secret is missing from YAML', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'issuary-load-config-missing-security-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'missing-security.yaml',
      [
        'security:',
        '  hash_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    try {
      expect(() => loadConfig(configFile)).toThrow();
    } finally {
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  });

  test('rejects removed app.cookie_secret config', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'issuary-load-config-legacy-app-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'legacy-app.yaml',
      [
        'app:',
        '  cookie_secret: legacy-app-secret-1234567890',
        'security:',
        `  session_secret: ${VALID_SESSION_SECRET}`,
        '  hash_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    expect(() => loadConfig(configFile)).toThrow('Unrecognized key');
    expect(() => loadConfig(configFile)).toThrow('"app"');

    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('rejects removed security.hash_master_secret_version config', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'issuary-load-config-legacy-security-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'legacy-security.yaml',
      [
        'security:',
        `  session_secret: ${VALID_SESSION_SECRET}`,
        '  hash_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
        '  hash_master_secret_version: 1',
      ].join('\n'),
    );

    expect(() => loadConfig(configFile)).toThrow('hash_master_secret_version');

    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('loads config from env vars alone (no config file)', () => {
    const missingPath = path.join(
      os.tmpdir(),
      `issuary-envonly-${Date.now()}.yaml`,
    );

    const originalSession = process.env['ISSUARY_SESSION_SECRET'];
    const originalHash = process.env['ISSUARY_HASH_SECRET'];
    try {
      process.env['ISSUARY_SESSION_SECRET'] = VALID_SESSION_SECRET;
      process.env['ISSUARY_HASH_SECRET'] =
        'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY';

      const config = loadConfig(missingPath);

      expect(config.security.session_secret).toBe(VALID_SESSION_SECRET);
      expect(config.security.hash_secret).toBe(
        'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      );
      expect(config.server.listen_port).toBe(8080);
      expect(config.admin).toEqual({
        enabled: false,
      });
      expect(config.database.type).toBe('sqlite');
    } finally {
      if (originalSession === undefined)
        delete process.env['ISSUARY_SESSION_SECRET'];
      else process.env['ISSUARY_SESSION_SECRET'] = originalSession;
      if (originalHash === undefined) delete process.env['ISSUARY_HASH_SECRET'];
      else process.env['ISSUARY_HASH_SECRET'] = originalHash;
    }
  });

  test('env var overrides default fallback', () => {
    const missingPath = path.join(
      os.tmpdir(),
      `issuary-envoverride-${Date.now()}.yaml`,
    );

    const originalPort = process.env['ISSUARY_LISTEN_PORT'];
    const originalSession = process.env['ISSUARY_SESSION_SECRET'];
    const originalHash = process.env['ISSUARY_HASH_SECRET'];
    try {
      process.env['ISSUARY_LISTEN_PORT'] = '3000';
      process.env['ISSUARY_SESSION_SECRET'] = VALID_SESSION_SECRET;
      process.env['ISSUARY_HASH_SECRET'] =
        'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY';

      const config = loadConfig(missingPath);

      expect(config.server.listen_port).toBe(3000);
    } finally {
      if (originalPort === undefined) delete process.env['ISSUARY_LISTEN_PORT'];
      else process.env['ISSUARY_LISTEN_PORT'] = originalPort;
      if (originalSession === undefined)
        delete process.env['ISSUARY_SESSION_SECRET'];
      else process.env['ISSUARY_SESSION_SECRET'] = originalSession;
      if (originalHash === undefined) delete process.env['ISSUARY_HASH_SECRET'];
      else process.env['ISSUARY_HASH_SECRET'] = originalHash;
    }
  });

  test('loads admin config from YAML', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'issuary-admin-config-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'admin.yaml',
      [
        'admin:',
        '  enabled: true',
        'security:',
        `  session_secret: ${VALID_SESSION_SECRET}`,
        '  hash_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    try {
      const config = loadConfig(configFile);

      expect(config.admin).toEqual({
        enabled: true,
      });
    } finally {
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  });

  test('partial YAML with env var overrides', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'issuary-partial-yaml-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'partial.yaml',
      [
        'security:',
        `  session_secret: ${VALID_SESSION_SECRET}`,
        '  hash_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    const originalPort = process.env['ISSUARY_LISTEN_PORT'];
    try {
      process.env['ISSUARY_LISTEN_PORT'] = '9090';

      const config = loadConfig(configFile);

      expect(config.security.session_secret).toBe(VALID_SESSION_SECRET);
      expect(config.server.listen_port).toBe(9090);
    } finally {
      if (originalPort === undefined) delete process.env['ISSUARY_LISTEN_PORT'];
      else process.env['ISSUARY_LISTEN_PORT'] = originalPort;
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  });

  test('throws when no env var and no config file', () => {
    const missingPath = path.join(
      os.tmpdir(),
      `issuary-noenv-${Date.now()}.yaml`,
    );

    const originalSession = process.env['ISSUARY_SESSION_SECRET'];
    const originalHash = process.env['ISSUARY_HASH_SECRET'];
    try {
      delete process.env['ISSUARY_SESSION_SECRET'];
      delete process.env['ISSUARY_HASH_SECRET'];

      expect(() => loadConfig(missingPath)).toThrow();
    } finally {
      if (originalSession === undefined)
        delete process.env['ISSUARY_SESSION_SECRET'];
      else process.env['ISSUARY_SESSION_SECRET'] = originalSession;
      if (originalHash === undefined) delete process.env['ISSUARY_HASH_SECRET'];
      else process.env['ISSUARY_HASH_SECRET'] = originalHash;
    }
  });
});
