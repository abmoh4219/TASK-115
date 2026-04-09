/**
 * E2E — Critical Role-Based Journeys
 *
 * Minimal browser-level tests covering:
 * 1. Admin login → dashboard → guarded route access
 * 2. Resident login → my-profile → blocked from admin routes
 * 3. Compliance login → document queue → guarded access
 *
 * Uses the deterministic QA credentials.
 * Requires `ng serve` running on localhost:4200 (handled by playwright.config.ts webServer).
 */

import { test, expect, Page } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────

async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
}

// ── 1. Admin journey ──────────────────────────────────────────────

test.describe('Admin journey', () => {

  test('login → dashboard → settings accessible', async ({ page }) => {
    await login(page, 'admin', 'harborpoint2024');

    // Should land on admin dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.locator('body')).toBeVisible();

    // Navigate to settings (admin-only route)
    await page.goto('/settings');
    await page.waitForURL('**/settings');
    // Should NOT redirect to /unauthorized
    expect(page.url()).toContain('/settings');
  });

  test('admin can access property page', async ({ page }) => {
    await login(page, 'admin', 'harborpoint2024');
    await page.waitForURL('**/dashboard');

    await page.goto('/property');
    await page.waitForURL('**/property');
    expect(page.url()).toContain('/property');
  });

  test('admin can access audit log', async ({ page }) => {
    await login(page, 'admin', 'harborpoint2024');
    await page.waitForURL('**/dashboard');

    await page.goto('/audit');
    await page.waitForURL('**/audit');
    expect(page.url()).toContain('/audit');
  });
});

// ── 2. Resident journey ──────────────────────────────────────────

test.describe('Resident journey', () => {

  test('login → my-profile landing', async ({ page }) => {
    await login(page, 'resident', 'harborpoint2024');

    // Resident should land on my-profile
    await page.waitForURL('**/my-profile');
    expect(page.url()).toContain('/my-profile');
  });

  test('resident blocked from admin-only routes', async ({ page }) => {
    await login(page, 'resident', 'harborpoint2024');
    await page.waitForURL('**/my-profile');

    // Try to access admin-only settings page
    await page.goto('/settings');
    // Should redirect to /unauthorized
    await page.waitForURL('**/unauthorized');
    expect(page.url()).toContain('/unauthorized');
  });

  test('resident can access messages', async ({ page }) => {
    await login(page, 'resident', 'harborpoint2024');
    await page.waitForURL('**/my-profile');

    await page.goto('/messages');
    await page.waitForURL('**/messages');
    expect(page.url()).toContain('/messages');
  });
});

// ── 3. Compliance journey ────────────────────────────────────────

test.describe('Compliance journey', () => {

  test('login → document queue landing', async ({ page }) => {
    await login(page, 'compliance', 'harborpoint2024');

    // Compliance should land on documents queue
    await page.waitForURL('**/documents');
    expect(page.url()).toContain('/documents');
  });

  test('compliance blocked from admin-only routes', async ({ page }) => {
    await login(page, 'compliance', 'harborpoint2024');
    await page.waitForURL('**/documents');

    await page.goto('/property');
    await page.waitForURL('**/unauthorized');
    expect(page.url()).toContain('/unauthorized');
  });
});

// ── 4. Unauthenticated access ────────────────────────────────────

test.describe('Unauthenticated access', () => {

  test('direct navigation to guarded route redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to login since not authenticated
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should stay on login page and show error
    expect(page.url()).toContain('/login');
    await expect(page.locator('.login-error')).toBeVisible();
  });
});
