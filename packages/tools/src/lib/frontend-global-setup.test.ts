import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';

const execFileAsync = promisify(execFile);
const frontendRoot = fileURLToPath(
  new URL('../../../frontend/', import.meta.url),
);

test('non-Screen Lab setup never loads a development server or its native plugins', async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      `
        import { registerHooks } from 'node:module';
        registerHooks({
          resolve(specifier, context, next) {
            if (['vite', '@tailwindcss/vite', '@vitejs/plugin-react'].includes(specifier))
              throw new Error('Unexpected development server import: ' + specifier);
            return next(specifier, context);
          },
        });
        const { default: setup } = await import('./e2e/setup/global-setup.ts');
        const teardown = await setup({ projects: [{ name: 'minimal:chromium' }] });
        await teardown();
        console.log('setup disposed');
      `,
    ],
    { cwd: frontendRoot, timeout: 10_000 },
  );
  expect(stdout.trim()).toBe('setup disposed');
});

test('Screen Lab retains its route host and closes it during teardown', async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      `
        import assert from 'node:assert/strict';
        import { registerHooks } from 'node:module';
        globalThis.hostEvents = [];
        const viteModule = 'export async function createServer() { return {' +
          'listen: async () => globalThis.hostEvents.push("listen"),' +
          'close: async () => globalThis.hostEvents.push("close"),' +
          'httpServer: { address: () => ({ port: 12345 }) } }; }';
        registerHooks({
          resolve(specifier, context, next) {
            const code = specifier === 'vite' ? viteModule :
              ['@tailwindcss/vite', '@vitejs/plugin-react'].includes(specifier) ?
              'export default () => ({ name: "test-plugin" });' : undefined;
            if (code) return { url: 'data:text/javascript,' + encodeURIComponent(code), shortCircuit: true };
            return next(specifier, context);
          },
        });
        const { default: setup } = await import('./e2e/setup/global-setup.ts');
        const teardown = await setup({ projects: [{ name: 'screen-lab:chromium' }] });
        assert.equal(process.env.SCREEN_LAB_ROUTE_HOST_ORIGIN, 'http://127.0.0.1:12345');
        assert.deepEqual(globalThis.hostEvents, ['listen']);
        await teardown();
        assert.equal(process.env.SCREEN_LAB_ROUTE_HOST_ORIGIN, undefined);
        assert.deepEqual(globalThis.hostEvents, ['listen', 'close']);
        console.log('route host disposed');
      `,
    ],
    { cwd: frontendRoot, timeout: 10_000 },
  );
  expect(stdout.trim()).toBe('route host disposed');
});
