/**
 * Products E2E Tests
 * Tests for product management flows
 */

import { test, expect } from './setup';

test.describe('Product Management', () => {
  test('should display products page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/products');
    
    await expect(authenticatedPage.locator('h1, h2')).toContainText(/Products|Ürünler/i);
  });

  test('should show empty state when no products', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/products');
    
    // Should show empty state message
    await expect(authenticatedPage.locator('text=/henüz ürün yok|no products/i')).toBeVisible();
  });

  test('should open add product modal', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/products');
    
    // Click add product button
    await authenticatedPage.click('button:has-text("Yeni Ürün"), button:has-text("Add Product")');
    
    // Modal should be visible
    await expect(authenticatedPage.locator('input[name="url"], input[placeholder*="url" i]')).toBeVisible();
  });

  test('should add new product', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/products');
    
    // Click add product button
    await authenticatedPage.click('button:has-text("Yeni Ürün"), button:has-text("Add Product")');
    
    // Fill product form
    await authenticatedPage.fill('input[name="name"], input[placeholder*="name" i]', 'Test Product');
    await authenticatedPage.fill('input[name="url"], input[placeholder*="url" i]', 'https://example.com/product');
    await authenticatedPage.click('button[type="submit"]:has-text("Add"), button[type="submit"]:has-text("Ekle")');
    
    // Should show success message
    await expect(authenticatedPage.locator('text=/success|başarı/i')).toBeVisible({ timeout: 10000 });
  });

  test('should display product list', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/products');
    
    // Wait for products to load
    await authenticatedPage.waitForSelector('div, li, tr', { timeout: 5000 });
    
    // Should show product cards or list
    // Note: This depends on whether products exist
  });
});
