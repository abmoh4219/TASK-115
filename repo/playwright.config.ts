import { defineConfig } from '@playwright/test';

const baseURL = process.env['E2E_BASE_URL'] || 'http://localhost:4200';

// When the app is served over plain HTTP (Docker bridge network), crypto.subtle
// requires the origin to be marked as secure. Use a single flag with a
// comma-separated list that covers both the explicit-port and default-port
// forms, because Chrome normalises port 80 differently across versions.
const dockerArgs = (() => {
  const base = process.env['E2E_BASE_URL'];
  if (!base) return [];
  const noPort = base.replace(/:80$/, '');
  const origins = noPort !== base ? `${base},${noPort}` : base;
  return [`--unsafely-treat-insecure-origin-as-secure=${origins}`];
})();

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    launchOptions: { args: dockerArgs },
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
