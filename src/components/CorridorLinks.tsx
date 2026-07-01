import Link from "next/link";
import { flagFor } from "@/lib/dataset";

export interface CorridorLink {
  href: string;
  label: string;
  /** iso3 used to render the leading flag */
  iso3: string;
}

/**
 * Contextual link mesh to the corridor pages (e.g. "Thailand Visa for Indian
 * Citizens"). Rendered on the passport and destination detail pages so the
 * corridors are crawl-discoverable and receive internal PageRank instead of
 * being reachable only via the sitemap. Renders nothing when there are no
 * corridors for this country.
 */
export default function CorridorLinks({
  title,
  description,
  links,
}: {
  title: string;
  description: string;
  links: CorridorLink[];
}) {
  if (links.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-soft">{description}</p>
      <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <li key={l.href}>
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
        ))}
      </ul>
    </section>
  );
}
