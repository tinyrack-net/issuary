// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Config fixtures intentionally use literal ${} syntax
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { loadConfig, loadResolvedConfig } from './load-config.js';

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
      path.join(os.tmpdir(), 'tinyauth-load-config-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'config.yaml',
      [
        'security:',
        '  session_secret: explicit-secret-1234567890',
        '  hash_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    const config = loadConfig(configFile);

    expect(config.security.session_secret).toBe('explicit-secret-1234567890');
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('applies proxy frontend defaults during standalone resolution', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-load-config-proxy-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'proxy.yaml',
      [
        'frontend:',
        '  enabled: true',
        '  mode: proxy',
        'security:',
        '  session_secret: proxy-secret-1234567890',
        '  hash_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    const config = await loadResolvedConfig({ configPath: configFile });

    expect(config.frontend.path).toBe('http://localhost:8081');
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('preserves disabled frontend without requiring path', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-load-config-disabled-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'disabled.yaml',
      [
        'frontend:',
        '  enabled: false',
        'security:',
        '  session_secret: disabled-secret-1234567890',
        '  hash_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    const config = await loadResolvedConfig({ configPath: configFile });

    expect(config.frontend.enabled).toBe(false);
    expect(config.frontend.path).toBe('');
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('generates ephemeral secrets and keeps signup disabled when config file is missing', () => {
    const missingPath = path.join(
      os.tmpdir(),
      `tinyauth-missing-${Date.now()}.yaml`,
    );

    const first = loadConfig(missingPath);
    const second = loadConfig(missingPath);

    expect(first.registration.enabled).toBe(false);
    expect(first.registration.allowed_email_patterns).toEqual([]);
    expect(first.security.session_secret).not.toBe(
      second.security.session_secret,
    );
    expect(first.security.hash_secret).not.toBe(second.security.hash_secret);
    expect(first.security.session_secret.length).toBeGreaterThanOrEqual(16);
    expect(first.security.hash_secret).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test('loads the packaged config.example.yaml', () => {
    const exampleConfigPath = fileURLToPath(
      new URL('../../config.example.yaml', import.meta.url),
    );
    const exampleConfigContents = fs
      .readFileSync(exampleConfigPath, 'utf-8')
      .replace(
        '${SESSION_SECRET}',
        '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
      )
      .replace('${HASH_SECRET}', 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY');
    const tempConfigPath = path.join(
      os.tmpdir(),
      `tinyauth-example-${Date.now()}.yaml`,
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

  test('fails when security.session_secret is missing', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-load-config-missing-security-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'missing-security.yaml',
      [
        'security:',
        '  hash_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    await expect(
      loadResolvedConfig({ configPath: configFile }),
    ).rejects.toThrow('security');

    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('rejects removed app.cookie_secret config', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-load-config-legacy-app-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'legacy-app.yaml',
      [
        'app:',
        '  cookie_secret: legacy-app-secret-1234567890',
        'security:',
        '  session_secret: explicit-secret-1234567890',
        '  hash_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    const errorMessage = await loadResolvedConfig({
      configPath: configFile,
    }).then(
      () => '',
      (error: unknown) => String(error),
    );

    expect(errorMessage).toContain('"app"');
    expect(errorMessage).toContain('Unrecognized key');

    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('rejects removed security.hash_master_secret_version config', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-load-config-legacy-security-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'legacy-security.yaml',
      [
        'security:',
        '  session_secret: legacy-security-secret-1234567890',
        '  hash_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
        '  hash_master_secret_version: 1',
      ].join('\n'),
    );

    await expect(
      loadResolvedConfig({ configPath: configFile }),
    ).rejects.toThrow('hash_master_secret_version');

    await fs.promises.rm(dir, { recursive: true, force: true });
  });
});
