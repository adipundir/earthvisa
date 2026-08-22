// Custom product events.
//
// Forwards to Microsoft Clarity, which is already loaded in the root layout
// whenever NEXT_PUBLIC_CLARITY_ID is set and, unlike the previous
// @vercel/analytics binding, works wherever the site is hosted. That binding
// would not have failed loudly off Vercel - `track` would simply have gone
// nowhere, and every funnel would have quietly read zero.
//
// One real difference from what it replaces: Clarity has no arbitrary
// per-event property bag. An event is a name, and dimensions are separate
// "tags". So each property is set as a tag keyed `<event>_<property>`
// immediately before the event is fired. Tags attach to the SESSION, not to
// the individual event, which is a genuine loss of fidelity when the same
// event fires twice in one session with different values - the last write is
// what the session carries.

type Props = Record<string, string | number | boolean | null | undefined>;

type Clarity = (...args: unknown[]) => void;

function clarity(): Clarity | null {
  if (typeof window === "undefined") return null;
  const c = (window as unknown as { clarity?: Clarity }).clarity;
  return typeof c === "function" ? c : null;
}

export function track(event: string, props?: Props): void {
  const c = clarity();
  // No Clarity ID configured, or the script has not loaded yet. Analytics must
  // never be the reason an interaction throws.
  if (!c) return;
  try {
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value === null || value === undefined) continue;
        c("set", `${event}_${key}`, String(value));
      }
    }
    c("event", event);
  } catch {
    /* analytics is never worth breaking a page over */
  }
}
