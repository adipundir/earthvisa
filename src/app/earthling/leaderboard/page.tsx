import type { Metadata } from "next";
import Link from "next/link";
import { dataset } from "@/lib/dataset";
import { isoToFlag } from "@/lib/format";
import { leaderboard, earthlingCount } from "@/lib/earthling/store";

export const dynamic = "force-dynamic";

const title = "Earthling Leaderboard - Who Can Go The Furthest?";
const description =
  "The Earthlings with the most reach: destinations unlocked by their passports and visas, computed from official sources. Claim your ID and take a seat.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://earthvisa.in/earthling/leaderboard" },
  openGraph: { title, description, url: "https://earthvisa.in/earthling/leaderboard", type: "website" },
};

const byIso3 = new Map(dataset.allCountries.map((c) => [c.iso3, c]));

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const { country } = await searchParams;
  const filter = country && byIso3.has(country.toUpperCase()) ? country.toUpperCase() : undefined;
  const rows = await leaderboard({ primaryIso3: filter, limit: 100 });
  const total = await earthlingCount();
  // Countries actually present on the board, for the filter chips.
  const presentCountries = [...new Set((await leaderboard({ limit: 100 })).map((e) => e.passports[0]))]
    .map((iso3) => byIso3.get(iso3))
    .filter(Boolean)
    .sort((a, b) => a!.name.localeCompare(b!.name));

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-4xl px-5 pb-20 sm:px-8">
        <nav aria-label="Breadcrumb" className="pt-6 text-[13px] font-medium text-ink-2">
          <ol className="flex flex-wrap items-center gap-x-2">
            <li><Link href="/" className="inline-flex min-h-[24px] items-center transition hover:text-ink">Earth Visa</Link></li>
            <li aria-hidden="true" className="text-ink-3">/</li>
            <li><Link href="/earthling" className="inline-flex min-h-[24px] items-center transition hover:text-ink">Earthling</Link></li>
            <li aria-hidden="true" className="text-ink-3">/</li>
            <li aria-current="page" className="font-semibold text-ink">Leaderboard</li>
          </ol>
        </nav>

        <header className="mt-8">
          <h1 className="text-[clamp(28px,3.8vw,42px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
            Earthling leaderboard
          </h1>
          <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
            Who can go the furthest? Reach counts every destination enterable without an embassy visa - your passports plus the visas you hold.
          </p>
          <p className="mt-2 text-[13px] font-medium tabular-nums text-ink-3">
            {total} Earthling{total === 1 ? "" : "s"} · citizens of Earth · self-declared
          </p>
        </header>

        {presentCountries.length > 1 && (
          <div className="mt-8 flex flex-wrap gap-2">
            <Link href="/earthling/leaderboard" className={`chip ${!filter ? "chip-active" : ""}`}>
              Global
            </Link>
            {presentCountries.map((c) => (
              <Link
                key={c!.iso3}
                href={`/earthling/leaderboard?country=${c!.iso3}`}
                className={`chip ${filter === c!.iso3 ? "chip-active" : ""}`}
              >
                {isoToFlag(c!.iso2)} {c!.name}
              </Link>
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="mt-10 rounded-xl border border-hair bg-surface px-6 py-16 text-center">
            <p className="text-[20px] font-bold tracking-tight text-ink">The board is empty.</p>
            <p className="mt-2 text-[14.5px] text-ink-2">Somebody has to be Earthling #1 - citizen of Earth.</p>
            <Link
              href="/earthling"
              className="mt-6 inline-flex min-h-[46px] items-center justify-center rounded-lg bg-accent px-5 text-[14.5px] font-semibold text-white transition hover:bg-accent-deep dark:bg-accent-deep dark:hover:bg-accent"
            >
              Claim your Earthling ID
            </Link>
          </div>
        ) : (
          <ol className="mt-8 divide-y divide-hair border-y border-hair">
            {rows.map((e, i) => (
              <li key={e.username}>
                <Link href={`/earthling/${e.username}`} className="group flex min-h-[56px] items-center gap-4 py-3">
                  <span className={`w-8 shrink-0 text-right text-[15px] font-semibold tabular-nums ${i < 3 ? "text-ink" : "text-ink-3"}`}>{i + 1}</span>
                  <span aria-hidden="true" className="text-2xl">{isoToFlag(byIso3.get(e.passports[0])?.iso2 ?? "")}</span>
                  <span className="min-w-0 truncate text-[16px] font-semibold text-ink transition group-hover:text-accent">@{e.username}</span>
                  <span className="ml-auto shrink-0 text-[13px] font-medium tabular-nums text-ink-3 max-sm:hidden">beats {e.percentile}%</span>
                  <span className="w-14 shrink-0 text-right text-[17px] font-bold tabular-nums text-ink max-sm:ml-auto">{e.reach}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-10 text-[13px] text-ink-3">
          Self-declared - a game, not a certification.
        </p>
      </div>
    </main>
  );
}
