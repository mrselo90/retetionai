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
  warnings?: string;
  rawSections?: {
    title?: string;
    description?: string;
    usage?: string;
    ingredients?: string;
    warnings?: string;
    specs?: string;
  };
  extractionMetrics?: {
    rawChars: number;
    rawLines: number;
    keptLines: number;
    sectionsFound: string[];
  };
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
        'User-Agent': 'Recete-Bot/1.0 (Product Knowledge Scraper)',
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
  const warnings = extractWarnings(html);
  const specs = extractSpecs(html, {
    title,
    description,
    ingredients,
    usageInstructions,
  });

  // Extract raw text content (remove HTML tags, scripts, styles)
  const rawContent = extractRawContent(html);
  const rawSections = {
    title: cleanText(title),
    description: description ? cleanText(description) : undefined,
    usage: usageInstructions ? cleanText(usageInstructions) : undefined,
    ingredients: ingredients ? cleanText(ingredients) : undefined,
    warnings: warnings ? cleanText(warnings) : undefined,
    specs: specs ? cleanText(specs) : undefined,
  };
  const sectionsFound = Object.entries(rawSections)
    .filter(([, v]) => Boolean(v))
    .map(([k]) => k);

  return {
    title: cleanText(title),
    description: description ? cleanText(description) : undefined,
    usageInstructions: usageInstructions ? cleanText(usageInstructions) : undefined,
    ingredients: ingredients ? cleanText(ingredients) : undefined,
    imageUrl: imageUrl || undefined,
    price: price || undefined,
    warnings: warnings ? cleanText(warnings) : undefined,
    rawSections,
    extractionMetrics: {
      rawChars: rawContent.length,
      rawLines: rawContent.split('\n').length,
      keptLines: rawContent ? rawContent.split('\n').filter(Boolean).length : 0,
      sectionsFound,
    },
    // Keep line/section boundaries for downstream enrichment and future section-aware chunking.
    rawContent: rawContent.trim(),
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
    /kullanım[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /usage instructions[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /how to use[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /directions[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /használat(?:i útmutató)?[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /alkalmazás[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
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
    /i̇çindekiler[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /ingredients[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /composition[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /összetevők[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /hatóanyagok[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /inci[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
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
 * Extract warnings / cautions (cosmetics)
 */
function extractWarnings(html: string): string | null {
  const patterns = [
    /uyarı(?:lar)?[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /dikkat[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /warning(?:s)?[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /caution[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /figyelmeztetés[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
    /óvintézkedés(?:ek)?[:\s]*([^<]*(?:<[^>]*>[^<]*)*)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].substring(0, 800);
  }
  return null;
}

/**
 * Extract compact specs from the page body (size/volume/SPF/pH)
 */
function extractSpecs(
  html: string,
  context: { title?: string; description?: string; ingredients?: string | null; usageInstructions?: string | null }
): string | null {
  const source = [html, context.title, context.description, context.ingredients, context.usageInstructions]
    .filter(Boolean)
    .join('\n');
  const found = new Set<string>();

  const patterns = [
    /\b\d{1,4}\s?(?:ml|mL|g|kg|oz)\b/gi,
    /\bSPF\s?\d{1,3}\b/gi,
    /\bpH\s?\d(?:[.,]\d)?\b/gi,
    /\b\d{1,3}\s?%\b/gi,
  ];

  for (const pattern of patterns) {
    const matches = source.match(pattern) || [];
    for (const m of matches) found.add(m.trim());
  }

  if (found.size === 0) return null;
  return Array.from(found).slice(0, 12).join(' | ');
}

// ── Noise patterns that should be filtered from scraped content ──
const NOISE_PATTERNS: RegExp[] = [
  // Shipping / logistics promotions (repeated banners)
  /\d+\s*TL\s*ve\s*[üÜuU]zeri\s*(al[ıi][şs]veri[şs]lerde)?\s*(kargo\s*bedava|[üÜ]cretsiz\s*kargo)/gi,
  /[üÜ]cretsiz\s*kargo/gi,
  /kargo\s*bedava/gi,
  /free\s*shipping/gi,
  /free\s*delivery/gi,
  // Generic CTAs
  /hemen\s*al/gi,
  /sepete\s*ekle/gi,
  /add\s*to\s*cart/gi,
  /buy\s*now/gi,
  /shop\s*now/gi,
  /sipari[şs]\s*ver/gi,
  // Social share / follow
  /bizi\s*(takip\s*edin|takip\s*et)/gi,
  /follow\s*us/gi,
  /share\s*this/gi,
  /paylaş/gi,
  // Cookie / privacy banners
  /çerez\s*politikas[ıi]/gi,
  /cookie\s*policy/gi,
  /gizlilik\s*politikas[ıi]/gi,
  // Empty nav lines
  /^(anasayfa|home|menu|menü|kategori|kategoriler|contact|iletişim|hakkımızda|about us)$/gi,
  // Hungarian e-commerce noise
  /ingyenes\s*szállítás/gi,
  /kosárba/gi,
  /vásárlás/gi,
  /rendelés\s*leadása/gi,
  /adatvédelmi/gi,
  /kövess\s*minket/gi,
  /megosztás/gi,
  /süti\s*kezelés/gi,
  /^(főoldal|menü|kategóriák|kapcsolat|rólunk)$/gi,
];

/**
 * Remove noise from a line of text — returns null if the line should be dropped
 */
function filterLine(line: string): string | null {
  const trimmed = line.trim();
  const compact = trimmed.replace(/\s+/g, ' ');

  // Keep short but high-signal cosmetic/spec lines (e.g., "400 ml", "SPF 50", "pH 5.5")
  const shortSignalPatterns = [
    /\b\d{1,4}\s?(ml|g|kg|oz)\b/i,
    /\bSPF\s?\d{1,3}\b/i,
    /\bpH\s?\d(?:[.,]\d)?\b/i,
    /\bINCI\b/i,
    /\bPA\+{1,4}\b/i,
    /\b\d{1,3}\s?%\b/i,
  ];
  const isShortSignal = shortSignalPatterns.some((p) => p.test(compact));

  // Drop very short lines (less than 20 chars) — likely nav items or punctuation
  if (trimmed.length < 20 && !isShortSignal) return null;

  // Drop lines that are entirely punctuation / numbers / symbols
  if (/^[\d\s.,%$€£₺\-+*/\\|!?@#&()[\]{}'"<>=]+$/.test(trimmed)) return null;

  // Apply noise pattern filters
  for (const pattern of NOISE_PATTERNS) {
    pattern.lastIndex = 0; // reset stateful regex
    if (pattern.test(trimmed)) return null;
  }

  return compact;
}

/**
 * Extract raw text content — with noise filtering and deduplication
 */
function extractRawContent(html: string): string {
  // ── Step 1: Remove entire noisy DOM sections ──────────────────
  let cleaned = html;

  // Remove nav, header, footer, cookie banners, breadcrumbs, sidebar
  const noiseSections = [
    /<nav\b[^>]*>[\s\S]*?<\/nav>/gi,
    /<header\b[^>]*>[\s\S]*?<\/header>/gi,
    /<footer\b[^>]*>[\s\S]*?<\/footer>/gi,
    /<aside\b[^>]*>[\s\S]*?<\/aside>/gi,
    // common cookie/banner class names
    /<div[^>]*(cookie|banner|announcement|notification|promo|shipping-bar|free-shipping)[^>]*>[\s\S]*?<\/div>/gi,
    // breadcrumb
    /<(ol|ul|nav)[^>]*breadcrumb[^>]*>[\s\S]*?<\/(ol|ul|nav)>/gi,
  ];

  for (const sec of noiseSections) {
    cleaned = cleaned.replace(sec, ' ');
  }

  // ── Step 2: Strip scripts, styles, remaining HTML tags ────────
  // To avoid breaking sentences, block-level tags are replaced by newlines.
  // Inline tags are replaced by a space so words don't merge together.
  const blockTags = ['div', 'p', 'br', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'table', 'ul', 'ol', 'dl', 'dt', 'dd', 'blockquote'];
  let text = cleaned
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(new RegExp(`<(?:${blockTags.join('|')})\\b[^>]*>`, 'gi'), '\n')
    .replace(new RegExp(`</(?:${blockTags.join('|')})>`, 'gi'), '\n')
    .replace(/<[^>]*>/g, ' '); // Replace all inline tags with spaces

  // ── Step 3: Decode HTML entities ─────────────────────────────
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#\d+;/g, ' ');

  // ── Step 4: Filter noise lines + deduplicate ─────────────────
  const seenLines = new Set<string>();
  const lines = text.split('\n');
  const keptLines: string[] = [];

  for (const line of lines) {
    const filtered = filterLine(line);
    if (!filtered) continue;

    // Deduplication — normalise for comparison
    const normalized = filtered.toLowerCase().replace(/\s+/g, ' ');
    if (seenLines.has(normalized)) continue;
    seenLines.add(normalized);

    keptLines.push(filtered);
  }

  // ── Step 5: Re-join and limit ─────────────────────────────────
  const result = keptLines.join('\n').trim();
  return result.substring(0, 10000);
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
