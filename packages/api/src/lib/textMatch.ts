/**
 * Word matching that knows about non-ASCII letters.
 *
 * JavaScript's \b counts only [A-Za-z0-9_] as word characters, so with
 * Hungarian, Turkish, German or Greek words it misfires both ways: in
 * "terhesség alatt" the é counts as a boundary and "g " matched as grams (a
 * pregnancy question got the product's volume), and a word starting with é, ö,
 * ü or any Greek letter never matched at all.
 *
 * `alternatives` is a regex source of whole words ("ml|oz"); to match a stem
 * and what follows, write it out ("összetev\\p{L}*").
 */
export function wordRegex(alternatives: string, flags = 'i'): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives})(?![\\p{L}\\p{N}_])`, `${flags.replace('u', '')}u`);
}
