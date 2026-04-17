import { test, expect, Page } from '@playwright/test';

const BASE = process.env['E2E_BASE_URL'] ?? '';

async function login(page: Page, username: string, password = 'harborpoint2024') {
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

async function navTo(page: Page, path: string) {
  await page.click(`a[href="${path}"]`);
}

test.describe('Authentication', () => {
  test('login page renders', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('form')).toBeVisible();
  });

  test('admin login → /dashboard', async ({ page }) => {
    await login(page, 'admin');
    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('resident login → /my-profile', async ({ page }) => {
    await login(page, 'resident');
    await page.waitForURL('**/my-profile');
    await expect(page).toHaveURL(/\/my-profile/);
  });

  test('compliance login → /documents', async ({ page }) => {
    await login(page, 'compliance');
    await page.waitForURL('**/documents');
    await expect(page).toHaveURL(/\/documents/);
  });

  test('analyst login → /analytics', async ({ page }) => {
    await login(page, 'analyst');
    await page.waitForURL('**/analytics');
    await expect(page).toHaveURL(/\/analytics/);
  });

  test('wrong password shows error', async ({ page }) => {
    await login(page, 'admin', 'badpassword');
    await expect(page.locator('.login-error')).toBeVisible();
  });

  test('unknown username shows error', async ({ page }) => {
    await login(page, 'nobody');
    await expect(page.locator('.login-error')).toBeVisible();
  });

  test('unauthenticated /dashboard redirects', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForURL(/(login|unauthorized)/);
    await expect(page).toHaveURL(/\/(login|unauthorized)/);
  });

  test('unauthenticated /settings redirects', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await page.waitForURL(/(login|unauthorized)/);
    await expect(page).toHaveURL(/\/(login|unauthorized)/);
  });
});

test.describe('Admin journey', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
    await page.waitForURL('**/dashboard');
  });

  test('dashboard renders', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('admin → /property', async ({ page }) => {
    await navTo(page, '/property');
    await page.waitForURL('**/property');
    await expect(page).toHaveURL(/\/property/);
  });

  test('admin → /residents', async ({ page }) => {
    await navTo(page, '/residents');
    await page.waitForURL('**/residents');
    await expect(page).toHaveURL(/\/residents/);
  });

  test('admin → /audit', async ({ page }) => {
    await navTo(page, '/audit');
    await page.waitForURL('**/audit');
    await expect(page).toHaveURL(/\/audit/);
  });

  test('admin → /settings', async ({ page }) => {
    await navTo(page, '/settings');
    await page.waitForURL('**/settings');
    await expect(page).toHaveURL(/\/settings/);
  });
});

test.describe('Route guards', () => {
  test('/property blocked unauthenticated', async ({ page }) => {
    await page.goto(`${BASE}/property`);
    await page.waitForURL(/(login|unauthorized)/);
    await expect(page).toHaveURL(/\/(login|unauthorized)/);
  });

  test('/audit blocked unauthenticated', async ({ page }) => {
    await page.goto(`${BASE}/audit`);
    await page.waitForURL(/(login|unauthorized)/);
    await expect(page).toHaveURL(/\/(login|unauthorized)/);
  });
});

test.describe('Role landing pages', () => {
  test('resident → /my-profile', async ({ page }) => {
    await login(page, 'resident');
    await page.waitForURL('**/my-profile');
    await expect(page).toHaveURL(/\/my-profile/);
  });

  test('compliance → /documents', async ({ page }) => {
    await login(page, 'compliance');
    await page.waitForURL('**/documents');
    await expect(page).toHaveURL(/\/documents/);
  });

  test('analyst → /analytics', async ({ page }) => {
    await login(page, 'analyst');
    await page.waitForURL('**/analytics');
    await expect(page).toHaveURL(/\/analytics/);
  });
});

test.describe('Unauthorized page', () => {
  test('renders for guarded routes', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await page.waitForURL(/(login|unauthorized)/);
    await expect(page.locator('body')).toBeVisible();
  });
});
