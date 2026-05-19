/**
 * Decode HTML entities to their displayable characters. Handles nested
 * encoding (e.g. `&amp;amp;amp;` → `&`) by looping until the result is stable.
 *
 * Why this is needed: RSS feeds carry HTML-encoded content (since RSS is
 * XML). Some publishers re-encode that content again when serving it (or
 * Google News does). Without explicit decoding, the user sees `Tesco&#39;s`
 * instead of `Tesco's` and `F&amp;amp;F` instead of `F&F`.
 *
 * Order matters: `&amp;` must be decoded LAST in each pass so that
 * `&amp;lt;` becomes `&lt;` then `<` across passes — not collapsed to `<`
 * in a single pass.
 */
export function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  let result = input;
  // Cap iterations to avoid pathological inputs causing infinite loops
  for (let i = 0; i < 5; i++) {
    const before = result;
    result = result
      .replace(/&#(\d+);/g, (_, code) => {
        const n = Number(code);
        return n > 0 && n < 0x110000 ? String.fromCharCode(n) : '';
      })
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
        const n = parseInt(code, 16);
        return n > 0 && n < 0x110000 ? String.fromCharCode(n) : '';
      })
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&hellip;/g, '…')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&rsquo;/g, '’')
      .replace(/&lsquo;/g, '‘')
      .replace(/&rdquo;/g, '”')
      .replace(/&ldquo;/g, '“')
      .replace(/&bull;/g, '•')
      .replace(/&middot;/g, '·')
      .replace(/&copy;/g, '©')
      .replace(/&reg;/g, '®')
      .replace(/&trade;/g, '™')
      // Decode &amp; last so we don't accidentally re-decode entities above
      .replace(/&amp;/g, '&');
    if (before === result) break;
  }
  return result;
}
