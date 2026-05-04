import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

export const runtime = 'nodejs';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

const parser = new Parser({
  timeout: 8000,
  headers: {
    'User-Agent': UA,
    Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*;q=0.5',
  },
});

const COMMON_RSS_PATHS = [
  '/feed/',
  '/feed',
  '/rss',
  '/rss.xml',
  '/feed.xml',
  '/atom.xml',
  '/index.xml',
  '/blog/feed/',
  '/blog/rss',
];

function gnewsUrl(host: string): string {
  return `https://news.google.com/rss/search?q=site:${encodeURIComponent(host)}+when:7d&hl=en-US&gl=US&ceid=US:en`;
}

function normalizeInputUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/$/, '');
}

interface ValidateResult {
  ok: true;
  rssUrl: string;
  type: 'rss' | 'google-news';
  name: string;
  host: string;
  sampleCount: number;
}

interface ValidateError {
  ok: false;
  error: string;
}

async function tryParse(url: string): Promise<{ items: number; title?: string } | null> {
  try {
    const feed = await parser.parseURL(url);
    if (feed.items && feed.items.length > 0) {
      return { items: feed.items.length, title: feed.title };
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: Request): Promise<NextResponse<ValidateResult | ValidateError>> {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.url || typeof body.url !== 'string') {
    return NextResponse.json({ ok: false, error: 'Missing url' }, { status: 400 });
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(normalizeInputUrl(body.url));
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid URL' }, { status: 400 });
  }

  const host = baseUrl.host.replace(/^www\./, '');
  const fallbackName = host.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // 1. If the user pasted a direct RSS URL, try it as-is
  const direct = await tryParse(baseUrl.toString());
  if (direct) {
    return NextResponse.json({
      ok: true,
      rssUrl: baseUrl.toString(),
      type: 'rss',
      name: direct.title?.trim() || fallbackName,
      host,
      sampleCount: direct.items,
    });
  }

  // 2. Try common RSS paths on the site root
  const root = `${baseUrl.protocol}//${baseUrl.host}`;
  for (const path of COMMON_RSS_PATHS) {
    const candidate = `${root}${path}`;
    const result = await tryParse(candidate);
    if (result) {
      return NextResponse.json({
        ok: true,
        rssUrl: candidate,
        type: 'rss',
        name: result.title?.trim() || fallbackName,
        host,
        sampleCount: result.items,
      });
    }
  }

  // 3. Fall back to Google News proxy
  const gnews = gnewsUrl(host);
  const gnewsResult = await tryParse(gnews);
  if (gnewsResult) {
    return NextResponse.json({
      ok: true,
      rssUrl: gnews,
      type: 'google-news',
      name: fallbackName,
      host,
      sampleCount: gnewsResult.items,
    });
  }

  return NextResponse.json(
    { ok: false, error: `Could not find an RSS feed or recent Google News results for ${host}` },
    { status: 404 }
  );
}
