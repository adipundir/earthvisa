import type { Metadata } from "next";
import Link from "next/link";
import { dataset } from "@/lib/dataset";
import { isoToFlag } from "@/lib/format";
import EarthlingClaim from "@/components/EarthlingClaim";
import { leaderboard, earthlingCount } from "@/lib/earthling/store";

// Reads the Earthling store at request time - never prerendered.
export const dynamic = "force-dynamic";

const title = "How Far Can You Go? Claim Your Earthling ID";
const description =
  "See your personal reach - every destination your passport and visas unlock, computed from official sources - then claim your Earthling ID and take your place on the leaderboard.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://earthvisa.in/earthling" },
  openGraph: { title, description, url: "https://earthvisa.in/earthling", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default async function EarthlingPage({ searchParams }: { searchParams: Promise<{ verify?: string }> }) {
  const { verify } = await searchParams;
  const countries = dataset.allCountries.map((c) => ({ iso3: c.iso3, iso2: c.iso2, name: c.name }));
  // Full Credential shape (id, label, short, group) - EarthlingClaim groups
  // these by issuing country/bloc instead of rendering a flat pill wall.
  const credentials = dataset.credentials;
  const top = await leaderboard({ limit: 10 });
  const total = await earthlingCount();

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        <nav aria-label="Breadcrumb" className="pt-6 text-[13px] font-medium text-ink-2">
          <ol className="flex flex-wrap items-center gap-x-2">
            <li><Link href="/" className="inline-flex min-h-[24px] items-center transition hover:text-ink">Earth Visa</Link></li>
            <li aria-hidden="true" className="text-ink-3">/</li>
            <li aria-current="page" className="font-semibold text-ink">Earthling</li>
          </ol>
        </nav>

        <header className="mt-8">
          <h1 className="max-w-3xl text-[clamp(32px,4.6vw,54px)] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink">
            How far can you go?
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
            Your passport sets the baseline. Your visas raise it. Claim your Earthling ID - citizen of Earth.
          </p>
          <p className="mt-3 text-[13px] font-medium tabular-nums text-ink-3">
            {total > 0 ? `${total} Earthling${total === 1 ? "" : "s"} counted so far` : "Be Earthling #1"} · self-declared · reach computed from official sources
          </p>
        </header>

        {verify === "invalid" && (
          <p className="mt-8 max-w-2xl rounded-lg border border-hair-strong bg-surface px-4 py-3 text-[14px] leading-relaxed text-ink-2">
            <strong className="font-semibold text-ink">That confirmation link is invalid or has expired.</strong> Links
            last 24 hours - claim your name again below and we&apos;ll send a fresh one.
          </p>
        )}

        <section className="mt-10 grid gap-12 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <EarthlingClaim countries={countries} credentials={credentials} />
          </div>

          <aside>
            <h2 className="text-[20px] font-bold tracking-tight text-ink">Leaderboard</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">Reach is personal: two holders of the same passport differ by the visas they carry.</p>
            {top.length === 0 ? (
              <p className="mt-4 rounded-xl border border-hair px-4 py-6 text-center text-[13.5px] text-ink-3">
                Nobody has claimed a spot yet. The #1 seat is open.
              </p>
            ) : (
              <ol className="mt-4 divide-y divide-hair border-y border-hair">
                {top.map((e, i) => (
                  <li key={e.username}>
                    <Link href={`/earthling/${e.username}`} className="group flex min-h-[48px] items-center gap-3 py-2">
                      <span className="w-6 shrink-0 text-right text-[13px] font-medium tabular-nums text-ink-3">{i + 1}</span>
                      <span aria-hidden="true" className="text-lg">{isoToFlag(dataset.allCountries.find((c) => c.iso3 === e.passports[0])?.iso2 ?? "")}</span>
                      <span className="min-w-0 truncate text-[14.5px] font-semibold text-ink transition group-hover:text-accent">@{e.username}</span>
                      <span className="ml-auto shrink-0 text-[15px] font-bold tabular-nums text-ink">{e.reach}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
            <Link href="/earthling/leaderboard" className="mt-4 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-accent underline-offset-2 transition hover:underline">
              Full leaderboard →
            </Link>
          </aside>
        </section>

        <section className="mt-14 max-w-3xl border-t border-hair pt-8">
          <h2 className="text-[20px] font-bold tracking-tight text-ink">How reach works</h2>
          <ul className="mt-3 space-y-2">
            <li className="flex gap-2.5 text-[15px] leading-relaxed text-ink-2">
              <span aria-hidden className="mt-[10px] h-1 w-1 shrink-0 rounded-full bg-ink-3/70" />
              <span>Reach counts every destination you can enter without arranging an embassy visa - visa-free, visa on arrival, or with an eTA/e-visa.</span>
            </li>
            <li className="flex gap-2.5 text-[15px] leading-relaxed text-ink-2">
              <span aria-hidden className="mt-[10px] h-1 w-1 shrink-0 rounded-full bg-ink-3/70" />
              <span>Holding a strong third-country visa genuinely changes it: a US or Schengen visa unlocks dozens of extra destinations for many passports.</span>
            </li>
            <li className="flex gap-2.5 text-[15px] leading-relaxed text-ink-2">
              <span aria-hidden className="mt-[10px] h-1 w-1 shrink-0 rounded-full bg-ink-3/70" />
              <span>The leaderboard is a game - your <Link href="/passport" className="font-semibold text-accent underline-offset-2 hover:underline">passport&apos;s official rules</Link> are not.</span>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
