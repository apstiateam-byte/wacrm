import { ImageResponse } from "next/og";

import { LOGO_BARS, LOGO_BUBBLE_PATH } from "@/components/brand/logo";

// iOS home-screen icon (180×180). iOS rounds the corners itself, so the
// tile is a full square here. Same mark as src/app/icon.tsx.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg width="180" height="180" viewBox="0 0 48 48">
        <rect width="48" height="48" fill="#b8603d" />
        <path d={LOGO_BUBBLE_PATH} fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinejoin="round" />
        {LOGO_BARS.map(([x, y, h]) => (
          <rect key={x} x={x} y={y} width="3.6" height={h} rx="1.2" fill="#ffffff" />
        ))}
      </svg>
    ),
    { ...size },
  );
}
