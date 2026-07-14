import Link from "next/link";
import { flagFor } from "@/lib/dataset";

export interface CorridorLink {
  href: string;
  label: string;
  /** iso3 used to render the leading flag */
  iso3: string;
}

function Row({ l }: { l: CorridorLink }) {
  return (
    <li>
      <Link
        href={l.href}
        className="group flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 transition hover:border-line-strong"
      >
        <span className="text-xl">{flagFor(l.iso3)}</span>
        <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">
          {l.label}
        </span>
        <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover:text-stamp">
          →
        </span>
      </Link>
    </li>
  );
}

/**
 * Contextual link mesh to the corridor pages (e.g. "Thailand Visa for Indian
 * Citizens"). Rendered on the passport and destination detail pages so the
 * corridors are crawl-discoverable and receive internal PageRank instead of
 * being reachable only via the sitemap. Renders nothing when there are no
 * corridors for this country. Only the first `previewCount` rows are visible;
 * the long tail sits behind a "Show all" disclosure (still in the HTML, so
 * crawlers see every link) instead of rendering as an uncapped link wall.
 */
export default function CorridorLinks({
  title,
  description,
  links,
  previewCount = 18,
}: {
  title: string;
  description: string;
  links: CorridorLink[];
  /** Rows visible before the "Show all" disclosure. */
  previewCount?: number;
}) {
  if (links.length === 0) return null;
  const preview = links.slice(0, previewCount);
  const rest = links.slice(previewCount);
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-soft">{description}</p>
      <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {preview.map((l) => (
          <Row key={l.href} l={l} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="group mt-3">
          <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp transition hover:text-ink">
            <span className="group-open:hidden">Show all {links.length} guides</span>
            <span className="hidden group-open:inline">Show fewer</span>
            <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
          </summary>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((l) => (
              <Row key={l.href} l={l} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
