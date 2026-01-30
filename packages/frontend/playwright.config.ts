import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm dev',
      cwd: '../backend',
      url: 'http://localhost:8080/api/v1/config',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      stdout: 'pipe',
    },
    {
      command: 'pnpm dev',
      cwd: '.',
      url: 'http://localhost:8081',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      stdout: 'pipe',
    },
  ],
});
