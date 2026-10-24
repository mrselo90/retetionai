/**
 * Replies go out as WhatsApp text, which has its own formatting (*bold*,
 * _italic_) and no Markdown: the model's "**Sabah:**" and
 * "[takip linki](https://...)" reached customers as raw characters, and a link
 * hidden behind a label was not clickable.
 */
export function toWhatsAppText(text: string): string {
  return text
    // [label](url): WhatsApp links only bare URLs.
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label: string, url: string) => {
      const plainLabel = label.trim();
      return plainLabel === url || /^https?:\/\//.test(plainLabel) ? url : `${plainLabel}: ${url}`;
    })
    // Headings become bold lines.
    .replace(/^#{1,6}[ \t]+(.+?)[ \t]*#*$/gm, '*$1*')
    // **bold** / __bold__ -> *bold*
    .replace(/\*\*(?=\S)([^*\n]+?)\*\*/g, '*$1*')
    .replace(/__(?=\S)([^_\n]+?)__/g, '*$1*');
}
