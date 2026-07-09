import { dataset } from "@/lib/dataset";
const TOTAL_PASSPORTS = dataset.allCountries.length;
import { ImageResponse } from "next/og";

// Branded 1200x630 Open Graph card for Earth Visa.
export const alt =
  `Earth Visa - Visa-free travel and entry rules for ${TOTAL_PASSPORTS} passports`;
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
        {/* Brand lockup: Orbit mark + wordmark */}
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
            <svg width="66" height="66" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="8.5" fill="#fffdf8" />
              <g transform="rotate(-26 24 24)">
                <ellipse cx="24" cy="24" rx="16" ry="6.1" fill="none" stroke="#fffdf8" strokeWidth={2.4} />
                <circle cx="40" cy="24" r="3.1" fill="#11203a" />
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
            {`Visa-free travel and entry rules for ${TOTAL_PASSPORTS} passports`}
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
