import { test, expect } from '@playwright/test';

/**
 * HarborPoint E2E Tests — minimal browser-level coverage
 *
 * Covers:
 * 1. Login flow for each QA role
 * 2. Guarded route enforcement
 * 3. Admin primary task flow (navigate core pages)
 */

const BASE = process.env['E2E_BASE_URL'] || 'http://localhost:4200';
const CREDENTIALS = { password: 'harborpoint2024' };

// Helper: login as a role and return the page
async function login(page: any, username: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', CREDENTIALS.password);
  await page.click('button[type="submit"]');
}

// ─────────────────────────────────────────────────────
// 1. Login flow — all four QA roles
// ─────────────────────────────────────────────────────

test.describe('Login flow', () => {

  test('admin login lands on /dashboard', async ({ page }) => {
    await login(page, 'admin');
    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('resident login lands on /my-profile', async ({ page }) => {
    await login(page, 'resident');
    await page.waitForURL('**/my-profile');
    await expect(page).toHaveURL(/\/my-profile/);
  });

  test('compliance login lands on /documents', async ({ page }) => {
    await login(page, 'compliance');
    await page.waitForURL('**/documents');
    await expect(page).toHaveURL(/\/documents/);
  });

  test('analyst login lands on /analytics', async ({ page }) => {
    await login(page, 'analyst');
    await page.waitForURL('**/analytics');
    await expect(page).toHaveURL(/\/analytics/);
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    await expect(page.locator('.login-error')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────
// 2. Route guard enforcement
// ─────────────────────────────────────────────────────

test.describe('Route guards', () => {

  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login|\/unauthorized/);
  });

  test('resident cannot access admin-only /settings', async ({ page }) => {
    await login(page, 'resident');
    await page.waitForURL('**/my-profile');
    await page.goto(`${BASE}/settings`);
    await page.waitForURL('**/unauthorized');
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  test('admin can access /settings', async ({ page }) => {
    await login(page, 'admin');
    await page.waitForURL('**/dashboard');
    await page.goto(`${BASE}/settings`);
    await expect(page).toHaveURL(/\/settings/);
  });
});

// ─────────────────────────────────────────────────────
// 3. Admin primary task flow — navigate core pages
// ─────────────────────────────────────────────────────

test.describe('Admin core navigation', () => {

  test('admin can navigate to all admin-accessible pages', async ({ page }) => {
    await login(page, 'admin');
    await page.waitForURL('**/dashboard');

    // Navigate to Property
    await page.goto(`${BASE}/property`);
    await expect(page).toHaveURL(/\/property/);

    // Navigate to Residents
    await page.goto(`${BASE}/residents`);
    await expect(page).toHaveURL(/\/residents/);

    // Navigate to Messages
    await page.goto(`${BASE}/messages`);
    await expect(page).toHaveURL(/\/messages/);

    // Navigate to Search
    await page.goto(`${BASE}/search`);
    await expect(page).toHaveURL(/\/search/);

    // Navigate to Audit Log
    await page.goto(`${BASE}/audit`);
    await expect(page).toHaveURL(/\/audit/);

    // Navigate to Settings
    await page.goto(`${BASE}/settings`);
    await expect(page).toHaveURL(/\/settings/);
  });
});
