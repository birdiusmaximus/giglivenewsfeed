import type { Article } from './types';

/**
 * Render the weekly digest as an HTML email body. GIG brand styling, inline
 * styles only (email clients ignore <style> blocks consistently).
 */
export function renderDigestEmail(opts: {
  email: string;
  bookmarks: Article[];
  weekLabel: string;
  siteUrl: string;
}): { html: string; text: string; subject: string } {
  const { email, bookmarks, weekLabel, siteUrl } = opts;
  const unsubscribeUrl = `${siteUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;

  const subject = `Your GIG Weekly digest — ${weekLabel}`;

  // ----- Plain-text fallback (some clients prefer it) -----
  const text = [
    `Your GIG Weekly digest — ${weekLabel}`,
    '',
    `${bookmarks.length} saved article${bookmarks.length === 1 ? '' : 's'} from the past week:`,
    '',
    ...bookmarks.map((a, i) => `${i + 1}. ${a.title}\n   ${a.sourceName} · ${a.url}`),
    '',
    `Read on the web: ${siteUrl}`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  // ----- HTML body -----
  const cards = bookmarks
    .map(
      (a) => `
      <tr><td style="padding: 0 0 24px 0;">
        <a href="${a.url}" style="display:block; text-decoration:none; color:#0D1A2D;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border:1px solid rgba(13,26,45,0.08);border-radius:8px;overflow:hidden;">
            ${a.imageUrl ? `
              <tr><td>
                <img src="${a.imageUrl}" alt="" width="100%" style="display:block;width:100%;max-height:240px;object-fit:cover;border-bottom:2px solid ${a.sourceColor};" />
              </td></tr>
            ` : ''}
            <tr><td style="padding:18px 20px 20px;">
              <div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;font-weight:900;color:${a.sourceColor};margin-bottom:8px;">${escapeHtml(a.sourceName)}</div>
              <div style="font-size:18px;font-weight:900;line-height:1.25;letter-spacing:-0.01em;color:#0D1A2D;margin-bottom:8px;">${escapeHtml(a.title)}</div>
              ${a.description ? `<div style="font-size:14px;line-height:1.5;color:rgba(13,26,45,0.65);">${escapeHtml(a.description.split('\n\n')[0]).slice(0, 280)}…</div>` : ''}
            </td></tr>
          </table>
        </a>
      </td></tr>
    `
    )
    .join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#FEF6F6;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FEF6F6;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="padding:0 0 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:900;color:rgba(13,26,45,0.5);margin-bottom:6px;">GIG Weekly</div>
                <div style="font-size:32px;font-weight:900;letter-spacing:-0.02em;color:#0D1A2D;line-height:1;">Your saved articles</div>
                <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;color:#F45347;margin-top:10px;">${escapeHtml(weekLabel)}</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Articles -->
        <tr><td>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${cards || `<tr><td style="text-align:center;padding:40px 20px;color:rgba(13,26,45,0.4);font-size:13px;">You didn't save any articles this week.</td></tr>`}
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 0 0 0;border-top:1px solid rgba(13,26,45,0.08);">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:11px;color:rgba(13,26,45,0.4);line-height:1.6;">
                You're subscribed to GIG Weekly digest.<br>
                <a href="${siteUrl}" style="color:#F45347;text-decoration:none;font-weight:700;">Visit the site</a>
                &nbsp;·&nbsp;
                <a href="${unsubscribeUrl}" style="color:rgba(13,26,45,0.4);text-decoration:underline;">Unsubscribe</a>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { html, text, subject };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
