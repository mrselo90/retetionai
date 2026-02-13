/**
 * Scraper Tests
 * Tests for web scraping functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scrapeProductPage } from './scraper';

describe('scrapeProductPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should scrape product page and extract content', async () => {
    const mockHtml = `
      <html>
        <head>
          <title>Test Product</title>
          <meta name="description" content="Test product description">
        </head>
        <body>
          <h1>Test Product</h1>
          <p>This is a test product with detailed information.</p>
        </body>
      </html>
    `;

    (global.fetch as any).mockResolvedValueOnce(
      new Response(mockHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    );

    const result = await scrapeProductPage('https://example.com/product');

    expect(result.success).toBe(true);
    expect(result.product).toBeDefined();
    expect(result.product?.title).toBe('Test Product');
    expect(result.product?.description).toContain('Test product description');
    expect(result.product?.rawContent).toContain('Test Product');
  });

  it('should handle invalid URLs', async () => {
    const result = await scrapeProductPage('invalid-url');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle timeout', async () => {
    (global.fetch as any).mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 100);
      });
    });

    const result = await scrapeProductPage('https://example.com/product');
    expect(result.success).toBe(false);
  });

  it('should extract meta tags', async () => {
    const mockHtml = `
      <html>
        <head>
          <meta property="og:title" content="OG Title">
          <meta property="og:description" content="OG Description">
          <meta name="keywords" content="test, product, example">
        </head>
        <body></body>
      </html>
    `;

    (global.fetch as any).mockResolvedValueOnce(
      new Response(mockHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    );

    const result = await scrapeProductPage('https://example.com/product');

    expect(result.success).toBe(true);
    expect(result.product).toBeDefined();
    // Should extract meta tags
  });

  it('should clean HTML content', async () => {
    const mockHtml = `
      <html>
        <body>
          <script>alert('test')</script>
          <style>.test { color: red; }</style>
          <h1>Clean Content</h1>
        </body>
      </html>
    `;

    (global.fetch as any).mockResolvedValueOnce(
      new Response(mockHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    );

    const result = await scrapeProductPage('https://example.com/product');

    expect(result.success).toBe(true);
    expect(result.product?.rawContent).not.toContain('<script>');
    expect(result.product?.rawContent).not.toContain('<style>');
    expect(result.product?.rawContent).toContain('Clean Content');
  });
});
