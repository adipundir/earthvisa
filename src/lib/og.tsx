import { ImageResponse } from "next/og";

// Brand palette - Design System v2 "Instrument" (matches globals.css). The prior
// warm-paper/document identity (cream ground, navy ink, ruled frame) is dead.
export const OG_PAPER = "#f6f7f9"; // cool ground
export const OG_INK = "#0b0e14";
export const OG_RED = "#b23528"; // brand red accent (used once, on the mark tile)
export const OG_INK_SOFT = "#525e6e"; // secondary
export const OG_INK_MUTE = "#8a94a2"; // muted / meta
export const OG_LINE = "#e2e6eb"; // hairline
export const OG_GREEN = "#0e7f41"; // verdict green - visa-free only

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
  // Orbit brand mark on a red tile: white planet + orbit, ink accent node.
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="8.5" fill="#ffffff" />
      <g transform="rotate(-26 24 24)">
        <ellipse cx="24" cy="24" rx="16" ry="6.1" fill="none" stroke="#ffffff" strokeWidth={2.4} />
        <circle cx="40" cy="24" r="3.1" fill="#0b0e14" />
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
          padding: "68px 80px",
          fontFamily: "sans-serif",
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
          <div style={{ display: "flex", fontSize: 24, color: OG_INK_SOFT, fontWeight: 500 }}>
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
                border: `2px solid ${OG_LINE}`,
                background: "#ffffff",
                color: OG_INK,
                fontSize: 56,
                fontWeight: 700,
                letterSpacing: "0.02em",
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

        {/* Stat tiles - white surfaces, hairline borders; visa-free reads green */}
        <div style={{ display: "flex", gap: 20 }}>
          {stats.slice(0, 4).map((s) => {
            const isVisaFree = /visa-?free/i.test(s.label);
            return (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: "22px 26px",
                  borderRadius: 12,
                  background: "#ffffff",
                  border: `1px solid ${OG_LINE}`,
                }}
              >
                <div style={{ display: "flex", fontSize: 21, color: OG_INK_MUTE, fontWeight: 500 }}>
                  {s.label}
                </div>
                <div style={{ display: "flex", marginTop: 8, fontSize: 50, fontWeight: 800, color: isVisaFree ? OG_GREEN : OG_INK, letterSpacing: "-0.01em" }}>
                  {s.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
