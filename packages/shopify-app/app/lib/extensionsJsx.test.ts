import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The Shopify CLI bundles each extension with the nearest tsconfig.json. The
 * WhatsApp opt-in extension had none of its own, so its JSX was compiled with
 * this app's React settings: render() received React elements, Preact drew
 * nothing and threw nothing, and the block never appeared on a live Thank you
 * page (recete-18, recete-19). Every extension with JSX needs its own tsconfig
 * pointing JSX at Preact.
 */
const extensionsDir = path.resolve(import.meta.dirname, '../../extensions');
const extensions = fs
  .readdirSync(extensionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => {
    const src = path.join(extensionsDir, name, 'src');
    return fs.existsSync(src) && fs.readdirSync(src).some((file) => /\.(jsx|tsx)$/.test(file));
  });

describe('UI extensions compile JSX for Preact', () => {
  it('finds the extensions', () => {
    expect(extensions).toContain('whatsapp-optin');
  });

  it.each(extensions)('%s has its own tsconfig with jsxImportSource preact', (name) => {
    const tsconfigPath = path.join(extensionsDir, name, 'tsconfig.json');
    expect(fs.existsSync(tsconfigPath)).toBe(true);
    const { compilerOptions } = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    expect(compilerOptions.jsx).toBe('react-jsx');
    expect(compilerOptions.jsxImportSource).toBe('preact');
  });
});
