import { NextRequest, NextResponse } from 'next/server';
import { removeSubscriber } from '@/lib/digestStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One-click unsubscribe from a link in the digest email.
 * The link includes the email as a query param — we don't sign it because the
 * cost of being unsubscribed is zero (just resubscribe). Bots cant cause harm.
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email) {
    return new NextResponse('Missing email', { status: 400 });
  }
  await removeSubscriber(email);
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title><style>
      body{font-family:system-ui,sans-serif;max-width:520px;margin:80px auto;padding:0 24px;color:#0D1A2D;background:#FEF6F6}
      h1{font-weight:900;font-size:28px;letter-spacing:-0.02em;margin:0 0 12px}
      p{color:#0D1A2D99;line-height:1.55;margin:0 0 24px}
      a{color:#F45347;font-weight:700;text-decoration:none}
    </style></head><body>
      <h1>You're unsubscribed</h1>
      <p>${email} will no longer receive the GIG Weekly digest. Your saved articles remain in your browser. You can resubscribe anytime from the site.</p>
      <a href="/">← Back to GIG Weekly</a>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}
