import { ImageResponse } from "next/og";

import { LOGO_BARS, LOGO_BUBBLE_PATH } from "@/components/brand/logo";

// Browser-tab icon: the "Growth" brand mark (chat bubble + rising bars)
// on the Clay accent. Static hex because the favicon renders outside
// the app's CSS; keep in sync with src/components/brand/logo.tsx.
// Rendered at build time; Next injects <link rel="icon"> automatically.
// This route takes precedence over src/app/favicon.ico.

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <svg width="32" height="32" viewBox="0 0 48 48">
        <rect width="48" height="48" rx="11" fill="#0e8f63" />
        <path d={LOGO_BUBBLE_PATH} fill="none" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round" />
        {LOGO_BARS.map(([x, y, h]) => (
          <rect key={x} x={x} y={y} width="3.6" height={h} rx="1.2" fill="#ffffff" />
        ))}
      </svg>
    ),
    { ...size },
  );
}
