import { ImageResponse } from "next/og";

import { LOGO_BARS, LOGO_BUBBLE_PATH } from "@/components/brand/logo";
import { brand } from "@/content/marketing";
import { SITE_URL } from "@/lib/marketing/seo";

// Link-preview card (WhatsApp, LinkedIn, Facebook, X) for marketing
// pages. Static hex values because the image renders outside the app's
// CSS; they mirror the light theme tokens in globals.css.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const JADE = "#0e8f63";
const INK = "#1d2330";
const MUTED = "#5f6779";
const CANVAS = "#fafbfc";
const HAIRLINE = "#e4e7ec";

export function ogImage({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  const host = SITE_URL.replace(/^https?:\/\//, "");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: CANVAS,
          borderTop: `12px solid ${JADE}`,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 48 48">
            <rect width="48" height="48" rx="11" fill={JADE} />
            <path d={LOGO_BUBBLE_PATH} fill="none" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round" />
            {LOGO_BARS.map(([x, y, h]) => (
              <rect key={x} x={x} y={y} width="3.6" height={h} rx="1.2" fill="#ffffff" />
            ))}
          </svg>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: INK }}>{brand.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 28, color: JADE, fontWeight: 600 }}>{eyebrow}</div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 68, lineHeight: 1.08, fontWeight: 700, color: INK, letterSpacing: -2 }}>
            {title}
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 30, lineHeight: 1.4, color: MUTED, maxWidth: 980 }}>{subtitle}</div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `2px solid ${HAIRLINE}`,
            paddingTop: 24,
            fontSize: 26,
            color: MUTED,
          }}
        >
          <div style={{ display: "flex" }}>14-day free trial · Official WhatsApp Business Platform</div>
          <div style={{ display: "flex", color: INK, fontWeight: 600 }}>{host}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
