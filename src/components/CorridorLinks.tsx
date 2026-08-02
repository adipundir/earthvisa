import Link from "next/link";
import { flagFor } from "@/lib/dataset";
import SearchableLedger from "@/components/SearchableLedger";

export interface CorridorLink {
  href: string;
  label: string;
  /** iso3 used to render the leading flag */
  iso3: string;
}

// Ledger row (spec §12): compact rows in a document card, hairline dividers.
// nth-child resets keep the first visual row of each column count (1/2/3 cols)
// clear of a top hairline.
const LEDGER_ROW_LI =
  "border-t border-line first:border-t-0 sm:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+3)]:border-t-0";
const LEDGER_GRID_UL = "card-doc grid px-4 sm:grid-cols-2 sm:gap-x-8 sm:px-5 lg:grid-cols-3";

function Row({ l }: { l: CorridorLink }) {
  return (
    <li className={LEDGER_ROW_LI} data-search={l.label.toLowerCase()}>
      <Link
        href={l.href}
        className="group flex min-h-[44px] items-center gap-2.5 py-1.5 transition hover:bg-paper-2/50"
      >
        <span className="text-lg leading-none">{flagFor(l.iso3)}</span>
        <span className="min-w-0 flex-1 font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">
          {l.label}
        </span>
        <span aria-hidden className="mono shrink-0 text-ink-mute transition group-hover:text-stamp">
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
      <h2 className="text-section text-ink">{title}</h2>
      <p className="text-body mt-2 max-w-3xl text-ink-soft">{description}</p>
      <SearchableLedger count={links.length} noun="guides">
        <ul className={`${LEDGER_GRID_UL} mt-3`}>
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
            <ul className={`${LEDGER_GRID_UL} mt-3`}>
              {rest.map((l) => (
                <Row key={l.href} l={l} />
              ))}
            </ul>
          </details>
        )}
      </SearchableLedger>
    </section>
  );
}
