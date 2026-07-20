import { dataset } from "@/lib/dataset";
const TOTAL_PASSPORTS = dataset.allCountries.length;
import { ImageResponse } from "next/og";

// Branded 1200x630 Open Graph card for Earth Visa.
export const alt =
  `Earth Visa - Visa-free travel and entry rules for ${TOTAL_PASSPORTS} passports`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand palette - Design System v2 "Instrument" (matches globals.css). The prior
// warm-paper/document identity (cream ground, navy ink, ruled frame) is dead.
const PAPER = "#f6f7f9"; // cool ground
const INK = "#0b0e14";
const RED = "#b23528"; // brand red accent (used once, on the mark tile)
const INK_SOFT = "#525e6e"; // secondary

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
          padding: "76px 80px",
          fontFamily: "sans-serif",
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
              <circle cx="24" cy="24" r="8.5" fill="#ffffff" />
              <g transform="rotate(-26 24 24)">
                <ellipse cx="24" cy="24" rx="16" ry="6.1" fill="none" stroke="#ffffff" strokeWidth={2.4} />
                <circle cx="40" cy="24" r="3.1" fill="#0b0e14" />
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

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 28,
            color: INK_SOFT,
            fontWeight: 500,
          }}
        >
          earthvisa.in
        </div>
      </div>
    ),
    { ...size },
  );
}
