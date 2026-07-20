// Product Hunt launch banner - sitewide promo chrome shown during the launch.
//
// Single switch, no env vars: `enabled: true` shows the banner sitewide,
// `enabled: false` hides it. Flip it back to false when the launch window closes.

export const PRODUCT_HUNT_LAUNCH = {
  /** the ONLY switch: true = banner live sitewide, false = hidden */
  enabled: true,
  /** the launch page travellers land on when they click through */
  url: "https://www.producthunt.com/products/earth-visa?launch=earth-visa&utm_source=site-banner&utm_medium=banner&utm_campaign=earth-visa-launch",
  postId: "1201821",
  /** localStorage key for "user dismissed this". Bump the date suffix to re-show
   *  the bar to everyone on a future launch (e.g. a v2 hunt). */
  dismissKey: "ph-launch-2026-07",
} as const;

/** Server + client safe: is the banner live right now? */
export function phLaunchEnabled(): boolean {
  return PRODUCT_HUNT_LAUNCH.enabled;
}
