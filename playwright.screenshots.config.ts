import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/screenshots',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  timeout: 60000,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report/ui-screenshots' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off',
    video: 'off',
  },
  outputDir: 'test-results/ui-screenshots',
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 950 } } },
    { name: 'Mobile Chrome', use: { ...devices['Galaxy A55'] } },
  ],
});
