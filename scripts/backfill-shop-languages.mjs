#!/usr/bin/env node
/**
 * Re-detect each shop's source language from its actual product content and
 * backfill shop_settings.
 *
 * Why: shop_settings.default_source_lang was 'en' for every shop in production
 * while the product content is Turkish/Hungarian, and enabled_langs was left at
 * ['en'] for many of them. The effect at runtime is that primaryLanguage
 * resolves to 'en', so a Turkish customer's message is LLM-translated into
 * English, retrieval hits the English partition, and the reply comes back in
 * English behind an "unsupported language" notice.
 *
 * Detection uses the application's own detectLanguage() from the built dist, so
 * the result matches what the runtime would decide — no second implementation to
 * drift.
 *
 * Two deliberate safety properties:
 *   1. enabled_langs is only ever ADDED to, never shrunk. A shop already set up
 *      for ["en","tr","hu"] keeps all three.
 *   2. Majority vote across products rather than one concatenated blob.
 *      detectLanguage returns on first match in order el -> hu -> tr -> de -> en,
 *      so a single stray character in one product would otherwise decide the
 *      whole shop.
 *
 * Dry run by default. Pass --apply to write.
 *
 *   node scripts/backfill-shop-languages.mjs            # preview
 *   node scripts/backfill-shop-languages.mjs --apply    # write
 */

import { detectLanguage } from '../packages/api/dist/lib/i18n.js';

const APPLY = process.argv.includes('--apply');
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function rest(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method || 'GET'} ${path} -> ${response.status} ${text.slice(0, 200)}`);
  }
  return text ? JSON.parse(text) : null;
}

/** Longest text we bother feeding the detector per product. */
const SAMPLE_CHARS = 4000;

function detectShopLanguage(products) {
  const votes = new Map();
  const perProduct = [];

  for (const product of products) {
    const sample = [product.name, product.enriched_text, product.raw_text]
      .filter((value) => typeof value === 'string' && value.trim())
      .join('\n')
      .slice(0, SAMPLE_CHARS);
    if (!sample.trim()) continue;

    const detected = detectLanguage(sample);
    votes.set(detected, (votes.get(detected) || 0) + 1);
    perProduct.push(detected);
  }

  if (votes.size === 0) return { winner: null, votes: {}, sampled: 0 };

  // Highest count wins; 'en' loses ties because it is also the detector's
  // fallback for text it simply could not classify.
  const ranked = [...votes.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    if (a[0] === 'en') return 1;
    if (b[0] === 'en') return -1;
    return a[0].localeCompare(b[0]);
  });

  return { winner: ranked[0][0], votes: Object.fromEntries(votes), sampled: perProduct.length };
}

function normalizeEnabled(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean))];
}

const settings = await rest('shop_settings?select=shop_id,default_source_lang,enabled_langs');
console.log(`shop_settings rows: ${settings.length}\n`);

const plans = [];

for (const row of settings) {
  const products = await rest(
    `products?select=name,raw_text,enriched_text&merchant_id=eq.${row.shop_id}&limit=25`,
  );
  const { winner, votes, sampled } = detectShopLanguage(products);
  const currentEnabled = normalizeEnabled(row.enabled_langs);
  const currentDefault = String(row.default_source_lang || '').toLowerCase();

  if (!winner) {
    plans.push({ shopId: row.shop_id, skip: 'no product text to detect from', sampled, currentEnabled, currentDefault });
    continue;
  }

  // Additive only: never remove a language a merchant already serves.
  const nextEnabled = [...new Set([winner, ...currentEnabled, 'en'])];
  const enabledChanged = nextEnabled.length !== currentEnabled.length;
  const defaultChanged = winner !== currentDefault;

  plans.push({
    shopId: row.shop_id,
    detected: winner,
    votes,
    sampled,
    currentDefault,
    currentEnabled,
    nextEnabled,
    enabledChanged,
    defaultChanged,
    changed: enabledChanged || defaultChanged,
  });
}

console.log('shop_id                              detected  sampled  default            enabled_langs');
console.log('-'.repeat(110));
for (const plan of plans) {
  if (plan.skip) {
    console.log(`${plan.shopId}  ${'-'.padEnd(8)}  ${String(plan.sampled).padEnd(7)}  SKIP: ${plan.skip}`);
    continue;
  }
  const defaultCell = plan.defaultChanged ? `${plan.currentDefault} -> ${plan.detected}` : plan.currentDefault;
  const enabledCell = plan.enabledChanged
    ? `[${plan.currentEnabled}] -> [${plan.nextEnabled}]`
    : `[${plan.currentEnabled}]`;
  console.log(
    `${plan.shopId}  ${plan.detected.padEnd(8)}  ${String(plan.sampled).padEnd(7)}  ${defaultCell.padEnd(17)}  ${enabledCell}${plan.changed ? '   <= CHANGE' : ''}`,
  );
}

const toChange = plans.filter((plan) => plan.changed);
const addsLanguage = plans.filter((plan) => plan.enabledChanged);
console.log(`\nrows needing change: ${toChange.length} / ${plans.length}`);
console.log(`rows gaining a reply language: ${addsLanguage.length}`);
console.log(
  'note: each added language schedules translation + re-indexing work for that shop on next product sync.',
);

if (!APPLY) {
  console.log('\nDRY RUN — nothing written. Re-run with --apply to write.');
  process.exit(0);
}

let updated = 0;
for (const plan of toChange) {
  await rest(`shop_settings?shop_id=eq.${plan.shopId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      default_source_lang: plan.detected,
      enabled_langs: plan.nextEnabled,
      updated_at: new Date().toISOString(),
    }),
  });
  updated += 1;
  console.log(`updated ${plan.shopId} -> default=${plan.detected} enabled=[${plan.nextEnabled}]`);
}

console.log(`\napplied to ${updated} row(s).`);
