import { ImageResponse } from "next/og";
import { OG_SIZE, OG_CONTENT_TYPE, OG_PAPER, OG_INK, OG_RED, OG_INK_SOFT, OG_GREEN, OG_LINE } from "@/lib/og";

// Static branded 1200x630 Open Graph card for /compare. Route image files only
// receive route params (there are none here), not query strings, so this card
// speaks to the tool itself rather than a specific A-vs-B pair.
export const alt = "Compare two passports side by side on Earth Visa";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

function PassportTile({ tint }: { tint: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 300,
        height: 200,
        borderRadius: 20,
        background: "#ffffff",
        border: `2px solid ${OG_LINE}`,
        padding: "26px 28px",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", width: 56, height: 56, borderRadius: 14, background: tint }} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", width: 150, height: 16, borderRadius: 6, background: OG_LINE }} />
        <div style={{ display: "flex", marginTop: 12, fontSize: 46, fontWeight: 800, color: OG_INK, letterSpacing: "-0.02em" }}>
          000
        </div>
      </div>
    </div>
  );
}

export default function Image() {
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
            <div style={{ display: "flex", width: 64, height: 64, borderRadius: 16, background: OG_RED, alignItems: "center", justifyContent: "center" }}>
              <svg width="44" height="44" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="8.5" fill="#ffffff" />
                <g transform="rotate(-26 24 24)">
                  <ellipse cx="24" cy="24" rx="16" ry="6.1" fill="none" stroke="#ffffff" strokeWidth={2.4} />
                  <circle cx="40" cy="24" r="3.1" fill="#0b0e14" />
                </g>
              </svg>
            </div>
            <div style={{ display: "flex", marginLeft: 20, fontSize: 38, fontWeight: 700, color: OG_INK, letterSpacing: "-0.02em" }}>
              Earth Visa
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: OG_INK_SOFT, fontWeight: 500 }}>earthvisa.in</div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 66, fontWeight: 800, color: OG_INK, lineHeight: 1.04, letterSpacing: "-0.03em", maxWidth: 1040 }}>
            Compare two passports, side by side
          </div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 30, color: OG_INK_SOFT, lineHeight: 1.3, maxWidth: 940 }}>
            Where each can go with no embassy visit, and exactly which destinations only one reaches.
          </div>
        </div>

        {/* Two passport tiles with a vs mark */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <PassportTile tint={OG_GREEN} />
          <div style={{ display: "flex", margin: "0 34px", fontSize: 40, fontWeight: 800, color: OG_INK_SOFT, letterSpacing: "0.04em" }}>
            VS
          </div>
          <PassportTile tint={OG_RED} />
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
