import { ImageResponse } from "next/og";

// Apple touch icon (180x180 PNG). Full-bleed rust tile with the Orbit mark;
// iOS applies its own corner rounding.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#b23528",
        }}
      >
        <svg width="118" height="118" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="8.5" fill="#fffdf8" />
          <g transform="rotate(-26 24 24)">
            <ellipse cx="24" cy="24" rx="16" ry="6.1" fill="none" stroke="#fffdf8" strokeWidth={2.4} />
            <circle cx="40" cy="24" r="3.1" fill="#11203a" />
          </g>
        </svg>
      </div>
    ),
    { ...size },
  );
}
