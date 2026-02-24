#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const DEFAULT_URLS = [
  'https://maruderm.hu/products/maruderm-arctisztito-sminkeltavolito-olaj-400-ml',
  'https://maruderm.hu/products/maruderm-gyenged-arctisztito-gel-erzekeny-borre-400-ml',
  'https://maruderm.hu/products/maruderm-szalicilsavas-arctisztito-gel-normal-es-zsiros-borre-400-ml',
  'https://maruderm.hu/products/maruderm-7-glikolsav-egyseges-bortonus-tonik-250-ml',
  'https://maruderm.hu/products/maruderm-centella-asiatica-nyugtato-es-hidratalo-tonik-250-ml',
  'https://maruderm.hu/products/maruderm-bha-porustisztito-tonik-250-ml',
  'https://maruderm.hu/products/maruderm-borvedo-es-regeneralo-barrier-hidratalo-200-ml',
  'https://maruderm.hu/products/maruderm-pigmentfoltok-elleni-apolo-hidratalo-200-ml',
  'https://maruderm.hu/products/maruderm-centella-nyugtato-hatasu-hidratalo-200-ml',
  'https://maruderm.hu/products/maruderm-cica-spf15-szinkorrekcios-krem-30ml',
];

const OUTPUT = process.env.MARUDERM_INGEST_OUTPUT || path.join(root, 'tmp/maruderm-test-products.json');
const API_BASE = process.env.EVAL_API_BASE || 'http://127.0.0.1:3002';
const INTERNAL_SECRET = process.env.EVAL_INTERNAL_SECRET || process.env.INTERNAL_SERVICE_SECRET || '';
const MERCHANT_ID = process.env.EVAL_MERCHANT_ID || process.env.TEST_MERCHANT_ID || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!INTERNAL_SECRET) throw new Error('Missing EVAL_INTERNAL_SECRET or INTERNAL_SERVICE_SECRET');
if (!MERCHANT_ID) throw new Error('Missing EVAL_MERCHANT_ID or TEST_MERCHANT_ID');
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase service env vars');

const { scrapeProductPage } = await import(path.join(root, 'packages/api/dist/lib/scraper.js'));

const sbHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

const internalHeaders = {
  'Content-Type': 'application/json',
  'X-Internal-Secret': INTERNAL_SECRET,
  'X-Internal-Merchant-Id': MERCHANT_ID,
};

function decodeHtmlEntities(s) {
  return s
    .replaceAll('&amp;', '&')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&ndash;', '-')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function slugFromUrl(url) {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop() || null;
  } catch {
    return null;
  }
}

function isPasswordPage(text = '') {
  const t = text.toLowerCase();
  return t.includes('password protected') || t.includes('enter store password');
}

async function sb(pathname, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${pathname}`, {
    ...init,
    headers: { ...sbHeaders, ...(init.headers || {}) },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`Supabase ${res.status} ${pathname}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  }
  return json;
}

async function internalPost(pathname, body) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method: 'POST',
    headers: internalHeaders,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`Internal ${res.status} ${pathname}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  }
  return json;
}

async function getExistingProductByUrl(url) {
  const rows = await sb(`/products?merchant_id=eq.${MERCHANT_ID}&url=eq.${encodeURIComponent(url)}&select=id,name,url&limit=1`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function upsertProductBase({ url, title, rawText }) {
  const existing = await getExistingProductByUrl(url);
  const cleanTitle = decodeHtmlEntities(title || slugFromUrl(url) || 'Maruderm Product').slice(0, 255);

  if (existing?.id) {
    await sb(`/products?id=eq.${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: cleanTitle,
        raw_text: rawText,
      }),
    });
    return existing.id;
  }

  const slug = (slugFromUrl(url) || `maruderm-${Date.now()}`).slice(0, 220);
  const inserted = await sb('/products', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([{
      merchant_id: MERCHANT_ID,
      name: cleanTitle,
      url,
      external_id: `maruderm-${slug}`.slice(0, 255),
      raw_text: rawText,
    }]),
  });

  const productId = inserted?.[0]?.id;
  if (!productId) throw new Error('Insert did not return product id');
  return productId;
}

async function patchEnrichedText(productId, enrichedText) {
  await sb(`/products?id=eq.${productId}`, {
    method: 'PATCH',
    body: JSON.stringify({ enriched_text: enrichedText }),
  });
}

async function processUrl(url) {
  const scrape = await scrapeProductPage(url);
  if (!scrape.success || !scrape.product) {
    return { url, status: 'scrape_failed', error: scrape.error || 'Unknown scrape error' };
  }

  const p = scrape.product;
  if (!p.rawContent || p.rawContent.length < 200 || isPasswordPage(p.rawContent)) {
    return {
      url,
      status: 'scrape_low_quality',
      title: decodeHtmlEntities(p.title || ''),
      rawLen: p.rawContent?.length || 0,
    };
  }

  const productId = await upsertProductBase({
    url,
    title: p.title,
    rawText: p.rawContent,
  });

  const enrich = await internalPost('/api/products/enrich', {
    rawText: p.rawContent,
    title: decodeHtmlEntities(p.title || ''),
    rawSections: p.rawSections,
    productId,
    sourceUrl: url,
    sourceType: 'maruderm_eval_ingest',
  });

  if (typeof enrich?.enrichedText === 'string' && enrich.enrichedText) {
    await patchEnrichedText(productId, enrich.enrichedText);
  }

  const embed = await internalPost(`/api/products/${productId}/generate-embeddings`, {});

  return {
    url,
    productId,
    title: decodeHtmlEntities(p.title || ''),
    rawLen: p.rawContent.length,
    enrichmentMode: enrich?.enrichmentMode || null,
    factsExtracted: Boolean(enrich?.factsExtracted),
    chunksCreated: embed?.chunksCreated ?? null,
    totalTokens: embed?.totalTokens ?? null,
    status: 'ok',
  };
}

async function main() {
  const results = [];
  const ok = [];

  for (const url of DEFAULT_URLS) {
    try {
      const result = await processUrl(url);
      results.push(result);
      if (result.status === 'ok') {
        ok.push(result);
        console.log(`OK ${ok.length}/${DEFAULT_URLS.length}: ${result.title} (${result.productId}) chunks=${result.chunksCreated}`);
      } else {
        console.log(`SKIP: ${url} -> ${result.status}`);
      }
    } catch (error) {
      const failure = { url, status: 'error', error: error instanceof Error ? error.message : String(error) };
      results.push(failure);
      console.error(`FAIL: ${url}`, failure.error);
    }
  }

  const out = {
    merchantId: MERCHANT_ID,
    generatedAt: new Date().toISOString(),
    requestedCount: DEFAULT_URLS.length,
    selectedCount: ok.length,
    productIds: ok.map((x) => x.productId),
    selected: ok,
    results,
  };

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(out, null, 2));
  console.log(`Wrote ${OUTPUT}`);
  console.log(JSON.stringify({ selectedCount: ok.length, productIds: ok.map((x) => x.productId) }, null, 2));

  if (ok.length < DEFAULT_URLS.length) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
