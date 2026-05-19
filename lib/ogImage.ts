import * as cheerio from 'cheerio';
// @ts-expect-error - no types shipped with this package
import googleNewsUrlDecoder from 'google-news-url-decoder';
import { decodeHtmlEntities } from './textUtils';

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

type VideoType = 'youtube' | 'vimeo' | 'video';
type OgMeta = {
  imageUrl?: string;
  description?: string;
  videoUrl?: string;
  videoType?: VideoType;
};

/** Normalise protocol-relative + http URLs */
function normalizeMediaUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://')) return url.replace(/^http:/, 'https:');
  return url;
}

/**
 * Look for embeddable video signals in HTML — iframes, og:video, twitter:player.
 * Returns the first match in priority order.
 */
function extractVideo(html: string): { url: string; type: VideoType } | null {
  // 1. YouTube iframe (most common embed format)
  const ytIframe = html.match(
    /<iframe[^>]+src=["']([^"']*(?:youtube\.com\/embed|youtube-nocookie\.com\/embed)\/[A-Za-z0-9_-]+[^"']*)["']/i
  );
  if (ytIframe) return { url: normalizeMediaUrl(ytIframe[1]), type: 'youtube' };

  // 2. Vimeo iframe
  const vmIframe = html.match(
    /<iframe[^>]+src=["']([^"']*player\.vimeo\.com\/video\/\d+[^"']*)["']/i
  );
  if (vmIframe) return { url: normalizeMediaUrl(vmIframe[1]), type: 'vimeo' };

  // 3. og:video / og:video:url / og:video:secure_url (often direct mp4)
  const ogVideo = html.match(
    /<meta[^>]+property=["']og:video(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i
  );
  if (ogVideo) {
    const u = normalizeMediaUrl(ogVideo[1]);
    if (/youtube\.com|youtu\.be/.test(u)) {
      const id = u.match(/(?:v=|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      if (id) return { url: `https://www.youtube.com/embed/${id[1]}`, type: 'youtube' };
    }
    if (/vimeo\.com/.test(u)) {
      const id = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (id) return { url: `https://player.vimeo.com/video/${id[1]}`, type: 'vimeo' };
    }
    if (/\.mp4($|\?)/i.test(u)) return { url: u, type: 'video' };
  }

  // 4. twitter:player (often a player URL)
  const twPlayer = html.match(
    /<meta[^>]+name=["']twitter:player["'][^>]+content=["']([^"']+)["']/i
  );
  if (twPlayer) {
    const u = normalizeMediaUrl(twPlayer[1]);
    if (/youtube\.com|youtu\.be/.test(u)) {
      const id = u.match(/(?:v=|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      if (id) return { url: `https://www.youtube.com/embed/${id[1]}`, type: 'youtube' };
    }
    if (/player\.vimeo\.com/.test(u)) return { url: u, type: 'vimeo' };
  }

  return null;
}

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
      if (m?.[1]) { description = decodeHtmlEntities(m[1].trim()).slice(0, 2000); break; }
    }

    // --- Video (iframes, og:video, twitter:player) ---
    const video = extractVideo(html);

    // Cheerio for anything the regex missed + article body extraction
    // Always run if description is short (< 200 chars) so we get richer excerpts
    if (!imageUrl || !description || description.length < 200) {
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

      if (!description || description.length < 200) {
        const rawMetaDesc = description ??
          $('meta[property="og:description"]').attr('content') ??
          $('meta[name="description"]').attr('content');
        const metaDesc = rawMetaDesc ? decodeHtmlEntities(rawMetaDesc) : undefined;

        // Extract body paragraphs for a richer multi-paragraph excerpt.
        // cheerio's .text() decodes one level of entities, but some publishers
        // serve double-encoded HTML — decode again to be safe.
        const bodyParas: string[] = [];
        const bodySelectors = ['article p', 'main p', '.post-content p', '.article-body p', '.entry-content p', '.story p'];
        for (const sel of bodySelectors) {
          $(sel).each((_, el) => {
            const text = decodeHtmlEntities($(el).text()).replace(/\s+/g, ' ').trim();
            if (text.length > 60) bodyParas.push(text);
          });
          if (bodyParas.length >= 6) break;
        }

        if (bodyParas.length > 0) {
          // Join with double-newline to preserve paragraph structure
          let excerpt = '';
          for (const p of bodyParas) {
            const sep = excerpt ? '\n\n' : '';
            if (excerpt.length + sep.length + p.length > 2000) break;
            excerpt += sep + p;
          }
          // Prefer body excerpt when it's substantially richer than meta desc
          if (excerpt.length > (metaDesc?.length ?? 0)) {
            description = excerpt.slice(0, 2000);
          } else if (metaDesc && metaDesc.length >= 20) {
            description = metaDesc.trim().slice(0, 2000);
          }
        } else if (metaDesc && metaDesc.length >= 20) {
          description = metaDesc.trim().slice(0, 2000);
        }
      }
    }

    return {
      imageUrl,
      description,
      videoUrl: video?.url,
      videoType: video?.type,
    };
  } catch {
    return {};
  }
}

/** @deprecated use fetchOgMeta */
export async function fetchOgImage(url: string, timeoutMs = 8000): Promise<string | undefined> {
  return (await fetchOgMeta(url, timeoutMs)).imageUrl;
}

/**
 * Try to upgrade a WordPress-style thumbnail URL to its full-size original.
 * WordPress generates variants like `image-140x91.png` from an original
 * `image.png` — stripping the size suffix usually gets the full version.
 * Returns null if the URL doesn't match the pattern.
 */
function upgradeImageQuality(url: string): string | null {
  const upgraded = url.replace(/-\d+x\d+(\.[a-zA-Z]+)(\?.*)?$/i, '$1$2');
  return upgraded !== url ? upgraded : null;
}

/**
 * Pick the first image URL in `candidates` that resolves to a real image.
 * Used to prefer a high-quality variant but gracefully fall back if it 404s.
 */
async function pickReachableImage(candidates: string[]): Promise<string | undefined> {
  for (const url of candidates) {
    if (await isImageReachable(url)) return url;
  }
  return undefined;
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
 * - Extracts embeddable video URLs (YouTube/Vimeo iframes, og:video)
 */
export async function enrichWithOgImages<
  T extends {
    url: string;
    imageUrl?: string;
    description?: string;
    title?: string;
    videoUrl?: string;
    videoType?: VideoType;
  }
>(items: T[], concurrency = 6): Promise<T[]> {
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
        isWeakDescription(updatedItem.description, updatedItem.title ?? '') ||
        updatedItem.description.length < 200;
      const needsVideo = !updatedItem.videoUrl;

      if (needsImage || needsDesc || needsVideo) {
        const meta = await fetchOgMeta(resolvedUrl);
        if (needsImage && meta.imageUrl) updatedItem = { ...updatedItem, imageUrl: meta.imageUrl };
        if (needsDesc && meta.description) updatedItem = { ...updatedItem, description: meta.description };
        if (needsVideo && meta.videoUrl) {
          updatedItem = { ...updatedItem, videoUrl: meta.videoUrl, videoType: meta.videoType };
        }
      }

      // Try to upgrade WordPress thumbnails (e.g. image-140x91.png → image.png)
      // then verify reachability. If the upgraded URL works, use it; otherwise
      // fall back to the original; if neither responds, drop the image.
      if (updatedItem.imageUrl) {
        const candidates = [
          upgradeImageQuality(updatedItem.imageUrl),
          updatedItem.imageUrl,
        ].filter((x): x is string => !!x);

        const winner = await pickReachableImage(candidates);
        updatedItem = { ...updatedItem, imageUrl: winner };
      }

      out[index] = updatedItem;
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return out;
}
