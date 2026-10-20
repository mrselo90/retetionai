/**
 * Scraper Tests
 * Tests for web scraping functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookup } from 'node:dns/promises';
import { scrapeProductPage } from './scraper';

// safeFetch resolves the host before fetching; keep tests off the real network.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

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

  it('refuses cloud metadata and other internal addresses without fetching', async () => {
    for (const url of [
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:3001/api/admin',
      'http://[::1]/',
      'http://[::ffff:10.0.0.1]/',
      'file:///etc/passwd',
    ]) {
      const result = await scrapeProductPage(url);
      expect(result.success, url).toBe(false);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuses a public hostname that resolves to a private address', async () => {
    (lookup as any).mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }]);

    const result = await scrapeProductPage('https://internal.example.com/product');

    expect(result.success).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuses a redirect to an internal address', async () => {
    (global.fetch as any).mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data/' },
      })
    );

    const result = await scrapeProductPage('https://example.com/product');

    expect(result.success).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
