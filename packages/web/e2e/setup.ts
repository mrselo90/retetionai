/**
 * E2E Test Setup
 * Global setup and teardown for E2E tests
 */

import { test as base } from '@playwright/test';
import { Page } from '@playwright/test';

/**
 * Test fixtures
 */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page, baseURL }, use) => {
    // Login before using the page
    await page.goto(`${baseURL}/login`);
    
    // Fill login form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123!');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL(`${baseURL}/dashboard`);
    
    await use(page);
  },
});

export { expect } from '@playwright/test';
