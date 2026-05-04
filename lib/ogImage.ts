import * as cheerio from 'cheerio';
// @ts-expect-error - no types shipped with this package
import googleNewsUrlDecoder from 'google-news-url-decoder';

const { GoogleDecoder } = googleNewsUrlDecoder as { GoogleDecoder: new () => GoogleDecoderInstance };
type GoogleDecoderInstance = {
  decode(url: string): Promise<{ status: boolean; decoded_url?: string }>;
};
const gnDecoder = new GoogleDecoder();

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

/**
 * Google News RSS wraps each article URL in `news.google.com/rss/articles/...`
 * which redirects to a GDPR consent page when fetched server-side. This
 * decoder unwraps the embedded source URL so we can fetch the real article.
 */
export async function resolveUrl(url: string): Promise<string> {
  if (!url.includes('news.google.com')) return url;
  try {
    const result = await gnDecoder.decode(url);
    if (result.status && result.decoded_url) return result.decoded_url;
  } catch {
    // fall through
  }
  return url;
}

type OgMeta = { imageUrl?: string; description?: string };

/**
 * Fetch a URL and extract OG meta tags from the HTML.
 * Reads up to 250KB to catch tags that some publishers (Adweek)
 * emit deep in <head> after large amounts of analytics scripts.
 * Returns an empty object on any failure — never throws.
 */
export async function fetchOgMeta(url: string, timeoutMs = 8000): Promise<OgMeta> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return {};
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) return {};

    // Read up to 400KB — Adweek's og:image lives ~88KB in; body text may be deeper
    const html = (await res.text()).slice(0, 400_000);

    // --- Image (regex first, fast path) ---
    let imageUrl: string | undefined;
    const imageRegexes = [
      /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ];
    for (const re of imageRegexes) {
      const m = html.match(re);
      if (m && /^https?:\/\//i.test(m[1])) { imageUrl = m[1]; break; }
    }

    // --- Description (regex first) ---
    let description: string | undefined;
    const descRegexes = [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{20,}?)["']/i,
      /<meta[^>]+content=["']([^"']{20,}?)["'][^>]+property=["']og:description["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{20,}?)["']/i,
      /<meta[^>]+content=["']([^"']{20,}?)["'][^>]+name=["']description["']/i,
    ];
    for (const re of descRegexes) {
      const m = html.match(re);
      if (m?.[1]) { description = m[1].trim().slice(0, 600); break; }
    }

    // Cheerio for anything the regex missed + article body extraction
    if (!imageUrl || !description || description.length < 120) {
      const $ = cheerio.load(html);

      if (!imageUrl) {
        const imgCandidates = [
          $('meta[property="og:image:secure_url"]').attr('content'),
          $('meta[property="og:image"]').attr('content'),
          $('meta[name="twitter:image:src"]').attr('content'),
          $('meta[name="twitter:image"]').attr('content'),
          $('link[rel="image_src"]').attr('href'),
        ];
        for (const c of imgCandidates) {
          if (c && /^https?:\/\//i.test(c)) { imageUrl = c; break; }
        }
        // Final fallback: first large <img> inside article/main body
        if (!imageUrl) {
          const bodyImg = $('article img[src], main img[src], .post-content img[src], .article-body img[src]')
            .first().attr('src');
          if (bodyImg && /^https?:\/\//i.test(bodyImg)) imageUrl = bodyImg;
        }
      }

      if (!description || description.length < 120) {
        // Try meta tags first
        const metaDesc = description ??
          $('meta[property="og:description"]').attr('content') ??
          $('meta[name="description"]').attr('content');

        // Extract body paragraphs for a richer excerpt
        const bodyParas: string[] = [];
        const bodySelectors = ['article p', 'main p', '.post-content p', '.article-body p', '.entry-content p', '.story p'];
        for (const sel of bodySelectors) {
          $(sel).each((_, el) => {
            const text = $(el).text().replace(/\s+/g, ' ').trim();
            if (text.length > 60) bodyParas.push(text);
          });
          if (bodyParas.length >= 3) break;
        }

        if (bodyParas.length > 0) {
          // Combine up to ~600 chars of article text
          let excerpt = '';
          for (const p of bodyParas) {
            if (excerpt.length + p.length > 600) break;
            excerpt += (excerpt ? ' ' : '') + p;
          }
          // Prefer body text if it's longer/richer than the meta description
          if (excerpt.length > (metaDesc?.length ?? 0)) {
            description = excerpt.slice(0, 600);
          } else if (metaDesc && metaDesc.length >= 20) {
            description = metaDesc.trim().slice(0, 600);
          }
        } else if (metaDesc && metaDesc.length >= 20) {
          description = metaDesc.trim().slice(0, 600);
        }
      }
    }

    return { imageUrl, description };
  } catch {
    return {};
  }
}

/** @deprecated use fetchOgMeta */
export async function fetchOgImage(url: string, timeoutMs = 8000): Promise<string | undefined> {
  return (await fetchOgMeta(url, timeoutMs)).imageUrl;
}

/**
 * Verify an image URL is actually reachable and returns an image.
 * Uses a HEAD request to avoid downloading the full image.
 * Returns false if the URL is unreachable, returns a non-2xx status,
 * or doesn't serve an image content-type.
 */
export async function isImageReachable(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') ?? '';
    return ct.startsWith('image/');
  } catch {
    return false;
  }
}

/**
 * Returns true when a description string is too short or low-quality to show.
 * Catches echoed titles like "A Life of Yes Ads of the World".
 */
function isWeakDescription(desc: string, title: string): boolean {
  const d = desc.trim();
  if (d.length < 30) return true;
  // Strip punctuation/spaces and compare normalised strings
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  // If the description is essentially the title (possibly with source name appended), discard it
  if (norm(d).startsWith(norm(title).slice(0, 20))) return true;
  return false;
}

/**
 * Concurrency-limited enrichment — for each item:
 * - Resolves Google News URLs to the real source URL (and updates `url`)
 * - Fetches og:image for items missing one
 * - Fetches og:description when the RSS description is missing or low-quality
 */
export async function enrichWithOgImages<T extends { url: string; imageUrl?: string; description?: string; title?: string }>(
  items: T[],
  concurrency = 6
): Promise<T[]> {
  const queue = items.map((item, i) => ({ item, index: i }));
  const out: T[] = new Array(items.length);

  async function worker() {
    while (queue.length) {
      const next = queue.shift();
      if (!next) break;
      const { item, index } = next;

      // Always resolve URL (Google News → real source)
      const resolvedUrl = await resolveUrl(item.url);
      let updatedItem = resolvedUrl !== item.url ? { ...item, url: resolvedUrl } : item;

      const needsImage = !updatedItem.imageUrl;
      const needsDesc = !updatedItem.description ||
        isWeakDescription(updatedItem.description, updatedItem.title ?? '');

      if (needsImage || needsDesc) {
        const meta = await fetchOgMeta(resolvedUrl);
        if (needsImage && meta.imageUrl) updatedItem = { ...updatedItem, imageUrl: meta.imageUrl };
        if (needsDesc && meta.description) updatedItem = { ...updatedItem, description: meta.description };
      }

      // Verify the image is actually reachable — broken URLs (403, 404, redirects
      // to HTML pages, etc.) are nullified so the article gets dropped downstream.
      if (updatedItem.imageUrl) {
        const ok = await isImageReachable(updatedItem.imageUrl);
        if (!ok) updatedItem = { ...updatedItem, imageUrl: undefined };
      }

      out[index] = updatedItem;
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return out;
}
