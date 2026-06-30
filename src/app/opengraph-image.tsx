import { ImageResponse } from "next/og";

// Branded 1200x630 Open Graph card for Earth Visa.
export const alt =
  "Earth Visa - Visa-free travel and entry rules for 199 passports";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand palette (matches globals.css / icon.svg)
const PAPER = "#f6f2e9";
const INK = "#11203a";
const RED = "#b23528";
const INK_SOFT = "#3c4a63";

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
          background: PAPER,
          padding: "72px 80px",
          fontFamily: "sans-serif",
          // faint frame so the card reads as a "document"
          border: `10px solid ${INK}`,
        }}
      >
        {/* Brand lockup: globe mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              width: 96,
              height: 96,
              borderRadius: 22,
              background: RED,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
              <g
                stroke="#fffdf8"
                strokeWidth={2}
                strokeLinecap="round"
                fill="none"
              >
                <circle cx="16" cy="16" r="9.5" />
                <ellipse cx="16" cy="16" rx="4.2" ry="9.5" />
                <path d="M6.5 16h19" />
                <path d="M8.8 10.6h14.4" />
                <path d="M8.8 21.4h14.4" />
              </g>
            </svg>
          </div>
          <div
            style={{
              marginLeft: 28,
              fontSize: 60,
              fontWeight: 700,
              color: INK,
              letterSpacing: "-0.02em",
            }}
          >
            Earth Visa
          </div>
        </div>

        {/* Headline + tagline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              color: INK,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 1000,
            }}
          >
            Visa-free travel and entry rules for 199 passports
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 34,
              color: INK_SOFT,
              lineHeight: 1.3,
              maxWidth: 980,
            }}
          >
            Visa-free, visa on arrival, eTA, golden visas &amp; citizenship by
            investment - from official government sources.
          </div>
        </div>

        {/* Footer rule */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 26,
            color: RED,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          earthvisa.in
        </div>
      </div>
    ),
    { ...size },
  );
}
