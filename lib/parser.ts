import Parser from 'rss-parser';
import { createHash } from 'crypto';
import type { Article } from './types';
import { FEEDS, type FeedSource } from './feeds';
import { detectCategory } from './categories';
import { isCurrentWeek, isInWeek } from './weekUtils';
import { decodeHtmlEntities } from './textUtils';
import { enrichWithOgImages } from './ogImage';

type RSSItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  content?: string;
  'content:encoded'?: string;
  categories?: string[];
  enclosure?: { url?: string; type?: string };
  'media:content'?: { $?: { url?: string } };
  'media:thumbnail'?: { $?: { url?: string } };
};

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

const parser = new Parser<Record<string, unknown>, RSSItem>({
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
    ],
  },
  timeout: 12000,
  headers: {
    'User-Agent': UA,
    Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*;q=0.5',
  },
});

const PAYWALL_PHRASES = [
  'subscriber', 'subscribers only', 'members only', 'premium content',
  'sign in to read', 'subscribe to read', 'subscribe to access',
  'cr subscribers', 'cr members', 'exclusive to members', 'paywall',
  'adweek pro', 'pro exclusive',
];

function isPaywalled(item: RSSItem, feedPaywallPhrases: string[]): boolean {
  const allPhrases = [...PAYWALL_PHRASES, ...feedPaywallPhrases];
  const text = [
    item.title ?? '',
    item.contentSnippet ?? '',
    item.content ?? '',
    item['content:encoded'] ?? '',
    (item.categories ?? []).join(' '),
  ].join(' ').toLowerCase();
  return allPhrases.some((p) => text.includes(p.toLowerCase()));
}

function extractImage(item: RSSItem): string | undefined {
  if (item.enclosure?.url && (!item.enclosure.type || item.enclosure.type.startsWith('image/'))) {
    return item.enclosure.url;
  }
  const mc = item['media:content'];
  if (mc?.['$']?.url) return mc['$']!.url;
  const mt = item['media:thumbnail'];
  if (mt?.['$']?.url) return mt['$']!.url;
  const html = item['content:encoded'] ?? item.content ?? '';
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

function generateId(url: string): string {
  return createHash('md5').update(url).digest('hex').slice(0, 16);
}

function cleanDescription(raw: string | undefined): string {
  if (!raw) return '';
  // 1. Convert block tags to paragraph breaks before stripping
  // 2. Strip remaining HTML tags
  // 3. Decode HTML entities (handles nested &amp;amp; encoding)
  // 4. Collapse whitespace while preserving paragraph breaks
  const stripped = raw
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(stripped)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim()
    .slice(0, 8000);
}

/**
 * For Google News proxied feeds, the title is suffixed with " - Source Name"
 * which we strip so the article title displays cleanly.
 */
function cleanTitle(title: string, feed: FeedSource): string {
  // Decode HTML entities first so titles like "Tesco&#39;s" render correctly
  const decoded = decodeHtmlEntities(title);
  if (feed.type !== 'google-news') return decoded;
  // Common patterns: "Title - Site Name" or "Title | Site Name"
  return decoded
    .replace(/\s+[-|–]\s+[^-|–]+$/, '') // strip trailing " - Source"
    .trim();
}

/**
 * Reject entries that aren't real editorial articles. We've seen Google
 * News surface AdAge's video archive (titles like `Uber_Cramped_15s`,
 * `NFA_Send_Off_30_PR_H264`) and stray ripper-site URLs (yt5s.com etc.)
 * sneaking in. These look broken in the feed and offer nothing useful.
 */
function isJunkEntry(title: string, url: string): boolean {
  const t = title.trim();
  // Empty or punctuation-only after source-name stripping
  if (t.length < 5) return true;
  if (/^[\s\-_•·.|]+$/.test(t)) return true;
  // Video codec / format suffixes — telltale of raw file uploads
  if (/_(H264|h264|HEVC|HD4K?|mp4|mov|wmv|avi|prores)\b/i.test(t)) return true;
  // _<digits>s duration suffix (e.g. _15s, _30s)
  if (/_\d{1,3}s\b/.test(t)) return true;
  // Common video-production filename markers
  if (/_(slideshow|animation|render|edit|final|export|cut|loop|master|review|approval)\b/i.test(t)) return true;
  // Looks like a raw filename: 3+ underscores, no spaces
  if (/^[^\s]+_[^\s]+_[^\s]+/.test(t) && !/\s/.test(t)) return true;
  // YouTube ripper / mirror services in the URL
  if (/\b(yt5s|y2mate|savefrom|9convert|ytmp3|x2download|onlyvideo)\.(com|net|io|to)\b/i.test(url)) return true;
  return false;
}

export async function fetchAllArticles(): Promise<Article[]> {
  return fetchArticlesFromFeeds(FEEDS);
}

/**
 * Fetch articles for a specific ISO week (e.g. '2026-W20'). Used by the
 * backfill endpoint to recover weeks that weren't archived in real time.
 * RSS feeds typically retain 2-4 weeks of history, so recent past weeks
 * are usually recoverable.
 */
export async function fetchArticlesForWeek(weekId: string): Promise<Article[]> {
  return fetchArticlesFromFeeds(FEEDS, weekId);
}

export async function fetchArticlesFromFeeds(feeds: FeedSource[], weekId?: string): Promise<Article[]> {
  if (feeds.length === 0) return [];

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const parsed = await parser.parseURL(feed.rssUrl);
      return { feed, items: parsed.items };
    })
  );

  const articles: Article[] = [];

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { feed, items } = result.value;

    for (const item of items) {
      const pubDate = item.isoDate
        ? new Date(item.isoDate)
        : item.pubDate
        ? new Date(item.pubDate)
        : null;
      if (!pubDate || isNaN(pubDate.getTime())) continue;
      const matchesWeek = weekId ? isInWeek(pubDate, weekId) : isCurrentWeek(pubDate);
      if (!matchesWeek) continue;

      if (isPaywalled(item, feed.paywallPhrases ?? [])) continue;

      const rawTitle = item.title?.trim();
      const url = item.link?.trim();
      if (!rawTitle || !url) continue;

      const title = cleanTitle(rawTitle, feed);
      if (isJunkEntry(title, url)) continue;

      articles.push({
        id: generateId(url),
        title,
        url,
        description: cleanDescription(item['content:encoded'] ?? item.content ?? item.contentSnippet),
        imageUrl: extractImage(item),
        publishedAt: pubDate.toISOString(),
        source: feed.id,
        sourceName: feed.name,
        sourceColor: feed.color,
        category: detectCategory(title, item.contentSnippet ?? '', feed.id),
      });
    }
  }

  // Deduplicate by id
  const seen = new Set<string>();
  const unique = articles.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  // Sort newest first
  unique.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  // Remove industry news — too agency/business-focused for a creative digest.
  const filtered = unique.filter((a) => a.category !== 'industry-news');

  // Cap articles entering the heavy enrichment pipeline. Each article gets a
  // JSDOM-backed Readability pass + image HEAD verification + (sometimes)
  // Vimeo oEmbed call. JSDOM is memory-hungry (~150-250MB per instance), so
  // running it on 100+ articles in parallel can blow the 1GB Vercel Hobby
  // function memory cap and 500 the page. 50 newest articles is plenty of
  // breadth for the home feed.
  const TOP_FOR_ENRICHMENT = 75;
  const toEnrich = filtered.slice(0, TOP_FOR_ENRICHMENT);

  // Concurrency of 3 keeps peak memory well under the function limit while
  // still parallelising enough to finish the cold path in 20-30s.
  const enriched = await enrichWithOgImages(toEnrich, 3);

  // Drop articles without a unique, article-specific image.
  // Two signals:
  //   1. Shared URL — if 2+ articles in this batch have the same imageUrl it's
  //      a site-wide template (e.g. aotw-meta.jpg used across all AotW articles).
  //   2. Known-generic filename patterns (meta, og-default, placeholder, etc.)
  const GENERIC_IMAGE_PATTERNS = [
    /-meta\.(jpe?g|png|webp|gif)(\?.*)?$/i,
    /-og\.(jpe?g|png|webp|gif)(\?.*)?$/i,
    /[-_]default\.(jpe?g|png|webp|gif)(\?.*)?$/i,
    /[-_]placeholder\.(jpe?g|png|webp|gif)(\?.*)?$/i,
    /\/default[-_]image/i,
    /\/fallback\./i,
    /\/no[-_]?image/i,
    /\/blank\./i,
  ];

  const imageCounts = new Map<string, number>();
  for (const a of enriched) {
    if (a.imageUrl) imageCounts.set(a.imageUrl, (imageCounts.get(a.imageUrl) ?? 0) + 1);
  }

  // Don't drop articles based on image quality — strip bad URLs instead so
  // the UI can render a source-coloured fallback. Dropping articles entirely
  // meant Google-News-proxied sources (~half our feed list) returned nothing
  // because their landing pages don't yield a clean og:image.
  return enriched.map((a) => {
    if (a.videoUrl) return a;
    if (!a.imageUrl) return a;
    if (GENERIC_IMAGE_PATTERNS.some((re) => re.test(a.imageUrl!))) {
      return { ...a, imageUrl: undefined };
    }
    if ((imageCounts.get(a.imageUrl) ?? 0) > 1) {
      return { ...a, imageUrl: undefined };
    }
    return a;
  });
}
