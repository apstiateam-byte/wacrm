import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand";

// ============================================================
// Brand mark — "Growth": a chat bubble holding three rising bars
// (conversations that grow sales). Drawn on a 48×48 grid so it stays
// crisp from 16px favicons to large hero tiles.
//
// Colours come from the theme tokens (--primary / --primary-foreground)
// so the mark follows the accent theme and light/dark mode. The static
// copies in src/app/icon.tsx, src/app/apple-icon.tsx and public/brand/
// use the Jade hex (#0e8f63) instead — keep the paths in sync.
// ============================================================

/** Bubble outline path on the 48×48 grid (shared with the icon routes). */
export const LOGO_BUBBLE_PATH =
  "M17 12h14a6 6 0 0 1 6 6v9a6 6 0 0 1-6 6h-8l-6 5.5V33a6 6 0 0 1-6-6v-9a6 6 0 0 1 6-6z";

/** The three rising bars: [x, y, height], width 3.6, bottoms aligned at y=28. */
export const LOGO_BARS: ReadonlyArray<readonly [number, number, number]> = [
  [16.5, 23, 5],
  [22.2, 20, 8],
  [27.9, 17, 11],
];

export function LogoMark({ size = 32, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="48" height="48" rx="11" fill="var(--primary)" />
      <path
        d={LOGO_BUBBLE_PATH}
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      {LOGO_BARS.map(([x, y, h]) => (
        <rect key={x} x={x} y={y} width="3.6" height={h} rx="1.2" fill="var(--primary-foreground)" />
      ))}
    </svg>
  );
}

/** Mark + product name (from NEXT_PUBLIC_APP_NAME). */
export function Logo({
  size = 32,
  className,
  textClassName,
  showName = true,
}: {
  size?: number;
  className?: string;
  textClassName?: string;
  showName?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} />
      {showName ? <span className={cn("font-semibold tracking-tight", textClassName)}>{APP_NAME}</span> : null}
    </span>
  );
}
