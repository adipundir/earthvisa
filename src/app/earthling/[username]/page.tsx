import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dataset } from "@/lib/dataset";
import { isoToFlag, fmtDate } from "@/lib/format";
import { earthlingRank, getEarthling } from "@/lib/earthling/store";

export const dynamic = "force-dynamic";

// Privacy by construction: the public profile shows the NUMBER and the primary
// passport flag - never the credential list, never additional passports.

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const e = await getEarthling(username);
  if (!e) return { title: "Earthling not found" };
  const rank = await earthlingRank(e.seq);
  const title = `@${e.username} reaches ${e.reach} destinations`;
  const description = `Earthling #${rank} has more reach than ${e.percentile}% of the world's passports. How far can you go?`;
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

export default async function EarthlingProfile({ params, searchParams }: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { username } = await params;
  const { welcome } = await searchParams;
  const e = await getEarthling(username);
  if (!e) notFound();
  const rank = await earthlingRank(e.seq);

  const primary = dataset.allCountries.find((c) => c.iso3 === e.passports[0]);
  // The email-confirmation redirect lands here with ?welcome=1 - greet the new
  // Earthling once, as their own page, not as a visitor's view of it.
  const isWelcome = welcome === "1";

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-5 pb-20 pt-6 sm:px-8">
        <nav aria-label="Breadcrumb" className="text-[13px] font-medium text-ink-2">
          <ol className="flex flex-wrap items-center gap-x-2">
            <li><Link href="/" className="inline-flex min-h-[24px] items-center transition hover:text-ink">Earth Visa</Link></li>
            <li aria-hidden="true" className="text-ink-3">/</li>
            <li><Link href="/earthling" className="inline-flex min-h-[24px] items-center transition hover:text-ink">Earthling</Link></li>
            <li aria-hidden="true" className="text-ink-3">/</li>
            <li aria-current="page" className="font-semibold text-ink">@{e.username}</li>
          </ol>
        </nav>

        {isWelcome && (
          <p className="mt-8 rounded-lg border border-hair-strong bg-surface px-4 py-3 text-[14px] leading-relaxed text-ink-2">
            <strong className="font-semibold text-ink">Confirmed.</strong> Your Earthling ID is live - this page is yours to share.
          </p>
        )}

        <div className={`${isWelcome ? "mt-6" : "mt-8"} rounded-xl border border-hair bg-surface px-6 py-12 text-center sm:px-12`}>
          <p className="text-[13px] font-semibold text-ink-2">
            {isWelcome ? "Your Earthling ID - citizen of Earth" : "Earthling ID · citizen of Earth"} #{rank}
          </p>
          <h1 className="mt-3 flex items-center justify-center gap-3 text-[28px] font-bold tracking-tight text-ink sm:text-[32px]">
            {primary && <span aria-hidden="true">{isoToFlag(primary.iso2)}</span>}
            @{e.username}
          </h1>
          <p className="stat-num mt-8 text-[clamp(72px,14vw,112px)] text-ink">{e.reach}</p>
          <p className="mt-3 text-[15px] font-medium text-ink-2">destinations without an embassy visa</p>
          <p className="mt-1.5 text-[14px] font-semibold text-ink">more reach than {e.percentile}% of the world&apos;s passports</p>
          <p className="mt-8 text-[13px] font-medium tabular-nums text-ink-3">
            Earthling since {fmtDate(e.createdAt.slice(0, 10))} · self-declared holdings · reach computed from official sources
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/earthling"
            className="inline-flex min-h-[46px] items-center justify-center rounded-lg bg-accent px-5 text-[14.5px] font-semibold text-white transition hover:bg-accent-deep dark:bg-accent-deep dark:hover:bg-accent"
          >
            How far can you go?
          </Link>
          <Link
            href="/earthling/leaderboard"
            className="inline-flex min-h-[46px] items-center justify-center rounded-lg border border-hair-strong bg-surface px-5 text-[14.5px] font-semibold text-ink transition hover:border-ink-3"
          >
            Leaderboard
          </Link>
        </div>
      </div>
    </main>
  );
}
