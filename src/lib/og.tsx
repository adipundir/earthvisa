import { ImageResponse } from "next/og";

// Brand palette (matches globals.css / icon.svg)
export const OG_PAPER = "#f6f2e9";
export const OG_INK = "#11203a";
export const OG_RED = "#b23528";
export const OG_INK_SOFT = "#3c4a63";
export const OG_INK_MUTE = "#6a748a";
export const OG_LINE = "#cbbf9f";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/**
 * Fetches a country flag PNG (flagcdn, by ISO-2) and returns it as a data URI so
 * Satori can rasterise it (it cannot render flag emoji glyphs). Returns null on
 * any failure so the card can fall back to an ISO-code stamp instead of crashing.
 */
async function fetchFlag(iso2: string): Promise<string | null> {
  if (!/^[A-Za-z]{2}$/.test(iso2)) return null;
  try {
    const res = await fetch(`https://flagcdn.com/w320/${iso2.toLowerCase()}.png`);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function GlobeMark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <g stroke="#fffdf8" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="24" cy="24" r="19.5" strokeWidth={2.6} />
        <circle cx="24" cy="24" r="15" strokeWidth={1.4} />
        <path d="M16.5 18L24 31.5 31.5 18" strokeWidth={4} />
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
export async function countryOgImage({
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
  const flag = await fetchFlag(iso2);
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

        {/* Country headline: flag (or ISO stamp fallback) + name */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {flag ? (
            <div
              style={{
                display: "flex",
                width: 176,
                height: 132,
                borderRadius: 16,
                overflow: "hidden",
                border: `2px solid ${OG_LINE}`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={flag} alt="" width={176} height={132} style={{ objectFit: "cover" }} />
            </div>
          ) : (
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
          )}
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
