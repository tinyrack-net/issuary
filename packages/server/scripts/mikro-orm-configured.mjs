import { spawnSync } from 'node:child_process';

const [, , configPath, ...rawArgs] = process.argv;

if (!configPath) {
  console.error('Usage: node ./scripts/mikro-orm-configured.mjs <config-path> [...mikro-orm-args]');
  process.exit(1);
}

const args = rawArgs.filter((arg) => arg !== '--');
const result = spawnSync('mikro-orm', [...args, '--config', configPath], {
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
