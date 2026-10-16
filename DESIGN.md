# Cluade design system — "Modern SaaS"

The brand contract for the marketing site, the CRM and the owner console.
Built with the OpenDesign `saas-landing`, `frontend-design`, `redesign-skill`
and `impeccable-design-polish` skills, with Linear and Vercel as references —
adapted, not copied. Product name always comes from `NEXT_PUBLIC_APP_NAME`.

## 1. Atmosphere

Crisp, product-led and calm. A serious B2B tool for Indian businesses that
sell on WhatsApp: near-white (light) / near-black (dark) canvases, quiet
cool-grey neutrals, one confident jade accent that nods to WhatsApp without
shouting, and real product UI as the main visual. No decorative blobs, no
purple-blue "AI" gradients, no emoji icons.

## 2. Colour (tokens live in `src/app/globals.css`)

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| `--background` | `oklch(0.985 0.002 250)` | `oklch(0.155 0.006 260)` | Page canvas |
| `--card` | `oklch(1 0 0)` | `oklch(0.19 0.007 260)` | Cards, panels, popovers |
| `--card-2` / `--muted` | `oklch(0.967 0.003 250)` | `oklch(0.225 0.008 260)` | Tiles, hover, inset areas |
| `--foreground` | `oklch(0.205 0.012 260)` | `oklch(0.97 0.003 250)` | Primary text |
| `--muted-foreground` | `oklch(0.52 0.014 260)` | `oklch(0.71 0.012 260)` | Secondary text |
| `--border` | `oklch(0.918 0.004 260)` | `oklch(0.275 0.008 260)` | Hairlines (1px only) |
| `--primary` (Jade) | `oklch(0.57 0.13 163)` | same | CTAs, links, active states |

- **One accent.** Jade is the only chromatic brand colour. On a marketing
  screen it appears on the primary CTA, the eyebrow/links, and at most one
  highlight — never as large fills or gradients.
- Status colours (emerald / amber / red / sky) are for status only.
- Other accents (Clay, Violet, Cobalt…) remain user-selectable in
  Settings → Appearance; Jade is the default.

## 3. Typography

- **Geist** (sans) for everything, **Geist Mono** for numbers, IDs, code.
- Display: weight 600, tracking `-0.035em`, line-height 1.05.
  Hero 56–72px, section titles 36–44px.
- h1/h2 in the app: weight 600, tracking `-0.02em`.
- Body 15–16px / 1.6; secondary 14px. Labels 12–13px weight 500.
- Numerals: `tabular-nums` in tables, prices and stats.
- Sentence case everywhere. Eyebrows are short, sentence-case, in the accent.

## 4. Layout

- Container `max-w-6xl` (1152px), gutters 16px mobile / 24px desktop.
- Section rhythm: 96px (desktop) / 64px (mobile) vertical padding.
- Marketing grid: asymmetric where it helps (copy left, product right),
  never three identical icon cards in a row.
- App: unchanged information architecture; components carry the look.

## 5. Components

- **Radius**: `--radius: 0.625rem`. Buttons/inputs 8px, cards 12px, large
  marketing panels 16–20px. Pills only for chips and status.
- **Buttons**: primary = solid jade, white text; secondary = card surface
  with hairline border; tertiary = text link. Press feedback
  `translate-y-px`; visible focus ring in the accent.
- **Cards**: hairline border + very soft neutral shadow
  (`0 1px 2px rgb(15 23 42 / 0.04)`); no heavy drop shadows.
- **Product mock-ups**: built in HTML with real-looking Indian business
  data, framed in a browser/window chrome; always `aria-hidden`.
- **Icons**: lucide at 16–20px, stroke 1.75, monochrome (foreground or
  muted), accent only for the active/highlighted one.

## 6. Motion

200ms ease-out for hover/focus; `transform`/`opacity` only. Respect
`prefers-reduced-motion`. No parallax, no autoplay carousels.

## 7. Copy rules

Plain, specific, Indian-English. No "seamless / elevate / unleash /
next-gen". No invented customer logos, testimonials or metrics; any
illustrative number in a mock-up must look like sample data. CTAs say what
happens ("Start free trial", "Book a demo").

## 8. Agent prompt guide

When adding UI: use existing tokens/utilities (`bg-card`, `text-muted-foreground`,
`border-border`, `text-primary`), never raw hex. Headings use the default
`font-heading` (Geist 600, tight tracking). Keep accent usage ≤ 2 per screen.
