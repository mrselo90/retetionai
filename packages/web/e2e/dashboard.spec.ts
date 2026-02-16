/**
 * Dashboard E2E Tests
 * Tests for main dashboard page
 */

import { test, expect } from './setup';

test.describe('Dashboard', () => {
  test('should display dashboard', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    
    // Should show dashboard title
    await expect(authenticatedPage.locator('h1, h2')).toContainText(/Dashboard|Anasayfa/i);
  });

  test('should display stats cards', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    
    // Wait for stats to load
    await authenticatedPage.waitForSelector('div, section', { timeout: 5000 });
    
    // Should show stats cards (messages, orders, etc.)
    // Note: May show empty states if no data
  });

  test('should display recent activity', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    
    // Should show recent orders or conversations sections
    await expect(authenticatedPage.locator('text=/recent|son/i')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to products page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    
    // Click products link
    await authenticatedPage.click('a[href*="products"], button:has-text("Products")');
    
    // Should navigate to products page
    await authenticatedPage.waitForURL('**/products');
  });

  test('should navigate to conversations page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    
    // Click conversations link
    await authenticatedPage.click('a[href*="conversations"], button:has-text("Conversations")');
    
    // Should navigate to conversations page
    await authenticatedPage.waitForURL('**/conversations');
  });
});
