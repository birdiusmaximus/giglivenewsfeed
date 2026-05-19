import { NextResponse } from 'next/server';
import { saveSubscriber, removeSubscriber } from '@/lib/digestStorage';
import type { Article } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidArticle(a: unknown): a is Article {
  if (!a || typeof a !== 'object') return false;
  const x = a as Record<string, unknown>;
  return typeof x.id === 'string' && typeof x.title === 'string' && typeof x.url === 'string';
}

export async function POST(req: Request) {
  let body: { email?: string; bookmarks?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = (body.email ?? '').toString().trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const bookmarks: Article[] = Array.isArray(body.bookmarks)
    ? body.bookmarks.filter(isValidArticle).slice(0, 500) // cap at 500 to avoid abuse
    : [];

  const ok = await saveSubscriber(email, bookmarks);
  if (!ok) {
    return NextResponse.json(
      { error: 'Subscription storage unavailable. KV not configured?' },
      { status: 503 }
    );
  }
  return NextResponse.json({ success: true, email, bookmarkCount: bookmarks.length });
}

export async function DELETE(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = (body.email ?? '').toString().trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  await removeSubscriber(email);
  return NextResponse.json({ success: true });
}
