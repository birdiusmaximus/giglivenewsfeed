import { NextRequest, NextResponse } from 'next/server';
import { fetchAllArticles } from '@/lib/parser';
import { saveWeekData } from '@/lib/storage';
import { getCurrentWeekId } from '@/lib/weekUtils';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Vercel Cron sends Authorization: Bearer {CRON_SECRET}
  // Also allow manual refresh via ?secret= for convenience
  const authHeader = req.headers.get('authorization');
  const querySecret = req.nextUrl.searchParams.get('secret');

  const isAuthorized =
    (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) ||
    (process.env.REFRESH_SECRET && querySecret === process.env.REFRESH_SECRET);

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const weekId = getCurrentWeekId();
    const articles = await fetchAllArticles();
    const saved = await saveWeekData(weekId, articles);

    return NextResponse.json({
      success: true,
      weekId,
      articleCount: articles.length,
      persisted: saved,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
