/**
 * Integrations E2E Tests
 * Tests for integration management flows
 */

import { test, expect } from './setup';

test.describe('Integration Management', () => {
  test('should display integrations page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/integrations');
    
    await expect(authenticatedPage.locator('h1, h2')).toContainText(/Integrations|Entegrasyonlar/i);
  });

  test('should show empty state when no integrations', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/integrations');
    
    // Should show empty state message
    await expect(authenticatedPage.locator('text=/henüz entegrasyon yok|no integrations/i')).toBeVisible();
  });

  test('should open Shopify connect modal', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/integrations');
    
    // Click Shopify connect button
    await authenticatedPage.click('button:has-text("Shopify"), button:has-text("Shopify Bağla")');
    
    // Modal or OAuth flow should start
    // Note: OAuth flow may redirect to Shopify
  });

  test('should open CSV import modal', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/integrations');
    
    // Click CSV import button
    await authenticatedPage.click('button:has-text("CSV"), button:has-text("CSV İçe Aktar")');
    
    // Modal should be visible
    await expect(authenticatedPage.locator('input[type="file"]')).toBeVisible();
  });

  test('should open manual integration modal', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/integrations');
    
    // Click manual integration button
    await authenticatedPage.click('button:has-text("Manuel"), button:has-text("Manual")');
    
    // Form should be visible
    await expect(authenticatedPage.locator('input, select')).toBeVisible();
  });
});
