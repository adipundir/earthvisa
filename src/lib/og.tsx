import { ImageResponse } from "next/og";

// Brand palette (matches globals.css / icon.svg)
export const OG_PAPER = "#f6f2e9";
export const OG_INK = "#11203a";
export const OG_RED = "#b23528";
export const OG_INK_SOFT = "#3c4a63";
export const OG_INK_MUTE = "#6a748a";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

function GlobeMark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <g stroke="#fffdf8" strokeWidth={2} strokeLinecap="round" fill="none">
        <circle cx="16" cy="16" r="9.5" />
        <ellipse cx="16" cy="16" rx="4.2" ry="9.5" />
        <path d="M6.5 16h19" />
        <path d="M8.8 10.6h14.4" />
        <path d="M8.8 21.4h14.4" />
      </g>
    </svg>
  );
}

export interface OgStat {
  label: string;
  value: number | string;
}

/**
 * Shared 1200x630 country card used by per-route opengraph/twitter images.
 * Every <div> sets an explicit display because Satori (next/og) requires it on
 * any element with more than one child. ISO code is shown instead of a flag
 * emoji because Satori does not reliably rasterise regional-indicator glyphs.
 */
export function countryOgImage({
  iso2,
  name,
  subtitle,
  stats,
}: {
  iso2: string;
  name: string;
  subtitle: string;
  stats: OgStat[];
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: OG_PAPER,
          padding: "64px 80px",
          fontFamily: "sans-serif",
          border: `10px solid ${OG_INK}`,
        }}
      >
        {/* Brand lockup */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                width: 64,
                height: 64,
                borderRadius: 16,
                background: OG_RED,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GlobeMark size={44} />
            </div>
            <div style={{ display: "flex", marginLeft: 20, fontSize: 38, fontWeight: 700, color: OG_INK, letterSpacing: "-0.02em" }}>
              Earth Visa
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: OG_RED, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            earthvisa.in
          </div>
        </div>

        {/* Country headline: ISO stamp + name */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 132,
              height: 132,
              borderRadius: 20,
              border: `4px solid ${OG_RED}`,
              color: OG_RED,
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {iso2}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 36, maxWidth: 820 }}>
            <div style={{ display: "flex", fontSize: 70, fontWeight: 700, color: OG_INK, lineHeight: 1.02, letterSpacing: "-0.03em" }}>
              {name}
            </div>
            <div style={{ display: "flex", marginTop: 14, fontSize: 30, color: OG_INK_SOFT, lineHeight: 1.25 }}>
              {subtitle}
            </div>
          </div>
        </div>

        {/* Stat tiles */}
        <div style={{ display: "flex", gap: 20 }}>
          {stats.slice(0, 4).map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                padding: "20px 24px",
                borderRadius: 12,
                background: "#fffdf8",
                border: "2px solid #e4dcc9",
              }}
            >
              <div style={{ display: "flex", fontSize: 18, color: OG_INK_MUTE, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {s.label}
              </div>
              <div style={{ display: "flex", marginTop: 8, fontSize: 48, fontWeight: 700, color: OG_INK }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
