import { phLaunchEnabled, PRODUCT_HUNT_LAUNCH } from "@/lib/launch";
import LaunchBannerDismiss from "@/components/LaunchBannerDismiss";

// The Product Hunt launch mark: white disc + orange "P", sits on the orange bar.
function ProductHuntMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="ph-mark shrink-0">
      <circle cx="12" cy="12" r="11" fill="#fff" />
      <rect x="8.4" y="6.4" width="2.4" height="11.2" rx="0.5" fill="var(--ph-ink)" />
      <path
        d="M9.6 6.4h4.1a3.6 3.6 0 0 1 0 7.2H9.6"
        fill="none"
        stroke="var(--ph-ink)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Slim, full-bleed launch banner shown at the very top of every page during the
// Product Hunt launch window (gated by phLaunchEnabled). Scrolls away above the
// sticky nav. Off-palette by design - Product Hunt's own orange makes it read as an
// external, time-boxed promo and gives it "click me" energy the site's red can't.
export default function LaunchBanner() {
  if (!phLaunchEnabled()) return null;
  return (
    <div id="ph-banner" role="region" aria-label="Product Hunt launch">
      <a
        href={PRODUCT_HUNT_LAUNCH.url}
        target="_blank"
        rel="noopener noreferrer"
        className="ph-link group"
        aria-label="Earth Visa is live on Product Hunt today. Open the launch and upvote us."
      >
        <span className="ph-live" aria-hidden="true">
          <span className="ph-live-dot" />
        </span>
        <ProductHuntMark />
        <span className="ph-copy">
          <strong className="ph-strong">Earth&nbsp;Visa is live on Product&nbsp;Hunt</strong>
          <span className="ph-sub"> today, one click helps us reach #1</span>
        </span>
        <span className="ph-cta">
          Upvote us <span className="ph-arrow" aria-hidden="true">&rarr;</span>
        </span>
      </a>
      <LaunchBannerDismiss />
    </div>
  );
}
