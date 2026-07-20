"use client";
import { PRODUCT_HUNT_LAUNCH } from "@/lib/launch";

// The only interactive bit of the launch banner. Kept as a tiny client island so
// the banner itself stays a server component (rendered pre-paint, no CLS). Clicking
// persists the dismissal and hides the bar instantly via the same class the
// pre-paint script uses, so it never reappears until the dismissKey is bumped.
export default function LaunchBannerDismiss() {
  return (
    <button
      type="button"
      aria-label="Dismiss the Product Hunt launch banner"
      className="ph-dismiss"
      onClick={() => {
        try {
          localStorage.setItem(PRODUCT_HUNT_LAUNCH.dismissKey, "1");
        } catch {}
        document.documentElement.classList.add("ph-dismissed");
      }}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none">
        <path
          d="M4 4l8 8M12 4l-8 8"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
