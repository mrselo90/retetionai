/**
 * E2E Test Setup
 * Global setup and teardown for E2E tests
 */

import { test as base } from '@playwright/test';
import { Page } from '@playwright/test';

/**
 * A real merchant login, from E2E_TEST_EMAIL / E2E_TEST_PASSWORD. Without it
 * (and the Supabase secrets the API needs to check it) only the tests that
 * never sign in can run; the rest are skipped rather than failed.
 */
export const testUser = {
  email: process.env.E2E_TEST_EMAIL || '',
  password: process.env.E2E_TEST_PASSWORD || '',
};
export const hasBackend = Boolean(
  testUser.email && testUser.password && process.env.SUPABASE_URL
);
export const BACKEND_SKIP_REASON =
  'Needs SUPABASE_* secrets and an E2E_TEST_EMAIL / E2E_TEST_PASSWORD merchant';

/**
 * Test fixtures
 */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page, baseURL }, use, testInfo) => {
    testInfo.skip(!hasBackend, BACKEND_SKIP_REASON);

    // Login before using the page
    await page.goto(`${baseURL}/login`);
    
    // Fill login form
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL(`${baseURL}/dashboard`);
    
    // `use` here is Playwright's fixture callback, not React's `use` hook. The
    // rule matches on the name and cannot tell the difference.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});

export { expect } from '@playwright/test';
