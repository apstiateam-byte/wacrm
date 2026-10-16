// ============================================================
// Transactional email via Resend's REST API (no SDK dependency).
//
//   RESEND_API_KEY  API key from resend.com (domain must be verified)
//   EMAIL_FROM      e.g. "wacrm <billing@yourdomain.com>"
//
// Not configured → `sendEmail` returns { sent: false, skipped: true }
// and logs once; callers treat email as best-effort.
// ============================================================

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

let warned = false;

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key || !from) {
    if (!warned) {
      console.warn('[email] RESEND_API_KEY / EMAIL_FROM not set — billing emails are skipped');
      warned = true;
    }
    return { sent: false, skipped: true };
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      return { sent: false, error: body.message ?? `Resend error ${response.status}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Minimal, client-safe HTML layout: a heading, paragraphs and one
 * button. Plain-text alternative is built from the same parts.
 */
export function renderEmail(parts: {
  brand: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footer: string;
}): { html: string; text: string } {
  const p = parts.paragraphs
    .map((x) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#5b6370">${escapeHtml(x)}</p>`)
    .join('');
  const button = parts.cta
    ? `<p style="margin:22px 0"><a href="${escapeHtml(parts.cta.url)}" style="display:inline-block;background:#0e8f63;color:#ffffff;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:8px;font-size:15px">${escapeHtml(parts.cta.label)}</a></p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e4e7eb;border-radius:12px"><tr><td style="padding:28px">
<p style="margin:0 0 18px;font-weight:700;font-size:16px;color:#0e8f63">${escapeHtml(parts.brand)}</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#14171d">${escapeHtml(parts.heading)}</h1>
${p}${button}
<p style="margin:24px 0 0;font-size:12px;color:#8a919c">${escapeHtml(parts.footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [parts.heading, '', ...parts.paragraphs, '', parts.cta ? `${parts.cta.label}: ${parts.cta.url}` : '', '', parts.footer]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n');
  return { html, text };
}
