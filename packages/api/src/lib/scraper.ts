/**
 * Web scraper for product pages
 * Extracts product information (title, description, usage instructions)
 */

export interface ScrapedProduct {
  title: string;
  description?: string;
  usageInstructions?: string;
  ingredients?: string;
  imageUrl?: string;
  price?: string;
  rawContent: string; // Full text content for RAG
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

/**
 * Scrape product page using fetch + HTML parsing
 * For MVP, we use native fetch + regex/string parsing
 * Can be upgraded to Cheerio/Puppeteer later
 */
export async function scrapeProductPage(url: string): Promise<ScrapeResult> {
  try {
    // Validate URL
    const parsedUrl = new URL(url);
    if (!parsedUrl.protocol.startsWith('http')) {
      return { success: false, error: 'Invalid URL protocol' };
    }

    // Fetch page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GlowGuide-Bot/1.0 (Product Knowledge Scraper)',
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();

    // Extract product information
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

/**
 * Extract product information from HTML
 * Uses meta tags, schema.org, and common patterns
 */
function extractProductInfo(html: string, url: string): Omit<ScrapedProduct, 'metadata'> {
  // Extract title
  const title = 
    extractMetaTag(html, 'og:title') ||
    extractMetaTag(html, 'twitter:title') ||
    extractTag(html, 'title') ||
    'Unknown Product';

  // Extract description
  const description =
    extractMetaTag(html, 'og:description') ||
    extractMetaTag(html, 'description') ||
    extractMetaTag(html, 'twitter:description') ||
    '';

  // Extract image
  const imageUrl =
    extractMetaTag(html, 'og:image') ||
    extractMetaTag(html, 'twitter:image') ||
    '';

  // Extract price
  const price =
    extractMetaTag(html, 'product:price:amount') ||
    extractSchemaOrgField(html, 'price') ||
    '';

  // Extract usage instructions (common patterns)
  const usageInstructions = extractUsageInstructions(html);

  // Extract ingredients (for cosmetics)
  const ingredients = extractIngredients(html);

  // Extract raw text content (remove HTML tags, scripts, styles)
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

/**
 * Extract meta tag content
 */
function extractMetaTag(html: string, property: string): string | null {
  // Try property attribute (og:, product:)
  const propertyRegex = new RegExp(
    `<meta[^>]*property=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  const propertyMatch = html.match(propertyRegex);
  if (propertyMatch) return propertyMatch[1];

  // Try name attribute (description, twitter:)
  const nameRegex = new RegExp(
    `<meta[^>]*name=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  const nameMatch = html.match(nameRegex);
  if (nameMatch) return nameMatch[1];

  return null;
}

/**
 * Extract HTML tag content
 */
function extractTag(html: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

/**
 * Extract schema.org JSON-LD field
 */
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

/**
 * Extract usage instructions (common patterns)
 */
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
      // Extract up to 500 chars
      return match[1].substring(0, 500);
    }
  }

  return null;
}

/**
 * Extract ingredients (for cosmetics)
 */
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

/**
 * Extract raw text content (remove HTML tags)
 */
function extractRawContent(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, ' ');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Limit to 10000 chars for RAG
  return text.substring(0, 10000);
}

/**
 * Clean text (trim, collapse whitespace)
 */
function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
