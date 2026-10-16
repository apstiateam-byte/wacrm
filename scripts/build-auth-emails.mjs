#!/usr/bin/env node
// ============================================================
// Branded Supabase Auth email templates.
//
//   npm run emails:build
//
// Writes supabase/templates/<type>.html for the six emails Supabase
// Auth sends, plus supabase/templates/SUBJECTS.md. Paste each file into
// Supabase Dashboard → Authentication → Emails → Templates (or point
// [auth.email.template.<type>] content_path at it for self-hosted /
// CLI stacks — see docs/auth-emails.md).
//
// Brand values come from the environment (falls back to .env.local):
//   NEXT_PUBLIC_APP_NAME       product name          (default "wacrm")
//   NEXT_PUBLIC_SUPPORT_EMAIL  support address in the footer
//   NEXT_PUBLIC_LEGAL_ENTITY   company line in the footer
//
// Supabase fills the {{ .Variables }} at send time — {{ .SiteURL }} is
// your Site URL, so the logo loads from your own deployment
// (/apple-icon, a PNG; SVG is blocked by Gmail and Outlook).
//
// Buttons link straight to {{ .SiteURL }}/auth/callback with
// {{ .TokenHash }} (verified there with verifyOtp) instead of
// {{ .ConfirmationURL }}, which goes through the <project>.supabase.co
// URL first. `redirect_to={{ .RedirectTo }}` carries where the app asked
// to return (e.g. /join/<token> for invite sign-ups).
// ============================================================

import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// --- env (process env wins over .env.local) -----------------------
function loadDotEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}
const fileEnv = loadDotEnv(join(process.cwd(), '.env.local'));
const env = (k, d) => process.env[k]?.trim() || fileEnv[k]?.trim() || d;

const BRAND = env('NEXT_PUBLIC_APP_NAME', 'wacrm');
const SUPPORT = env('NEXT_PUBLIC_SUPPORT_EMAIL', '');
const ENTITY = env('NEXT_PUBLIC_LEGAL_ENTITY', BRAND);

// Brand palette (Clay theme, light): see src/app/globals.css.
const C = {
  paper: '#f6f3ec',
  card: '#fdfcf9',
  ink: '#2b2622',
  muted: '#6f675e',
  faint: '#9b9288',
  border: '#e7e1d6',
  clay: '#b8603d',
  claySoft: '#f6e7df',
};

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Bulletproof table-based layout: works in Gmail, Outlook, Apple Mail. */
function layout({ preheader, heading, intro, button, after, code }) {
  const btn = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px">
          <tr><td style="border-radius:999px;background:${C.clay}">
            <a href="${button.url}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${esc(button.label)}</a>
          </td></tr>
        </table>
        <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:${C.faint}">Button not working? Copy this link into your browser:<br>
          <a href="${button.url}" style="color:${C.clay};word-break:break-all">${button.url}</a></p>`
    : '';
  const codeBlock = code
    ? `<p style="margin:26px 0 6px;font-size:13px;color:${C.muted}">Your code</p>
        <div style="display:inline-block;padding:14px 22px;border-radius:12px;background:${C.claySoft};font-family:'SFMono-Regular',Consolas,monospace;font-size:28px;letter-spacing:6px;font-weight:700;color:${C.clay}">${code}</div>`
    : '';
  const footerContact = SUPPORT ? ` · <a href="mailto:${esc(SUPPORT)}" style="color:${C.faint}">${esc(SUPPORT)}</a>` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.paper}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper}">
  <tr><td align="center" style="padding:40px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
      <tr><td style="padding:0 4px 20px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:middle"><img src="{{ .SiteURL }}/apple-icon" width="36" height="36" alt="" style="display:block;border-radius:9px;border:0"></td>
          <td style="vertical-align:middle;padding-left:10px;font-family:Helvetica,Arial,sans-serif;font-size:17px;font-weight:700;color:${C.ink}">${esc(BRAND)}</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:18px;padding:36px 32px;font-family:Helvetica,Arial,sans-serif">
        <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;font-weight:500;color:${C.ink}">${esc(heading)}</h1>
        <p style="margin:0;font-size:15px;line-height:1.65;color:${C.muted}">${intro}</p>
        ${codeBlock}
        ${btn}
        ${after ? `<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid ${C.border};font-size:13px;line-height:1.6;color:${C.faint}">${after}</p>` : ''}
      </td></tr>
      <tr><td align="center" style="padding:22px 8px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${C.faint}">
        © ${esc(ENTITY)}${footerContact}<br>
        You received this email because of an action on your ${esc(BRAND)} account.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`;
}

const T = {
  confirmation: {
    subject: `Confirm your email for ${BRAND}`,
    html: layout({
      preheader: `One click to finish setting up your ${BRAND} account.`,
      heading: 'Confirm your email',
      intro: `Welcome to ${esc(BRAND)}! Confirm <strong style="color:${C.ink}">{{ .Email }}</strong> to finish creating your account and start your free trial.`,
      button: { label: 'Confirm email', url: '{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/dashboard&redirect_to={{ .RedirectTo }}' },
      after: "If you didn't sign up, you can safely ignore this email — no account will be created.",
    }),
  },
  recovery: {
    subject: `Reset your ${BRAND} password`,
    html: layout({
      preheader: 'Use this link to choose a new password.',
      heading: 'Reset your password',
      intro: `We received a request to reset the password for <strong style="color:${C.ink}">{{ .Email }}</strong>. The link below is valid for a limited time.`,
      button: { label: 'Choose a new password', url: '{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password&redirect_to={{ .RedirectTo }}' },
      after: "Didn't ask for this? Ignore this email — your password stays the same.",
    }),
  },
  magic_link: {
    subject: `Your ${BRAND} sign-in link`,
    html: layout({
      preheader: 'Sign in with one click.',
      heading: 'Your sign-in link',
      intro: `Click below to sign in to ${esc(BRAND)}. The link works once and expires shortly.`,
      button: { label: 'Sign in', url: '{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/dashboard&redirect_to={{ .RedirectTo }}' },
      after: "If you didn't try to sign in, you can ignore this email.",
    }),
  },
  invite: {
    subject: `You've been invited to ${BRAND}`,
    html: layout({
      preheader: `Accept your invitation to ${BRAND}.`,
      heading: "You're invited",
      intro: `You've been invited to join ${esc(BRAND)} — the shared WhatsApp inbox for your team. Accept the invitation to set up your account.`,
      button: { label: 'Accept invitation', url: '{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/dashboard&redirect_to={{ .RedirectTo }}' },
      after: "Not expecting this? You can ignore this email.",
    }),
  },
  email_change: {
    subject: `Confirm your new email for ${BRAND}`,
    html: layout({
      preheader: 'Confirm the change to your account email.',
      heading: 'Confirm your new email',
      intro: `Confirm that you want to change your ${esc(BRAND)} account email from <strong style="color:${C.ink}">{{ .Email }}</strong> to <strong style="color:${C.ink}">{{ .NewEmail }}</strong>.`,
      button: { label: 'Confirm email change', url: '{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change&next=/settings&redirect_to={{ .RedirectTo }}' },
      after: "Didn't request this? Don't click the link, and change your password right away.",
    }),
  },
  reauthentication: {
    subject: `Your ${BRAND} verification code`,
    html: layout({
      preheader: 'Your one-time verification code.',
      heading: 'Confirm it’s you',
      intro: `Enter this code in ${esc(BRAND)} to continue. It expires in a few minutes.`,
      code: '{{ .Token }}',
      after: "If you didn't request this code, someone may know your password — change it in Settings → Login & security.",
    }),
  },
};

const dir = join(process.cwd(), 'supabase', 'templates');
mkdirSync(dir, { recursive: true });
for (const [type, t] of Object.entries(T)) writeFileSync(join(dir, `${type}.html`), t.html);

const NAMES = {
  confirmation: 'Confirm signup',
  invite: 'Invite user',
  magic_link: 'Magic link',
  email_change: 'Change email address',
  recovery: 'Reset password',
  reauthentication: 'Reauthentication',
};
writeFileSync(
  join(dir, 'SUBJECTS.md'),
  `# Supabase Auth email templates (${BRAND})

Generated by \`npm run emails:build\` — re-run after changing NEXT_PUBLIC_APP_NAME /
NEXT_PUBLIC_SUPPORT_EMAIL / NEXT_PUBLIC_LEGAL_ENTITY.

Supabase Dashboard → Authentication → Emails → Templates. For each template, set the
subject and paste the whole HTML file into "Message body".

| Supabase template | Subject | File |
| --- | --- | --- |
${Object.entries(T).map(([type, t]) => `| ${NAMES[type]} | ${t.subject} | \`${type}.html\` |`).join('\n')}
`,
);

console.log(`Wrote ${Object.keys(T).length} templates for "${BRAND}" to supabase/templates/`);
