import Parser from 'rss-parser';
import { createHash } from 'crypto';
import type { Article } from './types';
import { FEEDS, type FeedSource } from './feeds';
import { detectCategory } from './categories';
import { isCurrentWeek } from './weekUtils';
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
  return raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 600);
}

/**
 * For Google News proxied feeds, the title is suffixed with " - Source Name"
 * which we strip so the article title displays cleanly.
 */
function cleanTitle(title: string, feed: FeedSource): string {
  if (feed.type !== 'google-news') return title;
  // Common patterns: "Title - Site Name" or "Title | Site Name"
  return title
    .replace(/\s+[-|–]\s+[^-|–]+$/, '') // strip trailing " - Source"
    .trim();
}

export async function fetchAllArticles(): Promise<Article[]> {
  return fetchArticlesFromFeeds(FEEDS);
}

export async function fetchArticlesFromFeeds(feeds: FeedSource[]): Promise<Article[]> {
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
      if (!isCurrentWeek(pubDate)) continue;

      if (isPaywalled(item, feed.paywallPhrases ?? [])) continue;

      const rawTitle = item.title?.trim();
      const url = item.link?.trim();
      if (!rawTitle || !url) continue;

      const title = cleanTitle(rawTitle, feed);

      articles.push({
        id: generateId(url),
        title,
        url,
        description: cleanDescription(item.contentSnippet ?? item.content),
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

  // Backfill OG images for any article that didn't have one in the RSS feed
  // (Adweek, Abduzeedo, Google-News-proxied sources). This adds ~3-6s on
  // cold load but is cached for 30 min via revalidate / persisted via cron.
  const enriched = await enrichWithOgImages(filtered, 8);

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

  return enriched.filter((a) => {
    if (!a.imageUrl) return false;
    if (GENERIC_IMAGE_PATTERNS.some((re) => re.test(a.imageUrl!))) return false;
    if ((imageCounts.get(a.imageUrl) ?? 0) > 1) return false;
    return true;
  });
}
