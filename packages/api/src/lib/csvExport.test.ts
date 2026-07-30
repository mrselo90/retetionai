import { describe, expect, it } from 'vitest';
import { buildCsv, toCsvCell } from './csvExport.js';

describe('toCsvCell', () => {
  it('quotes ordinary values', () => {
    expect(toCsvCell('Ahmet')).toBe('"Ahmet"');
  });

  it('keeps a comma inside the field instead of splitting it', () => {
    expect(toCsvCell('Yılmaz, Ahmet')).toBe('"Yılmaz, Ahmet"');
  });

  it('doubles embedded quotes', () => {
    expect(toCsvCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it('preserves non-ASCII characters as-is', () => {
    expect(toCsvCell('Şeyma Öztürk')).toBe('"Şeyma Öztürk"');
  });

  // Customer names come from Shopify, so they are attacker-influenced text going
  // into a file the merchant opens in a spreadsheet.
  it.each([
    ['=HYPERLINK("http://evil","Click")', '"\'=HYPERLINK(""http://evil"",""Click"")"'],
    ['+1+1', '"\'+1+1"'],
    ['-2+3', '"\'-2+3"'],
    ['@SUM(A1:A9)', '"\'@SUM(A1:A9)"'],
    ['\tcmd', '"\'\tcmd"'],
    ['\rcmd', '"\'\rcmd"'],
  ])('neutralises a formula starting with %j', (input, expected) => {
    expect(toCsvCell(input)).toBe(expected);
  });

  it('does not touch a value that merely contains those characters later on', () => {
    expect(toCsvCell('A=B')).toBe('"A=B"');
    expect(toCsvCell('user@example.com')).toBe('"user@example.com"');
  });

  it('handles an empty value', () => {
    expect(toCsvCell('')).toBe('""');
  });
});

describe('buildCsv', () => {
  it('starts with a UTF-8 BOM so Excel does not mangle Turkish names', () => {
    expect(buildCsv(['name'], [['Şeyma']]).charCodeAt(0)).toBe(0xfeff);
  });

  it('uses CRLF line endings and terminates the last row', () => {
    const csv = buildCsv(['a', 'b'], [['1', '2'], ['3', '4']]);
    expect(csv).toBe('﻿"a","b"\r\n"1","2"\r\n"3","4"\r\n');
  });

  it('emits a header-only document when there are no rows', () => {
    expect(buildCsv(['name', 'phone'], [])).toBe('﻿"name","phone"\r\n');
  });

  it('guards every cell, not just the first column', () => {
    const csv = buildCsv(['name', 'note'], [['ok', '=1+1']]);
    expect(csv).toContain('"ok","\'=1+1"');
  });
});
