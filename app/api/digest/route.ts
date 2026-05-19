import { NextRequest, NextResponse } from 'next/server';
import { listSubscribers, markDigestSent } from '@/lib/digestStorage';
import { renderDigestEmail } from '@/lib/digestEmail';
import { getCurrentWeekId, formatWeekLabel } from '@/lib/weekUtils';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Send the weekly digest to all subscribers. Runs via Vercel Cron Monday
 * morning, also callable manually for testing via ?secret=REFRESH_SECRET.
 *
 * If RESEND_API_KEY is not set, this endpoint runs in "dry-run" mode — it
 * still iterates subscribers and renders emails, but logs instead of sending.
 * That lets you verify the cron + data flow before setting up Resend.
 */
export async function GET(req: NextRequest) {
  // Cron auth (Bearer token) OR manual auth (query secret)
  const authHeader = req.headers.get('authorization');
  const querySecret = req.nextUrl.searchParams.get('secret');
  const isAuthorized =
    (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) ||
    (process.env.REFRESH_SECRET && querySecret === process.env.REFRESH_SECRET);
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const subscribers = await listSubscribers();
  const weekId = getCurrentWeekId();
  const weekLabel = formatWeekLabel(weekId);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ??
    (req.nextUrl.origin || 'https://giglivenewsfeed.vercel.app');

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'GIG Weekly <digest@resend.dev>';
  const dryRun = !apiKey;

  const results: Array<{ email: string; sent: boolean; bookmarks: number; error?: string }> = [];

  for (const sub of subscribers) {
    if (sub.bookmarks.length === 0) {
      results.push({ email: sub.email, sent: false, bookmarks: 0 });
      continue;
    }

    const { html, text, subject } = renderDigestEmail({
      email: sub.email,
      bookmarks: sub.bookmarks,
      weekLabel,
      siteUrl,
    });

    if (dryRun) {
      console.log(`[digest:dry-run] Would send to ${sub.email}: ${sub.bookmarks.length} bookmarks`);
      results.push({ email: sub.email, sent: false, bookmarks: sub.bookmarks.length, error: 'dry-run (no RESEND_API_KEY)' });
      continue;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [sub.email],
          subject,
          html,
          text,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        results.push({ email: sub.email, sent: false, bookmarks: sub.bookmarks.length, error: errText.slice(0, 200) });
        continue;
      }

      await markDigestSent(sub.email);
      results.push({ email: sub.email, sent: true, bookmarks: sub.bookmarks.length });
    } catch (err) {
      results.push({
        email: sub.email,
        sent: false,
        bookmarks: sub.bookmarks.length,
        error: err instanceof Error ? err.message : 'send failed',
      });
    }
  }

  return NextResponse.json({
    success: true,
    weekLabel,
    dryRun,
    totalSubscribers: subscribers.length,
    results,
  });
}
