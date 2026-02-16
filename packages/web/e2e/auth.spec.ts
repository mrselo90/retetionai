/**
 * Authentication E2E Tests
 * Tests for signup, login, and authentication flows
 */

import { test, expect } from './setup';

test.describe('Authentication Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page).toHaveTitle(/Login|Giriş/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page, baseURL }) => {
    await page.goto('/login');
    
    // Fill login form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123!');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL(`${baseURL}/dashboard`);
    
    // Verify dashboard is loaded
    await expect(page.locator('h1, h2')).toContainText(/Dashboard|Anasayfa/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'WrongPassword');
    await page.click('button[type="submit"]');
    
    // Wait for error message
    await expect(page.locator('text=/invalid|geçersiz|hata/i')).toBeVisible({ timeout: 5000 });
  });

  test('should redirect to login when not authenticated', async ({ page, baseURL }) => {
    // Try to access protected page
    await page.goto(`${baseURL}/dashboard`);
    
    // Should redirect to login
    await page.waitForURL(`${baseURL}/login`);
  });

  test('should signup new merchant', async ({ page, baseURL }) => {
    await page.goto('/signup');
    
    // Fill signup form
    await page.fill('input[type="email"]', `test-${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'Test123!');
    await page.fill('input[name="name"], input[placeholder*="name" i]', 'Test Merchant');
    await page.click('button[type="submit"]');
    
    // Should show success message or redirect
    // Note: May require email confirmation in production
    await expect(page.locator('text=/success|başarı|created/i')).toBeVisible({ timeout: 10000 });
  });
});
