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
      <header className="border-b border-line-strong bg-paper-2/60">
        <div className="mx-auto w-full max-w-4xl px-5 pt-6 pb-8 sm:px-8">
          <nav className="mono mb-4 flex flex-wrap items-center gap-x-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
            <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
            <span aria-hidden>/</span>
            <Link href="/earthling" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earthling</Link>
            <span aria-hidden>/</span>
            <span className="inline-flex min-h-[44px] items-center text-ink">Leaderboard</span>
          </nav>
          <div className="rule-double" />
          <h1 className="mt-6 font-display text-4xl font-semibold leading-tight tracking-tight text-ink">
            Earthling Leaderboard
            <span className="block text-2xl font-normal italic text-ink-soft">Who can go the furthest?</span>
          </h1>
          <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
            {total} Earthling{total === 1 ? "" : "s"} · reach = passports + held visas · self-declared
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-5 pb-20 sm:px-8">
        {presentCountries.length > 1 && (
          <div className="mt-8 flex flex-wrap gap-2">
            <Link
              href="/earthling/leaderboard"
              className={`mono min-h-[36px] rounded-md border px-3 py-1.5 text-[12px] transition ${!filter ? "border-stamp bg-stamp/[0.08] text-stamp" : "border-line-strong text-ink-soft hover:border-stamp/40"}`}
            >
              Global
            </Link>
            {presentCountries.map((c) => (
              <Link
                key={c!.iso3}
                href={`/earthling/leaderboard?country=${c!.iso3}`}
                className={`mono min-h-[36px] rounded-md border px-3 py-1.5 text-[12px] transition ${filter === c!.iso3 ? "border-stamp bg-stamp/[0.08] text-stamp" : "border-line-strong text-ink-soft hover:border-stamp/40"}`}
              >
                {isoToFlag(c!.iso2)} {c!.name}
              </Link>
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-line px-6 py-16 text-center">
            <p className="font-display text-xl font-semibold text-ink">The board is empty.</p>
            <p className="mt-2 text-sm text-ink-soft">Somebody has to be Earthling #1.</p>
            <Link href="/earthling" className="mono mt-6 inline-flex min-h-[44px] items-center rounded-sm border border-stamp bg-stamp/[0.07] px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-stamp transition hover:bg-stamp hover:text-white">
              Claim your Earthling ID →
            </Link>
          </div>
        ) : (
          <ol className="mt-8 divide-y divide-line">
            {rows.map((e, i) => (
              <li key={e.username}>
                <Link href={`/earthling/${e.username}`} className="group flex min-h-[56px] items-center gap-4 py-3 transition">
                  <span className={`mono w-8 text-right text-[15px] font-semibold tabular-nums ${i < 3 ? "text-stamp" : "text-ink-mute"}`}>{i + 1}</span>
                  <span className="text-2xl">{isoToFlag(byIso3.get(e.passports[0])?.iso2 ?? "")}</span>
                  <span className="font-display text-[16px] font-medium text-ink transition group-hover:text-stamp">@{e.username}</span>
                  <span className="mono ml-auto text-[11px] uppercase tracking-[0.1em] text-ink-mute">beats {e.percentile}%</span>
                  <span className="mono w-14 text-right text-[17px] font-bold tabular-nums text-stamp">{e.reach}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        <p className="mono mt-10 max-w-2xl rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-mute">
          Self-declared - a game, not a certification.
        </p>
      </div>
    </main>
  );
}
