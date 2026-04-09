import { defineConfig } from '@playwright/test';

const baseURL = process.env['E2E_BASE_URL'] || 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
  },
  /* When running locally, start the Angular dev server automatically.
     In Docker the app container is already running, so the webServer
     block is skipped via the E2E_BASE_URL env var. */
  ...(!process.env['E2E_BASE_URL'] ? {
    webServer: {
      command: 'npx ng serve --port 4200',
      url: 'http://localhost:4200',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  } : {}),
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
