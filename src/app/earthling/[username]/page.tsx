import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dataset } from "@/lib/dataset";
import { isoToFlag, fmtDate } from "@/lib/format";
import { getEarthling } from "@/lib/earthling/store";

export const dynamic = "force-dynamic";

// Privacy by construction: the public profile shows the NUMBER and the primary
// passport flag - never the credential list, never additional passports.

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const e = await getEarthling(username);
  if (!e) return { title: "Earthling not found" };
  const title = `@${e.username} reaches ${e.reach} destinations`;
  const description = `Earthling #${e.seq} has more reach than ${e.percentile}% of the world's passports. How far can you go?`;
  return {
    title,
    description,
    // The canonical collapses the /@username rewrite onto this URL.
    alternates: { canonical: `https://earthvisa.in/earthling/${e.username}` },
    openGraph: { title, description, url: `https://earthvisa.in/earthling/${e.username}`, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
    // Unbounded user-generated pages with minimal unique content per profile -
    // keep them out of the index (already excluded from the sitemap) while
    // still letting link equity flow through outbound links (follow: true).
    robots: { index: false, follow: true },
  };
}

export default async function EarthlingProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const e = await getEarthling(username);
  if (!e) notFound();

  const primary = dataset.allCountries.find((c) => c.iso3 === e.passports[0]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
        <nav className="mono mb-8 flex flex-wrap items-center gap-x-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
          <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
          <span aria-hidden>/</span>
          <Link href="/earthling" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earthling</Link>
          <span aria-hidden>/</span>
          <span className="inline-flex min-h-[44px] items-center text-ink">@{e.username}</span>
        </nav>

        <div className="rounded-xl border border-line-strong bg-paper-2/60 px-6 py-12 text-center sm:px-12">
          <p className="mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-mute">Earthling #{e.seq}</p>
          <h1 className="mt-3 flex items-center justify-center gap-3 font-display text-4xl font-semibold text-ink">
            {primary && <span className="text-4xl">{isoToFlag(primary.iso2)}</span>}
            @{e.username}
          </h1>
          <p className="mt-8 font-display text-8xl font-bold tabular-nums leading-none text-stamp">{e.reach}</p>
          <p className="mt-3 text-base text-ink-soft">
            destinations without an embassy visa
          </p>
          <p className="mono mt-2 text-[12px] font-medium uppercase tracking-[0.14em] text-vfree">
            more reach than {e.percentile}% of the world&apos;s passports
          </p>
          <p className="mono mt-8 text-[11px] uppercase tracking-[0.12em] text-ink-mute">
            Earthling since {fmtDate(e.createdAt.slice(0, 10))} · self-declared holdings · reach computed from official sources
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/earthling" className="mono inline-flex min-h-[44px] items-center rounded-sm border border-stamp bg-stamp/[0.07] px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-stamp transition hover:bg-stamp hover:text-white">
            How far can YOU go? →
          </Link>
          <Link href="/earthling/leaderboard" className="mono inline-flex min-h-[44px] items-center rounded-sm border border-line-strong px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-stamp hover:text-stamp">
            Leaderboard
          </Link>
        </div>
      </div>
    </main>
  );
}
