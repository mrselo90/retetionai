import * as fs from 'fs';

function filterLine(line: string): string | null {
   const trimmed = line.trim();
   if (trimmed.length < 20) return null;
   if (/^[\d\s.,%$€£₺\-+*/\\|!?@#&()[\]{}'"<>=]+$/.test(trimmed)) return null;
   const NOISE_PATTERNS = [
      /\d+\s*TL\s*ve\s*[üÜuU]zeri\s*(al[ıi][şs]veri[şs]lerde)?\s*(kargo\s*bedava|[üÜ]cretsiz\s*kargo)/gi,
      /[üÜ]cretsiz\s*kargo/gi,
      /kargo\s*bedava/gi,
      /free\s*shipping/gi,
      /free\s*delivery/gi,
      /hemen\s*al/gi,
      /sepete\s*ekle/gi,
      /add\s*to\s*cart/gi,
      /buy\s*now/gi,
      /shop\s*now/gi,
      /sipari[şs]\s*ver/gi,
      /bizi\s*(takip\s*edin|takip\s*et)/gi,
      /follow\s*us/gi,
      /share\s*this/gi,
      /paylaş/gi,
      /çerez\s*politikas[ıi]/gi,
      /cookie\s*policy/gi,
      /gizlilik\s*politikas[ıi]/gi,
      /^(anasayfa|home|menu|menü|kategori|kategoriler|contact|iletişim|hakkımızda|about us)$/gi,
   ];
   for (const pattern of NOISE_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(trimmed)) return null;
   }
   return trimmed;
}

function extractRawContentNew(html: string): string {
   let cleaned = html;
   const noiseSections = [
      /<nav\b[^>]*>[\s\S]*?<\/nav>/gi,
      /<header\b[^>]*>[\s\S]*?<\/header>/gi,
      /<footer\b[^>]*>[\s\S]*?<\/footer>/gi,
      /<aside\b[^>]*>[\s\S]*?<\/aside>/gi,
      /<div[^>]*(cookie|banner|announcement|notification|promo|shipping-bar|free-shipping)[^>]*>[\s\S]*?<\/div>/gi,
      /<(ol|ul|nav)[^>]*breadcrumb[^>]*>[\s\S]*?<\/(ol|ul|nav)>/gi,
   ];
   for (const sec of noiseSections) {
      cleaned = cleaned.replace(sec, ' ');
   }

   // SKIP step 2 entirely since it breaks on nested divs!

   // Use block tags to ensure logical separation of sentences, but replace inline tags with spaces so sentences aren't split
   const blockTags = ['div', 'p', 'br', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'table', 'ul', 'ol', 'dl', 'dt', 'dd', 'blockquote'];
   let text = cleaned
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(new RegExp(`<(?:${blockTags.join('|')})\\b[^>]*>`, 'gi'), '\n')
      .replace(new RegExp(`</(?:${blockTags.join('|')})>`, 'gi'), '\n')
      .replace(/<[^>]*>/g, ' '); // Inline tags just become spaces to prevent sentence joining without space, but they won't trigger a newline.

   text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

   const lines = text.split('\n');
   const keptLines: string[] = [];
   const seenLines = new Set<string>();

   for (const line of lines) {
      const filtered = filterLine(line);
      if (!filtered) continue;
      const normalized = filtered.toLowerCase().replace(/\s+/g, ' ');
      if (seenLines.has(normalized)) continue;
      seenLines.add(normalized);
      keptLines.push(filtered);
   }
   return keptLines.join('\n').trim();
}

const html = fs.readFileSync('./maruderm-page.html', 'utf-8');
const newLogic = extractRawContentNew(html);
console.log('--- NEW LOGIC LENGTH ---');
console.log(newLogic.length);
console.log('--- NEW LOGIC CONTENT ---');
console.log(newLogic);
