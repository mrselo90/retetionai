/**
 * CSV serialisation for merchant-facing exports.
 *
 * Separate from csvParser.ts, which reads merchant uploads — this writes files
 * that Excel and Google Sheets will open, which is a different threat model.
 */

/**
 * Quote one CSV cell.
 *
 * Cell values here include customer names, which arrive from Shopify and are
 * therefore untrusted text. Excel and Sheets treat a leading `=`, `+`, `-`, `@`,
 * tab or CR as the start of a formula, so a customer named
 * `=HYPERLINK("http://evil","Click")` becomes a live link in whatever the
 * merchant opens the file with. Prefixing with an apostrophe forces the cell to
 * literal text; spreadsheet apps do not display the apostrophe.
 *
 * Every cell is quoted rather than only the ones that need it: it costs a few
 * bytes and removes a whole class of "this one field had a comma in it" bug.
 */
export function toCsvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/**
 * Build a complete CSV document.
 *
 * CRLF line endings and a leading BOM, both for Excel: without the BOM it reads
 * the file as the system codepage and Turkish characters in customer names arrive
 * mangled.
 */
export function buildCsv(header: string[], rows: string[][]): string {
  const lines = [header, ...rows].map((row) => row.map(toCsvCell).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}
