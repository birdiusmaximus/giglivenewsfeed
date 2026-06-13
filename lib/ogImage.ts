import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { decodeHtmlEntities } from './textUtils';

/**
 * Maximum article description length. ~1,500 words of reading.
 */
const MAX_DESCRIPTION_LENGTH = 8000;

/**
 * Use Mozilla Readability (the same engine behind Firefox's Reader View) to
 * extract the article body from full HTML. Falls back to undefined if the
 * page isn't article-shaped or Readability fails.
 *
 * Returns paragraphs joined with `\n\n` so they render cleanly in the
 * preview pane via the existing whitespace-pre-line + paragraph splitting.
 */
function extractWithReadability(html: string, url: string): string | undefined {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document, {
      // Accept shorter articles too — default 500 is too aggressive for some sources
      charThreshold: 100,
    });
    const article = reader.parse();
    if (!article?.content) return undefined;

    // Walk the cleaned article HTML and pull paragraphs + list items.
    // We use cheerio rather than jsdom here because we already have it loaded
    // and the article HTML at this point is well-formed.
    const $$ = cheerio.load(article.content);
    const paragraphs: string[] = [];
    $$('p, li, blockquote, h2, h3, h4').each((_, el) => {
      const tag = (el as { name?: string }).name;
      const raw = $$(el).text();
      const text = decodeHtmlEntities(raw).replace(/\s+/g, ' ').trim();
      if (text.length < 30) return;
      // Headings get prepended with a visual marker via Markdown-ish '## '
      // (rendered as plain text since description is plain text)
      if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
        paragraphs.push(text);
      } else {
        paragraphs.push(text);
      }
    });

    if (paragraphs.length === 0) return undefined;

    // Join with double-newline up to the length cap
    let excerpt = '';
    for (const p of paragraphs) {
      const sep = excerpt ? '\n\n' : '';
      if (excerpt.length + sep.length + p.length > MAX_DESCRIPTION_LENGTH) break;
      excerpt += sep + p;
    }
    return excerpt.length >= 200 ? excerpt : undefined;
  } catch {
    return undefined;
  }
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

/**
 * Try to extract the source URL embedded inside the Google News article URL
 * itself. The path segment after `articles/` is a base64-encoded protobuf
 * blob; the source URL appears as UTF-8 text inside it. We scan the decoded
 * bytes for the first https:// URL that isn't a Google domain.
 */
function decodeGoogleNewsUrl(url: string): string | null {
  try {
    const match = url.match(/news\.google\.com\/(?:rss\/)?articles\/([\w-]+)/);
    if (!match) return null;
    const segment = match[1];
    // base64url -> bytes -> binary string scan
    const decoded = Buffer.from(segment, 'base64url').toString('binary');
    const urlPattern = /(https?:\/\/[A-Za-z0-9._~:\/?#\[\]@!$&'()*+,;=%-]{8,})/g;
    let m: RegExpExecArray | null;
    while ((m = urlPattern.exec(decoded)) !== null) {
      const candidate = m[1];
      if (
        !candidate.includes('google.com') &&
        !candidate.includes('googleapis.com') &&
        !candidate.includes('gstatic.com')
      ) {
        // Trim any trailing junk bytes that snuck through the regex
        return candidate.replace(/[^\x20-\x7e]+.*$/, '');
      }
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * Lazy-loaded handle to the upstream decoder package. Use a dynamic import
 * inside a try/catch so any module-init crash (e.g. the @exodus/bytes ESM
 * issue we hit before) gets caught and we fall through to next strategy
 * instead of taking down the request.
 */
let gnDecoderPromise: Promise<{ decode: (u: string) => Promise<{ status: boolean; decoded_url?: string }> } | null> | null = null;
function loadGnDecoder() {
  if (gnDecoderPromise) return gnDecoderPromise;
  gnDecoderPromise = (async () => {
    try {
      // @ts-expect-error - no types
      const mod = await import('google-news-url-decoder');
      const Cls = (mod as { GoogleDecoder?: new () => unknown }).GoogleDecoder ??
        (mod as { default?: { GoogleDecoder?: new () => unknown } }).default?.GoogleDecoder;
      if (!Cls) return null;
      return new (Cls as new () => { decode: (u: string) => Promise<{ status: boolean; decoded_url?: string }> })();
    } catch {
      return null;
    }
  })();
  return gnDecoderPromise;
}

/**
 * Google News RSS wraps each article URL in `news.google.com/rss/articles/...`.
 * Resolution strategy (cheapest first):
 *   1. base64-decode the URL segment locally — no network, instant.
 *   2. google-news-url-decoder package — handles formats our base64 path
 *      can't, but is dynamically imported in case it crashes on this runtime.
 *   3. Follow HTTP redirects — some URLs 302 to the publisher.
 *   4. Parse the landing-page HTML for embedded-redirect patterns.
 *   5. Give up and return the original — article still opens, no rich
 *      enrichment.
 */
export async function resolveUrl(url: string): Promise<string> {
  if (!url.includes('news.google.com')) return url;

  // 1. Direct base64 decode of the URL
  const decoded = decodeGoogleNewsUrl(url);
  if (decoded) return decoded;

  // 2. Try the upstream decoder package — guarded so a load failure
  //    doesn't crash the request.
  try {
    const dec = await loadGnDecoder();
    if (dec) {
      const result = await dec.decode(url);
      if (result.status && result.decoded_url) return result.decoded_url;
    }
  } catch {
    // decoder crashed mid-call — fall through
  }

  // 2. + 3. HTTP fetch / landing-page parse
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.url && !res.url.includes('news.google.com')) {
      return res.url;
    }

    const html = (await res.text()).slice(0, 80_000);
    const patterns = [
      /data-n-au="([^"]+)"/,
      /<a[^>]+jslog="[^"]*"[^>]+href="(https?:\/\/[^"]+)"/,
      /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["']\d+;\s*url=([^"']+)["']/i,
      /window\.location(?:\.replace)?\s*=\s*["'](https?:\/\/[^"']+)["']/,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1] && !m[1].includes('news.google.com')) {
        return m[1];
      }
    }
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
      if (m?.[1]) { description = decodeHtmlEntities(m[1].trim()).slice(0, MAX_DESCRIPTION_LENGTH); break; }
    }

    // --- Video (iframes, og:video, twitter:player) ---
    const video = extractVideo(html);

    // --- Article body via Mozilla Readability (primary) ---
    // Run whenever we'd otherwise have a short description. Readability
    // handles ~95% of publishers cleanly and gives us full-text paragraphs.
    if (!description || description.length < 600) {
      const readable = extractWithReadability(html, url);
      if (readable && readable.length > (description?.length ?? 0)) {
        description = readable;
      }
    }

    // --- Cheerio for anything the regex/Readability missed ---
    // Used for image fallbacks and as a secondary description path when
    // Readability didn't return anything.
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

        // Selector-based body extraction (last-resort fallback when
        // Readability gave up — handles pages it doesn't recognise as
        // article-shaped).
        const bodyParas: string[] = [];
        const bodySelectors = [
          'article p', 'main p',
          '.post-content p', '.article-body p', '.entry-content p',
          '.story p', '.c-article__body p', '[data-component="body"] p',
          '.text-block p', '.story-body p', '.article__body p',
        ];
        for (const sel of bodySelectors) {
          $(sel).each((_, el) => {
            const text = decodeHtmlEntities($(el).text()).replace(/\s+/g, ' ').trim();
            if (text.length > 60) bodyParas.push(text);
          });
          if (bodyParas.length >= 12) break;
        }

        if (bodyParas.length > 0) {
          let excerpt = '';
          for (const p of bodyParas) {
            const sep = excerpt ? '\n\n' : '';
            if (excerpt.length + sep.length + p.length > MAX_DESCRIPTION_LENGTH) break;
            excerpt += sep + p;
          }
          if (excerpt.length > (description?.length ?? 0)) {
            description = excerpt.slice(0, MAX_DESCRIPTION_LENGTH);
          } else if (metaDesc && metaDesc.length >= 20 && !description) {
            description = metaDesc.trim().slice(0, MAX_DESCRIPTION_LENGTH);
          }
        } else if (metaDesc && metaDesc.length >= 20 && !description) {
          description = metaDesc.trim().slice(0, MAX_DESCRIPTION_LENGTH);
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
 * Derive a thumbnail URL from a YouTube embed URL. hqdefault.jpg is always
 * generated by YouTube for valid videos (480x360), so no reachability check
 * needed.
 */
function youtubeThumbnail(embedUrl: string): string | undefined {
  const m = embedUrl.match(/\/embed\/([A-Za-z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : undefined;
}

/**
 * Fetch a Vimeo video's thumbnail URL via oEmbed. Vimeo doesn't expose
 * predictable thumbnail URLs, so this requires a small HTTP round-trip.
 */
async function vimeoThumbnail(embedUrl: string): Promise<string | undefined> {
  const m = embedUrl.match(/\/video\/(\d+)/);
  if (!m) return undefined;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${m[1]}`)}`,
      { signal: controller.signal }
    );
    clearTimeout(t);
    if (!res.ok) return undefined;
    const data = (await res.json()) as { thumbnail_url?: string };
    return typeof data.thumbnail_url === 'string' ? data.thumbnail_url : undefined;
  } catch {
    return undefined;
  }
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
        updatedItem.description.length < 1500;
      const needsVideo = !updatedItem.videoUrl;

      if (needsImage || needsDesc || needsVideo) {
        const meta = await fetchOgMeta(resolvedUrl);
        if (needsImage && meta.imageUrl) updatedItem = { ...updatedItem, imageUrl: meta.imageUrl };
        // Prefer the longer/richer description from either source
        if (meta.description && meta.description.length > (updatedItem.description?.length ?? 0)) {
          updatedItem = { ...updatedItem, description: meta.description };
        }
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

      // If we still have no image but DO have a video, derive a thumbnail
      // from the video URL. Otherwise the list view shows an ugly source-
      // initials placeholder for Ads of the World, Motionographer, etc.,
      // whose og:image is a site-wide template that our generic-image
      // filter (correctly) strips.
      if (!updatedItem.imageUrl && updatedItem.videoUrl) {
        let videoThumb: string | undefined;
        if (updatedItem.videoType === 'youtube') {
          videoThumb = youtubeThumbnail(updatedItem.videoUrl);
        } else if (updatedItem.videoType === 'vimeo') {
          videoThumb = await vimeoThumbnail(updatedItem.videoUrl);
        }
        if (videoThumb) {
          updatedItem = { ...updatedItem, imageUrl: videoThumb };
        }
      }

      out[index] = updatedItem;
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return out;
}
