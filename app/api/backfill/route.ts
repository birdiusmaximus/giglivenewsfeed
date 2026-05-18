import { NextRequest, NextResponse } from 'next/server';
import { fetchArticlesForWeek } from '@/lib/parser';
import { saveWeekData } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Backfill a missed week into the archive.
 *
 * Usage:
 *   GET /api/backfill?week=2026-W20&secret=YOUR_REFRESH_SECRET
 *
 * Only recent weeks (typically within the last 2-4 weeks) are recoverable
 * since most RSS feeds don't retain older items.
 */
export async function GET(req: NextRequest) {
  const querySecret = req.nextUrl.searchParams.get('secret');
  const weekId = req.nextUrl.searchParams.get('week');

  if (!process.env.REFRESH_SECRET || querySecret !== process.env.REFRESH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!weekId || !/^\d{4}-W\d{2}$/.test(weekId)) {
    return NextResponse.json(
      { error: 'Missing or invalid `week` param. Expected format: 2026-W20' },
      { status: 400 }
    );
  }

  try {
    const articles = await fetchArticlesForWeek(weekId);
    const saved = await saveWeekData(weekId, articles);

    return NextResponse.json({
      success: true,
      weekId,
      articleCount: articles.length,
      persisted: saved,
      note: articles.length === 0
        ? 'No articles found for this week — likely too old to recover from RSS feeds.'
        : undefined,
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}
