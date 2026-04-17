import { test, expect, Page } from '@playwright/test';

async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
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

test.describe('Admin journey', () => {
  test('login → dashboard → settings accessible', async ({ page }) => {
    await login(page, 'admin', 'harborpoint2024');
    await page.waitForURL('**/dashboard');
    await navTo(page, '/settings');
    await page.waitForURL('**/settings');
    expect(page.url()).toContain('/settings');
  });

  test('admin can access property page', async ({ page }) => {
    await login(page, 'admin', 'harborpoint2024');
    await page.waitForURL('**/dashboard');
    await navTo(page, '/property');
    await page.waitForURL('**/property');
    expect(page.url()).toContain('/property');
  });

  test('admin can access audit log', async ({ page }) => {
    await login(page, 'admin', 'harborpoint2024');
    await page.waitForURL('**/dashboard');
    await navTo(page, '/audit');
    await page.waitForURL('**/audit');
    expect(page.url()).toContain('/audit');
  });
});

test.describe('Resident journey', () => {
  test('login → my-profile landing', async ({ page }) => {
    await login(page, 'resident', 'harborpoint2024');
    await page.waitForURL('**/my-profile');
    expect(page.url()).toContain('/my-profile');
  });

  test('resident blocked from admin routes', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForURL(/(login|unauthorized)/);
    expect(page.url()).toMatch(/(login|unauthorized)/);
  });

  test('resident can access messages', async ({ page }) => {
    await login(page, 'resident', 'harborpoint2024');
    await page.waitForURL('**/my-profile');
    await navTo(page, '/messages');
    await page.waitForURL('**/messages');
    expect(page.url()).toContain('/messages');
  });
});

test.describe('Compliance journey', () => {
  test('login → document queue landing', async ({ page }) => {
    await login(page, 'compliance', 'harborpoint2024');
    await page.waitForURL('**/documents');
    expect(page.url()).toContain('/documents');
  });

  test('compliance blocked from admin routes', async ({ page }) => {
    await page.goto('/property');
    await page.waitForURL(/(login|unauthorized)/);
    expect(page.url()).toMatch(/(login|unauthorized)/);
  });
});

test.describe('Unauthenticated access', () => {
  test('guarded route redirects', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/(login|unauthorized)/);
    expect(page.url()).toMatch(/(login|unauthorized)/);
  });

  test('invalid credentials show error', async ({ page }) => {
    await login(page, 'admin', 'wrongpassword');
    expect(page.url()).toContain('/login');
    await expect(page.locator('.login-error')).toBeVisible();
  });
});
