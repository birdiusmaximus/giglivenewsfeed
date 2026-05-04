import { NextResponse } from 'next/server';
import { fetchArticlesFromFeeds } from '@/lib/parser';
import type { FeedSource } from '@/lib/feeds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RequestBody {
  feeds?: FeedSource[];
}

function isValidFeed(f: unknown): f is FeedSource {
  if (!f || typeof f !== 'object') return false;
  const x = f as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    typeof x.url === 'string' &&
    typeof x.rssUrl === 'string' &&
    typeof x.color === 'string'
  );
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const feeds = Array.isArray(body.feeds) ? body.feeds.filter(isValidFeed) : [];

  if (feeds.length === 0) {
    return NextResponse.json({ articles: [] });
  }

  try {
    const articles = await fetchArticlesFromFeeds(feeds);
    return NextResponse.json({ articles });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}
