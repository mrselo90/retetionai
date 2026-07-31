#!/usr/bin/env node
/**
 * Cross-checks every path the Shopify shell calls via internalMerchantRequest()
 * (packages/shopify-app/app/platform.server.ts) against the internal-secret
 * allowlists in packages/api/src/middleware/auth.ts.
 *
 * Why this exists: a path missing from those allowlists doesn't fail loudly.
 * authMiddleware falls through to a generic 401/403 that looks identical to a
 * dozen unrelated auth problems, so the miss only surfaces when someone
 * actually clicks the feature in production. This bug happened four separate
 * times before this script existed (see git log for auth.ts) - each one an
 * accidental allowlist-vs-caller drift between two files in two different
 * packages that nothing else keeps in sync.
 *
 * Run: node scripts/check-internal-auth-paths.mjs
 * Wired into .lintstagedrc.json so it runs automatically whenever either
 * source file is part of a commit.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const AUTH_FILE = path.join(repoRoot, 'packages/api/src/middleware/auth.ts');
const PLATFORM_FILE = path.join(repoRoot, 'packages/shopify-app/app/platform.server.ts');

const ARRAY_NAMES = ['INTERNAL_PRODUCT_PATHS', 'INTERNAL_WHATSAPP_PATHS', 'INTERNAL_MERCHANT_PATHS'];

/** Pulls the literal entries out of `const NAME: Array<string | RegExp> = [ ... ];` */
function extractArray(source, name) {
  const marker = `const ${name}:`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Could not find "${marker}" in ${AUTH_FILE} — has it been renamed?`);
  }
  const openBracket = source.indexOf('[', start);
  const closeBracket = source.indexOf('];', openBracket);
  if (openBracket === -1 || closeBracket === -1) {
    throw new Error(`Could not find the array body for ${name} in ${AUTH_FILE}`);
  }
  const body = source.slice(openBracket + 1, closeBracket);

  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'))
    .map((line) => line.replace(/,\s*$/, ''))
    // eslint-disable-next-line no-new-func -- evaluating our own source's literal entries, not user input
    .map((line) => new Function(`return (${line});`)());
}

function isPathAllowed(samplePath, allowlist) {
  return allowlist.some((entry) => (typeof entry === 'string' ? entry === samplePath : entry.test(samplePath)));
}

/** Finds the nearest `export async function NAME` above `index`, for a readable error. */
function nearestExportedFunction(source, index) {
  const before = source.slice(0, index);
  const matches = [...before.matchAll(/export\s+async\s+function\s+(\w+)/g)];
  return matches.length ? matches[matches.length - 1][1] : '(unknown function)';
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function main() {
  const authSource = readFileSync(AUTH_FILE, 'utf-8');
  const platformSource = readFileSync(PLATFORM_FILE, 'utf-8');

  const allowlist = ARRAY_NAMES.flatMap((name) => extractArray(authSource, name));

  // Path argument is always the 2nd positional arg, always a plain string or
  // template literal (never a computed expression) in this codebase.
  const callPattern = /internalMerchantRequest\(\s*request\s*,\s*('(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;

  const failures = [];
  let match;
  while ((match = callPattern.exec(platformSource))) {
    const rawLiteral = match[1];
    const inner = rawLiteral.slice(1, -1);
    // Replace `${...}` interpolations with a concrete dummy segment, then drop
    // any query string — c.req.path on the server never includes it either.
    const samplePath = inner.replace(/\$\{[^}]*\}/g, 'x').split('?')[0];

    if (!isPathAllowed(samplePath, allowlist)) {
      failures.push({
        samplePath,
        rawLiteral,
        fn: nearestExportedFunction(platformSource, match.index),
        line: lineNumberAt(platformSource, match.index),
      });
    }
  }

  if (failures.length > 0) {
    console.error('\n✖ internalMerchantRequest() call(s) target a path missing from every allowlist in auth.ts:\n');
    for (const f of failures) {
      console.error(`  platform.server.ts:${f.line}  in ${f.fn}()`);
      console.error(`    called with: ${f.rawLiteral}`);
      console.error(`    resolves to: ${f.samplePath}`);
      console.error(
        `    This will 401/403 in production. Add a matching entry to INTERNAL_PRODUCT_PATHS,\n    INTERNAL_WHATSAPP_PATHS, or INTERNAL_MERCHANT_PATHS in packages/api/src/middleware/auth.ts.\n`
      );
    }
    process.exit(1);
  }

  console.log(`✓ All internalMerchantRequest() call sites are covered by an allowlist entry (${allowlist.length} entries checked).`);
}

main();
