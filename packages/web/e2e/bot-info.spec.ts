/**
 * Bot Info E2E Tests
 * Verifies persistent feedback on the bot-guidelines page.
 */

import { test, expect } from './setup';

test.describe('Bot Info', () => {
  test('should display bot info page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings/bot-info');

    await expect(authenticatedPage.locator('h1, h2')).toContainText(/Bot Info|Bot bilgisi/i);
  });

  test('should persist save feedback after updating bot info', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings/bot-info');

    const firstTextarea = authenticatedPage.locator('textarea').first();

    if (await firstTextarea.count() > 0) {
      await firstTextarea.fill('Updated guidance for regression coverage.');
      await authenticatedPage.click('button:has-text("Save"), button:has-text("Kaydet")');

      await expect(
        authenticatedPage.locator('text=/bot guidelines saved|bot yönergeleri kaydedildi|guideline changes are live|yönergesi değişiklikleri/i')
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
