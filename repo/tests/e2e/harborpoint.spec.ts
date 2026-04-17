import { test, expect } from '@playwright/test';

const BASE = process.env['E2E_BASE_URL'] || 'http://localhost:4200';

async function login(page: any, username: string, password = 'harborpoint2024') {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[name="username"]', { state: 'visible' });
  await page.locator('input[name="username"]').click();
  await page.locator('input[name="username"]').pressSequentially(username, { delay: 30 });
  await page.locator('input[name="password"]').click();
  await page.locator('input[name="password"]').pressSequentially(password, { delay: 30 });
  await page.waitForFunction(
    () => !(document.querySelector('button[type="submit"]') as HTMLButtonElement)?.disabled,
    { timeout: 10_000 }
  );
  await page.click('button[type="submit"]');
}

async function navTo(page: any, path: string) {
  await page.click(`a[href="${path}"]`);
}

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
    await login(page, 'admin', 'wrongpassword');
    await expect(page.locator('.login-error')).toBeVisible();
  });
});

test.describe('Route guards', () => {
  test('unauthenticated access redirects', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForURL(/(login|unauthorized)/);
    await expect(page).toHaveURL(/\/(login|unauthorized)/);
  });

  test('unauthenticated cannot access /settings', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await page.waitForURL(/(login|unauthorized)/);
    await expect(page).toHaveURL(/\/(login|unauthorized)/);
  });

  test('admin can access /settings', async ({ page }) => {
    await login(page, 'admin');
    await page.waitForURL('**/dashboard');
    await navTo(page, '/settings');
    await page.waitForURL('**/settings');
    await expect(page).toHaveURL(/\/settings/);
  });
});

test.describe('Admin navigation', () => {
  test('admin navigates key pages via sidebar', async ({ page }) => {
    await login(page, 'admin');
    await page.waitForURL('**/dashboard');
    await navTo(page, '/property');
    await page.waitForURL('**/property');
    await navTo(page, '/residents');
    await page.waitForURL('**/residents');
    await navTo(page, '/audit');
    await page.waitForURL('**/audit');
    await expect(page).toHaveURL(/\/audit/);
  });
});
