/**
 * Web scraper for product pages
 * Copied from API package to avoid cross-package source imports.
 */

export interface ScrapedProduct {
  title: string;
  description?: string;
  usageInstructions?: string;
  ingredients?: string;
  imageUrl?: string;
  price?: string;
  rawContent: string;
  metadata: {
    scrapedAt: string;
    url: string;
    statusCode: number;
  };
}

export interface ScrapeResult {
  success: boolean;
  product?: ScrapedProduct;
  error?: string;
}

export async function scrapeProductPage(url: string): Promise<ScrapeResult> {
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.protocol.startsWith('http')) {
      return { success: false, error: 'Invalid URL protocol' };
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GlowGuide-Bot/1.0 (Product Knowledge Scraper)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();
    const product = extractProductInfo(html, url);

    return {
      success: true,
      product: {
        ...product,
        metadata: {
          scrapedAt: new Date().toISOString(),
          url,
          statusCode: response.status,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function extractProductInfo(html: string, url: string): Omit<ScrapedProduct, 'metadata'> {
  const title =
    extractMetaTag(html, 'og:title') ||
    extractMetaTag(html, 'twitter:title') ||
    extractTag(html, 'title') ||
    'Unknown Product';

  const description =
    extractMetaTag(html, 'og:description') ||
    extractMetaTag(html, 'description') ||
    extractMetaTag(html, 'twitter:description') ||
    '';

  const imageUrl = extractMetaTag(html, 'og:image') || extractMetaTag(html, 'twitter:image') || '';

  const price =
    extractMetaTag(html, 'product:price:amount') || extractSchemaOrgField(html, 'price') || '';

  const usageInstructions = extractUsageInstructions(html);
  const ingredients = extractIngredients(html);
  const rawContent = extractRawContent(html);

  return {
    title: cleanText(title),
    description: description ? cleanText(description) : undefined,
    usageInstructions: usageInstructions ? cleanText(usageInstructions) : undefined,
    ingredients: ingredients ? cleanText(ingredients) : undefined,
    imageUrl: imageUrl || undefined,
    price: price || undefined,
    rawContent: cleanText(rawContent),
  };
}

function extractMetaTag(html: string, property: string): string | null {
  const propertyRegex = new RegExp(
    `<meta[^>]*property=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  const propertyMatch = html.match(propertyRegex);
  if (propertyMatch) return propertyMatch[1];

  const nameRegex = new RegExp(
    `<meta[^>]*name=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  const nameMatch = html.match(nameRegex);
  if (nameMatch) return nameMatch[1];

  return null;
}

function extractTag(html: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

function extractSchemaOrgField(html: string, field: string): string | null {
  const schemaRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
  const matches = html.matchAll(schemaRegex);

  for (const match of matches) {
    try {
      const json = JSON.parse(match[1]);
      if (json[field]) return String(json[field]);
      if (json.offers && json.offers[field]) return String(json.offers[field]);
    } catch {
      continue;
    }
  }

  return null;
}

function extractUsageInstructions(html: string): string | null {
  const patterns = [
    /kullanım şekli[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /nasıl kullanılır[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /usage instructions[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /how to use[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /directions[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return match[1].substring(0, 500);
    }
  }

  return null;
}

function extractIngredients(html: string): string | null {
  const patterns = [
    /içerik[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /ingredients[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /composition[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return match[1].substring(0, 1000);
    }
  }

  return null;
}

function extractRawContent(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]*>/g, ' ');

  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  text = text.replace(/\s+/g, ' ').trim();
  return text.substring(0, 10000);
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

