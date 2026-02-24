/**
 * Settings E2E Tests
 * Tests for settings and configuration flows
 */

import { test, expect } from './setup';

test.describe('Settings', () => {
  test('should display settings page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings');
    
    await expect(authenticatedPage.locator('h1, h2')).toContainText(/Settings|Ayarlar/i);
  });

  test('should update persona settings', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings');
    
    // Find persona settings inputs
    const botNameInput = authenticatedPage.locator('input[name="bot_name"], input[placeholder*="bot name" i]');
    
    if (await botNameInput.count() > 0) {
      await botNameInput.fill('Test Bot');
      
      // Click save button
      await authenticatedPage.click('button:has-text("Save"), button:has-text("Kaydet")');
      
      // Should show success message
      await expect(authenticatedPage.locator('text=/success|başarı/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should not display merchant API keys section', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings');

    await expect(authenticatedPage.locator('text=/API Key|API Anahtarı/i')).toHaveCount(0);
  });
});
